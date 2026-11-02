// ==============================================================================
// NTL AUCTION PLATFORM - REAL-TIME AUCTION HOOK (GOOGLE SHEETS BACKED)
// Client-side hook managing real-time auction synchronization via SSE & polling
// Completely decoupled from Supabase; authoritative source of truth is Google Sheets
// Features: Monotonic revision ordering, anti-cache polling, and auto-reconnecting SSE
// ==============================================================================

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AuctionSession, Team, Player, AuctionRules } from "@/types";
import { MOCK_AUCTION_SESSION, MOCK_RULES } from "@/lib/mock-data/auction";
import { NTL_TEAMS, NTL_PLAYERS } from "@/config/ntl-season-1";

export type RealtimeConnectionStatus = "connected" | "reconnecting" | "unavailable";

export interface RealtimeAuctionState {
  session: AuctionSession;
  teams: Team[];
  players: Player[];
  rules: AuctionRules;
  isConnected: boolean;
  connectionStatus: RealtimeConnectionStatus;
  currentRevision: number;
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
  refreshState: () => Promise<void>;
}

export function useRealtimeAuction(leagueId: string): RealtimeAuctionState {
  const [session, setSession] = useState<AuctionSession>({
    ...MOCK_AUCTION_SESSION,
    seasonId: leagueId,
    revision: 1,
    version: 1,
  });
  const [teams, setTeams] = useState<Team[]>(NTL_TEAMS);
  const [players, setPlayers] = useState<Player[]>(NTL_PLAYERS);
  const [rules, setRules] = useState<AuctionRules>(MOCK_RULES);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>("reconnecting");
  const [currentRevision, setCurrentRevision] = useState<number>(1);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(45);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);
  const [isHammered, setIsHammered] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const lastRevisionRef = useRef<number>(1);

  // Centralized authoritative state application with monotonic revision ordering
  const applyAuthoritativeState = useCallback(
    (incoming: {
      session?: AuctionSession;
      teams?: Team[];
      players?: Player[];
      rules?: AuctionRules;
      revision?: number;
      version?: number;
    }): boolean => {
      const incomingRev =
        incoming.revision ??
        incoming.session?.revision ??
        incoming.version ??
        incoming.session?.version ??
        0;

      // Reject stale out-of-order updates
      if (incomingRev > 0 && incomingRev < lastRevisionRef.current) {
        return false;
      }

      if (incomingRev > 0) {
        lastRevisionRef.current = Math.max(lastRevisionRef.current, incomingRev);
        setCurrentRevision(lastRevisionRef.current);
      }

      if (incoming.session) {
        setSession({
          ...incoming.session,
          revision: lastRevisionRef.current,
          version: lastRevisionRef.current,
        });
      }
      if (incoming.teams) setTeams(incoming.teams);
      if (incoming.players) setPlayers(incoming.players);
      if (incoming.rules) setRules(incoming.rules);

      setIsConnected(true);
      setConnectionStatus("connected");
      return true;
    },
    []
  );

  // 1. Fetch authoritative state with explicit anti-cache parameters
  const fetchAuthoritativeState = useCallback(async () => {
    try {
      const rev = lastRevisionRef.current;
      const res = await fetch(
        `/api/auction/state?leagueId=${encodeURIComponent(leagueId)}&_t=${Date.now()}&_rev=${rev}`,
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          applyAuthoritativeState({
            session: data.session,
            teams: data.teams,
            players: data.players,
            rules: data.rules,
            revision: data.revision || data.version,
          });
        }
      } else {
        if (lastRevisionRef.current === 0) {
          setIsConnected(false);
          setConnectionStatus("unavailable");
        }
      }
    } catch (err) {
      console.warn("[RealtimeAuction] Failed to fetch state from server:", err);
      if (!isConnected) {
        setConnectionStatus("reconnecting");
      }
    }
  }, [leagueId, applyAuthoritativeState, isConnected]);

  useEffect(() => {
    fetchAuthoritativeState();
  }, [fetchAuthoritativeState]);

  // 2. Real-time Subscription via SSE Stream with auto-reconnection and exponential backoff
  useEffect(() => {
    let isSubscribed = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;

    const connectSSE = () => {
      if (!isSubscribed) return;
      try {
        const rev = lastRevisionRef.current;
        const streamUrl = `/api/realtime/stream?leagueId=${encodeURIComponent(leagueId)}&_t=${Date.now()}&_rev=${rev}`;
        const es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (!isSubscribed) return;
          reconnectAttempts = 0;
          setIsConnected(true);
          setConnectionStatus("connected");
        };

        es.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const data = JSON.parse(event.data);
            applyAuthoritativeState({
              session: data.session,
              teams: data.teams,
              players: data.players,
              rules: data.rules,
              revision: data.revision,
            });

            if (data.type === "LOT_SOLD") {
              setIsHammered(true);
            } else if (
              data.type === "LOT_CHANGED" ||
              data.type === "BID_PLACED" ||
              data.type === "LOT_RESET"
            ) {
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
          if (!isSubscribed) return;
          try {
            es.close();
          } catch {}
          eventSourceRef.current = null;
          setConnectionStatus("reconnecting");

          // Auto-reconnect with exponential backoff (1s, 2s, max 4s)
          reconnectAttempts++;
          const delay = Math.min(4000, 1000 * Math.pow(1.5, Math.min(reconnectAttempts - 1, 3)));
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            if (isSubscribed) connectSSE();
          }, delay);
        };
      } catch (e) {
        console.warn("[RealtimeAuction] EventSource error, fallback active:", e);
        setConnectionStatus("reconnecting");
      }
    };

    connectSSE();

    // 3. Failsafe background polling (every 2.0s) guaranteeing continuous synchronization
    const pollingFallback = setInterval(() => {
      if (isSubscribed) {
        fetchAuthoritativeState();
      }
    }, 2000);

    return () => {
      isSubscribed = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(pollingFallback);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [leagueId, fetchAuthoritativeState, applyAuthoritativeState]);

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

        const clientVersion = lastRevisionRef.current;

        const res = await fetch("/api/auction/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leagueId, actionId, clientVersion, ...payload }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return { success: false, error: data.error || "Action rejected by server" };
        }

        applyAuthoritativeState({
          session: data.session,
          teams: data.teams,
          players: data.players,
          rules: data.rules,
          revision: data.session?.revision || (lastRevisionRef.current + 1),
        });

        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message || "Network error" };
      }
    },
    [leagueId, applyAuthoritativeState]
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
    connectionStatus,
    currentRevision,
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
    refreshState: fetchAuthoritativeState,
  };
}
