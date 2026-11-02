"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AuctionSession, Team, Player, AuctionRules, League } from "@/types";
import { MOCK_AUCTION_SESSION, MOCK_RULES } from "@/lib/mock-data/auction";
import { NTL_TEAMS, NTL_PLAYERS } from "@/config/ntl-season-1";

export type RealtimeConnectionStatus = "connected" | "reconnecting" | "unavailable";

export interface RealtimeAuctionState {
  league: League | null;
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
  const [league, setLeague] = useState<League | null>(null);
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
  const lastRevisionRef = useRef<number>(0);
  const actionVersionRef = useRef<number>(0);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeLeagueRef = useRef(leagueId);
  activeLeagueRef.current = leagueId;

  // Centralized authoritative state application with monotonic revision ordering
  const applyAuthoritativeState = useCallback(
    (incoming: {
      league?: League;
      session?: AuctionSession;
      teams?: Team[];
      players?: Player[];
      rules?: AuctionRules;
      revision?: number;
      version?: number;
    }): boolean => {
      if (activeLeagueRef.current !== leagueId || (incoming.session && incoming.session.seasonId !== leagueId)) return false;
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
          version: incoming.session.version,
        });
      }
      if (incoming.session?.version) actionVersionRef.current = incoming.session.version;
      if (incoming.league) setLeague(incoming.league);
      if (incoming.session) setIsHammered(incoming.session.announcement?.type === "SOLD");
      if (incoming.teams) setTeams(incoming.teams);
      if (incoming.players) setPlayers(incoming.players);
      if (incoming.rules) setRules(incoming.rules);

      return true;
    },
    [leagueId]
  );

  const fetchAuthoritativeState = useCallback(async () => {
    try {
      const res = await fetch(`/api/auction/state?leagueId=${encodeURIComponent(leagueId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("State unavailable");
      const data = await res.json();
      if (data.success) applyAuthoritativeState(data);
    } catch {
      if (activeLeagueRef.current === leagueId && lastRevisionRef.current === 0) setConnectionStatus("unavailable");
    }
  }, [leagueId, applyAuthoritativeState]);

  useEffect(() => {
    let active = true;
    let healthy = false;
    let lastSeen = Date.now();
    let attempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    lastRevisionRef.current = 0;
    actionVersionRef.current = 0;
    setCurrentRevision(0);
    setLeague(null);
    setSession({ ...MOCK_AUCTION_SESSION, seasonId: leagueId, currentPlayer: null, currentPlayerId: null, announcement: null });
    setTeams([]);
    setPlayers([]);
    setIsHammered(false);
    setLastActionMessage(null);
    setIsConnected(false);
    setConnectionStatus("reconnecting");

    const connect = () => {
      if (!active) return;
      const es = new EventSource(`/api/realtime/stream?leagueId=${encodeURIComponent(leagueId)}`);
      eventSourceRef.current = es;
      lastSeen = Date.now();
      const fail = () => {
        if (!active || eventSourceRef.current !== es) return;
        es.close();
        eventSourceRef.current = null;
        healthy = false;
        setIsConnected(false);
        setConnectionStatus("reconnecting");
        const delay = Math.min(10000, 1000 * 2 ** Math.min(attempts++, 4));
        reconnectTimer = setTimeout(connect, delay + Math.random() * 250);
      };
      es.addEventListener("heartbeat", () => { lastSeen = Date.now(); });
      es.onmessage = event => {
        if (!active || eventSourceRef.current !== es) return;
        try {
          const data = JSON.parse(event.data);
          if (data.leagueId !== leagueId || !data.session) return;
          if (!applyAuthoritativeState(data)) return;
          lastSeen = Date.now();
          healthy = true;
          attempts = 0;
          setIsConnected(true);
          setConnectionStatus("connected");
        } catch { fail(); }
      };
      es.onerror = fail;
    };
    void fetchAuthoritativeState();
    connect();
    const recovery = setInterval(() => {
      if (!active) return;
      if (Date.now() - lastSeen > 30000 && eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        healthy = false;
        setIsConnected(false);
        setConnectionStatus("reconnecting");
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 1000);
      }
      if (!healthy) void fetchAuthoritativeState();
    }, 5000);
    const visible = () => {
      if (document.visibilityState === "visible") void fetchAuthoritativeState();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      clearTimeout(reconnectTimer);
      clearInterval(recovery);
      document.removeEventListener("visibilitychange", visible);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    };
  }, [leagueId, fetchAuthoritativeState, applyAuthoritativeState]);

  // 4. Authoritative countdown derived from session.timerExpiresAt
  useEffect(() => {
    if (session.status !== "IN_PROGRESS" || !session.timerExpiresAt) {
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

        const clientVersion = actionVersionRef.current;

        const res = await fetch("/api/auction/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leagueId, actionId, clientVersion, ...payload }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return { success: false, error: data.error || "Action rejected by server" };
        }

        if (activeLeagueRef.current !== leagueId) return { success: true };
        if (data.message) {
          setLastActionMessage(data.message);
          if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
          messageTimeoutRef.current = setTimeout(() => setLastActionMessage(null), 3500);
        }
        applyAuthoritativeState({
          league: data.league,
          session: data.session,
          teams: data.teams,
          players: data.players,
          rules: data.rules,
          revision: data.session?.revision,
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
    league,
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
