// ==============================================================================
// NTL AUCTION PLATFORM - REAL-TIME AUCTION HOOK (GOOGLE SHEETS BACKED)
// Client-side hook managing real-time auction synchronization via SSE & polling
// Completely decoupled from Supabase; authoritative source of truth is Google Sheets
// ==============================================================================

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AuctionSession, Team, Player, AuctionRules } from "@/types";
import { MOCK_AUCTION_SESSION, MOCK_RULES } from "@/lib/mock-data/auction";
import { MOCK_TEAMS } from "@/lib/mock-data/teams";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";

export interface RealtimeAuctionState {
  session: AuctionSession;
  teams: Team[];
  players: Player[];
  rules: AuctionRules;
  isConnected: boolean;
  remainingSeconds: number;
  lastActionMessage: string | null;
  isHammered: boolean;
  placeBid: (teamId: string, amount: number) => Promise<{ success: boolean; error?: string }>;
  selectLot: (playerId?: string) => Promise<{ success: boolean; error?: string }>;
  hammerSold: () => Promise<{ success: boolean; error?: string }>;
  markUnsold: (reason?: string) => Promise<{ success: boolean; error?: string }>;
  togglePause: () => Promise<{ success: boolean; error?: string }>;
  undo: () => Promise<{ success: boolean; error?: string }>;
  resetLot: () => Promise<{ success: boolean; error?: string }>;
  initRound2: () => Promise<{ success: boolean; error?: string }>;
  startRound2: () => Promise<{ success: boolean; error?: string }>;
  syncLeagueData: (teams?: Team[], players?: Player[]) => Promise<void>;
}

