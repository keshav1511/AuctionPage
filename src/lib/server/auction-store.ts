// ==============================================================================
// NTL AUCTION PLATFORM - AUTHORITATIVE SERVER AUCTION STORE
// Server-side authoritative state management with real-time event broadcasting
// Integrates with Supabase when configured, provides synchronized state engine
// ==============================================================================

import { AuctionSession, Team, Player, AuctionRules, Bid, League } from "@/types";
import { MOCK_TEAMS } from "@/lib/mock-data/teams";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";
import { MOCK_RULES, MOCK_AUCTION_SESSION } from "@/lib/mock-data/auction";
import { getInitialLeagueById } from "@/lib/mock-data/leagues";

export type AuctionActionType =
  | "PLACE_BID"
  | "SELECT_LOT"
  | "HAMMER_SOLD"
  | "HAMMER_UNSOLD"
  | "PAUSE_RESUME"
  | "UNDO"
  | "RESET_LOT"
  | "UPDATE_TEAMS"
  | "UPDATE_PLAYERS"
  | "UPDATE_RULES"
  | "UPDATE_LEAGUE";

export interface AuctionActionPayload {
  leagueId: string;
  type: AuctionActionType;
  teamId?: string;
  playerId?: string;
  amount?: number;
  reason?: string;
  teams?: Team[];
  players?: Player[];
  rules?: Partial<AuctionRules>;
  league?: Partial<League>;
}

export interface AuctionRealtimeEvent {
  type: string;
  leagueId: string;
  timestamp: string;
  session: AuctionSession;
  teams?: Team[];
  players?: Player[];
  rules?: AuctionRules;
  league?: League;
  lastAction?: {
    type: AuctionActionType;
    teamName?: string;
    playerName?: string;
    amount?: number;
    message?: string;
  };
}

export interface LeagueState {
  league: League;
  session: AuctionSession;
  teams: Team[];
  players: Player[];
  rules: AuctionRules;
  pausedRemainingSeconds?: number;
}

type EventListener = (event: AuctionRealtimeEvent) => void;

interface StoreGlobalState {
  leagues: Map<string, LeagueState>;
  listeners: Map<string, Set<EventListener>>;
}

// Global process singleton to persist across Next.js re-evaluations
const globalState: StoreGlobalState = ((globalThis as unknown as Record<string, unknown>).__ntl_auction_store__ as StoreGlobalState) || {
  leagues: new Map<string, LeagueState>(),
  listeners: new Map<string, Set<EventListener>>(),
};

if (process.env.NODE_ENV !== "production") {
  (globalThis as unknown as Record<string, unknown>).__ntl_auction_store__ = globalState;
}

/**
 * Registers or initializes a league with custom/new configuration
 */
export function registerLeagueState(league: League): LeagueState {
  if (!globalState.leagues.has(league.id)) {
    const initialTeams = MOCK_TEAMS.map((t) => ({
      ...t,
      seasonId: league.id,
    }));

    const initialPlayers = MOCK_PLAYERS.map((p) => ({
      ...p,
      seasonId: league.id,
    }));

    const initialRules: AuctionRules = {
      ...MOCK_RULES,
      seasonId: league.id,
      initialTimerSeconds: MOCK_RULES.initialTimerSeconds || 45,
      bidExtensionSeconds: MOCK_RULES.bidExtensionSeconds || 10,
    };

    const firstPlayer = initialPlayers[0];
    const initialSession: AuctionSession = {
      ...MOCK_AUCTION_SESSION,
      id: `auction-${league.id}`,
      seasonId: league.id,
      currentPlayerId: firstPlayer ? firstPlayer.id : null,
      currentPlayer: firstPlayer || null,
      currentHighestBid: 0,
      currentLeadingTeamId: null,
      currentLeadingTeam: null,
      status: "IDLE",
      timerSeconds: initialRules.initialTimerSeconds,
      timerExpiresAt: new Date(Date.now() + initialRules.initialTimerSeconds * 1000).toISOString(),
      round: 1,
      bidCount: 0,
      recentBids: [],
    };

    const newState: LeagueState = {
      league,
      session: initialSession,
      teams: initialTeams,
      players: initialPlayers,
      rules: initialRules,
    };

    globalState.leagues.set(league.id, newState);
    return newState;
  }

  const existingState = globalState.leagues.get(league.id)!;
  existingState.league = { ...existingState.league, ...league };
  return existingState;
}