export function useRealtimeAuction(leagueId: string): RealtimeAuctionState {
  const [session, setSession] = useState<AuctionSession>({
    ...MOCK_AUCTION_SESSION,
    seasonId: leagueId,
  });
  const [teams, setTeams] = useState<Team[]>(MOCK_TEAMS);
  const [players, setPlayers] = useState<Player[]>(MOCK_PLAYERS);
  const [rules, setRules] = useState<AuctionRules>(MOCK_RULES);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(45);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);
  const [isHammered, setIsHammered] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  // 1. Fetch initial state on mount or when leagueId changes
  const fetchAuthoritativeState = useCallback(async () => {
    try {
      const res = await fetch(`/api/auction/state?leagueId=${encodeURIComponent(leagueId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.session) setSession(data.session);
        if (data.teams) setTeams(data.teams);
        if (data.players) setPlayers(data.players);
        if (data.rules) setRules(data.rules);
      }
    } catch (err) {
      console.warn("[RealtimeAuction] Failed to fetch state from server:", err);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchAuthoritativeState();
  }, [fetchAuthoritativeState]);

  // 2. Real-time Subscription via SSE Stream with automatic reconnection
  useEffect(() => {
    let isSubscribed = true;

    const connectSSE = () => {
      const streamUrl = `/api/realtime/stream?leagueId=${encodeURIComponent(leagueId)}`;
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (isSubscribed) {
          setIsConnected(true);
        }
      };

      es.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const data = JSON.parse(event.data);
          if (data.session) setSession(data.session);
          if (data.teams) setTeams(data.teams);
          if (data.players) setPlayers(data.players);
          if (data.rules) setRules(data.rules);

          if (data.type === "LOT_SOLD") {
            setIsHammered(true);
          } else if (data.type === "LOT_CHANGED" || data.type === "BID_PLACED") {
            setIsHammered(false);
          }

          if (data.lastAction?.message) {
            setLastActionMessage(data.lastAction.message);
            setTimeout(() => setLastActionMessage(null), 3500);
          }
        } catch (err) {
          console.error("[RealtimeAuction] Error parsing realtime event:", err);
        }
      };

      es.onerror = () => {
        if (isSubscribed) {
          setIsConnected(false);
        }
      };
    };

    connectSSE();

    // 3. Failsafe background polling (every 3.5s) ensuring synchronization
    // even across multi-instance serverless deployments or temporary socket drops
    const pollingFallback = setInterval(() => {
      if (isSubscribed) {
        fetchAuthoritativeState();
      }
    }, 3500);

    return () => {
      isSubscribed = false;
      clearInterval(pollingFallback);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [leagueId, fetchAuthoritativeState]);

  // 4. Authoritative countdown derived from session.timerExpiresAt
  useEffect(() => {
    if (session.status !== "IN_PROGRESS" || !session.timerExpiresAt) {
      if (session.status === "PAUSED") {
        return; // maintain frozen seconds
      }
      setRemainingSeconds(session.timerSeconds || 0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const annEndsAt = session.announcement?.endsAt
        ? new Date(session.announcement.endsAt).getTime()
        : 0;

      // If an authoritative announcement is still active, freeze the bidding timer at its initial duration
      if (annEndsAt > now) {
        setRemainingSeconds(session.timerSeconds || 45);
        return;
      }

      const expiresAtMs = new Date(session.timerExpiresAt!).getTime();
      const diff = Math.max(0, Math.ceil((expiresAtMs - now) / 1000));
      setRemainingSeconds(diff);
    }, 250);

    return () => clearInterval(interval);
  }, [session.timerExpiresAt, session.status, session.timerSeconds, session.announcement?.endsAt]);

  // 5. Action Dispatchers (send commands to server which commits to Google Sheets)
  const sendAction = useCallback(
    async (payload: Record<string, unknown>): Promise<{ success: boolean; error?: string }> => {
      try {
        const actionId =
          (payload.actionId as string) ||
          `act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        const res = await fetch("/api/auction/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leagueId, actionId, ...payload }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return { success: false, error: data.error || "Action rejected by server" };
        }
        if (data.session) setSession(data.session);
        if (data.teams) setTeams(data.teams);
        if (data.players) setPlayers(data.players);
        if (data.rules) setRules(data.rules);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message || "Network error" };
      }
    },
    [leagueId]
  );

  const placeBid = useCallback(
    (teamId: string, amount: number) => sendAction({ type: "PLACE_BID", teamId, amount }),
    [sendAction]
  );

  const selectLot = useCallback(
    (playerId?: string) => sendAction({ type: "SELECT_LOT", playerId }),
    [sendAction]
  );

  const hammerSold = useCallback(() => sendAction({ type: "HAMMER_SOLD" }), [sendAction]);

  const markUnsold = useCallback(
    (reason?: string) => sendAction({ type: "HAMMER_UNSOLD", reason }),
    [sendAction]
  );

  const togglePause = useCallback(() => sendAction({ type: "PAUSE_RESUME" }), [sendAction]);

  const undo = useCallback(() => sendAction({ type: "UNDO" }), [sendAction]);

  const resetLot = useCallback(() => sendAction({ type: "RESET_LOT" }), [sendAction]);

  const initRound2 = useCallback(() => sendAction({ type: "INIT_ROUND_2" }), [sendAction]);

  const startRound2 = useCallback(() => sendAction({ type: "START_ROUND_2" }), [sendAction]);

  const syncLeagueData = useCallback(
    async (updatedTeams?: Team[], updatedPlayers?: Player[]) => {
      if (updatedTeams) {
        await sendAction({ type: "UPDATE_TEAMS", teams: updatedTeams });
      }
      if (updatedPlayers) {
        await sendAction({ type: "UPDATE_PLAYERS", players: updatedPlayers });
      }
    },
    [sendAction]
  );

  return {
    session,
    teams,
    players,
    rules,
    isConnected,
    remainingSeconds,
    lastActionMessage,
    isHammered,
    placeBid,
    selectLot,
    hammerSold,
    markUnsold,
    togglePause,
    undo,
    resetLot,
    initRound2,
    startRound2,
    syncLeagueData,
  };
}