/**
 * Retrieves authoritative state for a league.
 * Returns null if the league does not exist and is not configured in INITIAL_LEAGUES.
 */
export function getAuthoritativeLeagueState(leagueId: string): LeagueState | null {
  if (!leagueId || typeof leagueId !== "string") {
    return null;
  }

  if (globalState.leagues.has(leagueId)) {
    return globalState.leagues.get(leagueId)!;
  }

  const baseLeague = getInitialLeagueById(leagueId);
  if (!baseLeague) {
    return null;
  }

  return registerLeagueState(baseLeague);
}

/**
 * Subscribes a listener to real-time events for a specific league
 */
export function subscribeToAuctionEvents(leagueId: string, listener: EventListener): () => void {
  if (!globalState.listeners.has(leagueId)) {
    globalState.listeners.set(leagueId, new Set());
  }

  const set = globalState.listeners.get(leagueId)!;
  set.add(listener);

  return () => {
    set.delete(listener);
    if (set.size === 0) {
      globalState.listeners.delete(leagueId);
    }
  };
}

/**
 * Broadcasts an authoritative event to all subscribers
 */
function broadcastEvent(event: AuctionRealtimeEvent) {
  const set = globalState.listeners.get(event.leagueId);
  if (set && set.size > 0) {
    set.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error("Error executing auction event listener:", err);
      }
    });
  }
}

/**
 * Processes an authoritative auction action on the server
 */
export function processAuctionAction(payload: AuctionActionPayload): {
  success: boolean;
  message?: string;
  error?: string;
  state?: LeagueState;
} {
  const { leagueId, type } = payload;
  let state = getAuthoritativeLeagueState(leagueId);

  // If league doesn't exist yet, check if action is UPDATE_LEAGUE with a valid league definition
  if (!state) {
    if (type === "UPDATE_LEAGUE" && payload.league && payload.league.name) {
      const newLeague: League = {
        id: leagueId,
        slug: payload.league.slug || leagueId.replace(/^league-/, ""),
        name: payload.league.name,
        description: payload.league.description || "",
        logoUrl: payload.league.logoUrl || "",
        matchDate: payload.league.matchDate || new Date().toISOString().split("T")[0],
        matchVenue: payload.league.matchVenue || "Venue TBD",
        auctionDate: payload.league.auctionDate || new Date().toISOString().split("T")[0],
        auctionTime: payload.league.auctionTime || "18:00",
        timezone: payload.league.timezone || "Asia/Kolkata",
        primaryColor: payload.league.primaryColor || "#059669",
        secondaryColor: payload.league.secondaryColor || "#F59E0B",
        ...payload.league,
      };
      state = registerLeagueState(newLeague);
    } else {
      return {
        success: false,
        error: `League with ID "${leagueId}" not found in authoritative auction store`,
      };
    }
  }

  const nowIso = new Date().toISOString();

  switch (type) {
    case "PLACE_BID": {
      const { teamId, amount } = payload;
      if (!teamId || typeof amount !== "number" || amount <= 0) {
        return { success: false, error: "Invalid team or bid amount", state };
      }

      if (state.session.status === "PAUSED") {
        return { success: false, error: "Auction is paused. Resume to accept bids.", state };
      }

      const team = state.teams.find((t) => t.id === teamId);
      if (!team) {
        return { success: false, error: "Target franchise not found", state };
      }

      const currentHighest = state.session.currentHighestBid || 0;
      if (amount <= currentHighest && state.session.bidCount > 0) {
        return {
          success: false,
          error: `Bid amount ₹${amount.toLocaleString()} must strictly exceed current highest bid ₹${currentHighest.toLocaleString()}`,
          state,
        };
      }

      // Check squad reserve limit
      const currentSquad = team.squadCount || 0;
      const minPlayers = team.purse?.minPlayers || 15;
      const minRequiredReserve = Math.max(0, minPlayers - currentSquad - 1) * 25000;
      const remainingAmount = team.purse?.remainingAmount || 5000000;

      if (remainingAmount - amount < minRequiredReserve) {
        return {
          success: false,
          error: `Purse Reserve Violation: ${team.name} must reserve ₹${minRequiredReserve.toLocaleString()} for minimum squad spots`,
          state,
        };
      }

      // Authoritative timer extension: Reset timer to NOW + extensionSeconds (default 10s)
      const extensionSeconds = state.rules.bidExtensionSeconds || 10;
      const newExpiryTime = Date.now() + extensionSeconds * 1000;
      const newExpiryIso = new Date(newExpiryTime).toISOString();

      const newBid: Bid = {
        id: `bid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        auctionId: state.session.id,
        playerId: state.session.currentPlayerId || "",
        teamId: team.id,
        teamName: team.name,
        teamShortCode: team.shortCode,
        teamLogoUrl: team.logoUrl,
        amount,
        bidType: state.session.bidCount === 0 ? "BASE" : "STANDARD",
        placedAt: nowIso,
      };

      state.session = {
        ...state.session,
        status: "IN_PROGRESS",
        currentHighestBid: amount,
        currentLeadingTeamId: team.id,
        currentLeadingTeam: team,
        timerSeconds: extensionSeconds,
        timerExpiresAt: newExpiryIso,
        lastBidAt: nowIso,
        bidCount: state.session.bidCount + 1,
        recentBids: [newBid, ...state.session.recentBids],
      };

      broadcastEvent({
        type: "BID_PLACED",
        leagueId,
        timestamp: nowIso,
        session: state.session,
        teams: state.teams,
        lastAction: {
          type: "PLACE_BID",
          teamName: team.name,
          amount,
          message: `Bid of ₹${amount.toLocaleString()} registered by ${team.name}`,
        },
      });

      return {
        success: true,
        message: `Bid ₹${amount.toLocaleString()} registered for ${team.name}`,
        state,
      };
    }

    case "SELECT_LOT": {
      const { playerId } = payload;
      let targetPlayer: Player | undefined;

      if (playerId) {
        targetPlayer = state.players.find((p) => p.id === playerId);
      } else {
        // Find next AVAILABLE player
        targetPlayer = state.players.find((p) => p.status === "AVAILABLE") || state.players[0];
      }

      if (!targetPlayer) {
        return { success: false, error: "No players available to spotlight", state };
      }

      const initialDuration = state.rules.initialTimerSeconds || 45;
      const expiryIso = new Date(Date.now() + initialDuration * 1000).toISOString();
      const basePrice = targetPlayer.basePriceOverride || targetPlayer.basePrice || 25000;

      // Mark player as ON_AUCTION
      state.players = state.players.map((p) =>
        p.id === targetPlayer!.id
          ? { ...p, status: "ON_AUCTION" }
          : p.status === "ON_AUCTION"
          ? { ...p, status: "AVAILABLE" }
          : p
      );

      state.session = {
        ...state.session,
        status: "IN_PROGRESS",
        currentPlayerId: targetPlayer.id,
        currentPlayer: { ...targetPlayer, status: "ON_AUCTION" },
        currentHighestBid: 0,
        currentLeadingTeamId: null,
        currentLeadingTeam: null,
        timerSeconds: initialDuration,
        timerExpiresAt: expiryIso,
        lastBidAt: undefined,
        bidCount: 0,
        recentBids: [],
      };

      broadcastEvent({
        type: "LOT_CHANGED",
        leagueId,
        timestamp: nowIso,
        session: state.session,
        players: state.players,
        lastAction: {
          type: "SELECT_LOT",
          playerName: targetPlayer.fullName,
          amount: basePrice,
          message: `Now on Auction: ${targetPlayer.fullName} (Base: ₹${basePrice.toLocaleString()})`,
        },
      });

      return {
        success: true,
        message: `Spotlighted ${targetPlayer.fullName}`,
        state,
      };
    }

    case "HAMMER_SOLD": {
      if (state.session.bidCount === 0 || !state.session.currentLeadingTeam || !state.session.currentPlayer) {
        return { success: false, error: "Cannot hammer lot: No valid bids received", state };
      }

      const soldPlayer = state.session.currentPlayer;
      const winner = state.session.currentLeadingTeam;
      const finalPrice = state.session.currentHighestBid;
      const soldPlayerId = soldPlayer.id;

      // 1. Update player status
      state.players = state.players.map((p) =>
        p.id === soldPlayerId
          ? { ...p, status: "SOLD", soldToTeamId: winner.id, soldPrice: finalPrice }
          : p
      );

      // 2. Deduct purse from winning team and increment squad
      state.teams = state.teams.map((t) => {
        if (t.id === winner.id) {
          const spent = (t.purse?.spentAmount || 0) + finalPrice;
          const totalBudget = t.purse?.totalBudget || 5000000;
          return {
            ...t,
            squadCount: (t.squadCount || 0) + 1,
            purse: {
              ...t.purse,
              spentAmount: spent,
              remainingAmount: totalBudget - spent,
            },
          };
        }
        return t;
      });

      // Update current leading team reference in state
      const updatedWinner = state.teams.find((t) => t.id === winner.id) || winner;

      state.session = {
        ...state.session,
        status: "IDLE",
        currentLeadingTeam: updatedWinner,
        currentPlayer: {
          ...soldPlayer,
          status: "SOLD",
          soldToTeamId: winner.id,
          soldPrice: finalPrice,
        },
      };

      broadcastEvent({
        type: "LOT_SOLD",
        leagueId,
        timestamp: nowIso,
        session: state.session,
        teams: state.teams,
        players: state.players,
        lastAction: {
          type: "HAMMER_SOLD",
          teamName: winner.name,
          playerName: soldPlayer.fullName,
          amount: finalPrice,
          message: `SOLD! ${soldPlayer.fullName} hammered to ${winner.name} for ₹${finalPrice.toLocaleString()}`,
        },
      });

      return {
        success: true,
        message: `SOLD: ${soldPlayer.fullName} to ${winner.name} for ₹${finalPrice.toLocaleString()}`,
        state,
      };
    }

    case "HAMMER_UNSOLD": {
      if (!state.session.currentPlayer) {
        return { success: false, error: "No player currently on auction", state };
      }

      const unsoldPlayer = state.session.currentPlayer;

      state.players = state.players.map((p) =>
        p.id === unsoldPlayer.id ? { ...p, status: "UNSOLD" } : p
      );

      state.session = {
        ...state.session,
        status: "IDLE",
        currentHighestBid: 0,
        currentLeadingTeamId: null,
        currentLeadingTeam: null,
        currentPlayer: {
          ...unsoldPlayer,
          status: "UNSOLD",
        },
      };

      broadcastEvent({
        type: "LOT_UNSOLD",
        leagueId,
        timestamp: nowIso,
        session: state.session,
        players: state.players,
        lastAction: {
          type: "HAMMER_UNSOLD",
          playerName: unsoldPlayer.fullName,
          message: `${unsoldPlayer.fullName} marked UNSOLD. Requeued for accelerated round.`,
        },
      });

      return {
        success: true,
        message: `${unsoldPlayer.fullName} marked UNSOLD`,
        state,
      };
    }

    case "PAUSE_RESUME": {
      if (state.session.status === "PAUSED") {
        // Resuming
        const restoredSeconds = state.pausedRemainingSeconds || 15;
        const newExpiry = new Date(Date.now() + restoredSeconds * 1000).toISOString();

        state.session = {
          ...state.session,
          status: "IN_PROGRESS",
          timerSeconds: restoredSeconds,
          timerExpiresAt: newExpiry,
        };
        state.pausedRemainingSeconds = undefined;

        broadcastEvent({
          type: "RESUMED",
          leagueId,
          timestamp: nowIso,
          session: state.session,
          lastAction: {
            type: "PAUSE_RESUME",
            message: `Auction clock resumed with ${restoredSeconds}s remaining`,
          },
        });

        return { success: true, message: "Auction resumed", state };
      } else {
        // Pausing
        const remaining = Math.max(
          1,
          state.session.timerExpiresAt
            ? Math.ceil((new Date(state.session.timerExpiresAt).getTime() - Date.now()) / 1000)
            : state.session.timerSeconds
        );

        state.pausedRemainingSeconds = remaining;
        state.session = {
          ...state.session,
          status: "PAUSED",
          timerSeconds: remaining,
        };

        broadcastEvent({
          type: "PAUSED",
          leagueId,
          timestamp: nowIso,
          session: state.session,
          lastAction: {
            type: "PAUSE_RESUME",
            message: `Auction paused by administrator (${remaining}s held)`,
          },
        });

        return { success: true, message: "Auction paused", state };
      }
    }

    case "UNDO": {
      if (state.session.recentBids.length === 0) {
        return { success: false, error: "No actions available to undo", state };
      }

      // Revert last bid
      const undoneBid = state.session.recentBids[0];
      const remainingBids = state.session.recentBids.slice(1);
      const prevBid = remainingBids[0];

      const extensionSeconds = state.rules.bidExtensionSeconds || 15;
      const restoredExpiry = new Date(Date.now() + extensionSeconds * 1000).toISOString();

      let restoredLeadingTeam: Team | null = null;
      if (prevBid) {
        restoredLeadingTeam = state.teams.find((t) => t.id === prevBid.teamId) || null;
      }

      const restoredAmount = prevBid ? prevBid.amount : 0;

      state.session = {
        ...state.session,
        currentHighestBid: restoredAmount,
        currentLeadingTeamId: prevBid ? prevBid.teamId : null,
        currentLeadingTeam: restoredLeadingTeam,
        bidCount: Math.max(0, state.session.bidCount - 1),
        recentBids: remainingBids,
        timerSeconds: extensionSeconds,
        timerExpiresAt: restoredExpiry,
      };

      broadcastEvent({
        type: "BID_UNDONE",
        leagueId,
        timestamp: nowIso,
        session: state.session,
        lastAction: {
          type: "UNDO",
          message: `Undid bid of ₹${undoneBid.amount.toLocaleString()}. Restored to ${restoredAmount > 0 ? `₹${restoredAmount.toLocaleString()}` : "Base"}`,
        },
      });

      return {
        success: true,
        message: `Undid last bid of ₹${undoneBid.amount.toLocaleString()}`,
        state,
      };
    }

    case "RESET_LOT": {
      const initialDuration = state.rules.initialTimerSeconds || 45;
      state.session = {
        ...state.session,
        currentHighestBid: 0,
        currentLeadingTeamId: null,
        currentLeadingTeam: null,
        bidCount: 0,
        recentBids: [],
        timerSeconds: initialDuration,
        timerExpiresAt: new Date(Date.now() + initialDuration * 1000).toISOString(),
        status: "IN_PROGRESS",
      };

      broadcastEvent({
        type: "LOT_RESET",
        leagueId,
        timestamp: nowIso,
        session: state.session,
        lastAction: {
          type: "RESET_LOT",
          message: "Current lot bidding ladder reset",
        },
      });

      return { success: true, message: "Lot reset", state };
    }

    case "UPDATE_TEAMS": {
      if (payload.teams) {
        state.teams = payload.teams;
        broadcastEvent({
          type: "TEAMS_UPDATED",
          leagueId,
          timestamp: nowIso,
          session: state.session,
          teams: state.teams,
        });
      }
      return { success: true, message: "Teams updated", state };
    }

    case "UPDATE_PLAYERS": {
      if (payload.players) {
        state.players = payload.players;
        broadcastEvent({
          type: "PLAYERS_UPDATED",
          leagueId,
          timestamp: nowIso,
          session: state.session,
          players: state.players,
        });
      }
      return { success: true, message: "Players updated", state };
    }

    case "UPDATE_RULES": {
      if (payload.rules) {
        state.rules = { ...state.rules, ...payload.rules };
        broadcastEvent({
          type: "RULES_UPDATED",
          leagueId,
          timestamp: nowIso,
          session: state.session,
          rules: state.rules,
        });
      }
      return { success: true, message: "Rules updated", state };
    }

    case "UPDATE_LEAGUE": {
      if (payload.league) {
        state.league = { ...state.league, ...payload.league };
        broadcastEvent({
          type: "LEAGUE_UPDATED",
          leagueId,
          timestamp: nowIso,
          session: state.session,
          league: state.league,
        });
      }
      return { success: true, message: "League updated", state };
    }

    default:
      return { success: false, error: `Unknown action type: ${type}`, state };
  }
}
