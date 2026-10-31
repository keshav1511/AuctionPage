// ==============================================================================
// NTL AUCTION PLATFORM - AUTHORITATIVE SERVER AUCTION STORE (GOOGLE SHEETS BACKED)
// Server-side authoritative state management with real-time event broadcasting
// Uses Google Sheets as the single source of truth for persistent data
// ==============================================================================

import { AuctionSession, Team, Player, AuctionRules, Bid, League } from "@/types";
import { getInitialLeagueById } from "@/lib/mock-data/leagues";
import {
  getLeagueConfigFromSheets,
  saveLeagueConfigToSheets,
  getTeamsFromSheets,
  saveTeamsToSheets,
  getPlayersFromSheets,
  savePlayersToSheets,
  getAuctionStateFromSheets,
  getRecentBidsFromSheets,
  markLastBidUndoneInSheets,
  executeSerializedAuctionAction,
} from "@/lib/sheets/google-sheets-repository";
import { AuctionStateRow, PurchaseRecord, AuditLogEntry } from "@/lib/sheets/tab-definitions";

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
  actionId?: string;
  clientVersion?: number;
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
  listeners: Map<string, Set<EventListener>>;
}

// Global process singleton to persist SSE listeners across re-evaluations
const globalState: StoreGlobalState = ((globalThis as unknown as Record<string, unknown>).__ntl_auction_listeners__ as StoreGlobalState) || {
  listeners: new Map<string, Set<EventListener>>(),
};

if (process.env.NODE_ENV !== "production") {
  (globalThis as unknown as Record<string, unknown>).__ntl_auction_listeners__ = globalState;
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
export function broadcastEvent(event: AuctionRealtimeEvent) {
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
 * Maps raw sheets AuctionStateRow + entities into client-facing AuctionSession
 */
function buildAuctionSession(
  state: AuctionStateRow,
  players: Player[],
  teams: Team[],
  recentBids: Bid[],
  rules: AuctionRules
): AuctionSession {
  const currentPlayer = state.currentPlayerId
    ? players.find((p) => p.id === state.currentPlayerId) || null
    : null;

  const currentLeadingTeam = state.currentLeadingTeamId
    ? teams.find((t) => t.id === state.currentLeadingTeamId) || null
    : null;

  return {
    id: state.id,
    seasonId: state.seasonId,
    currentPlayerId: state.currentPlayerId,
    currentPlayer,
    currentHighestBid: state.currentHighestBid || 0,
    currentLeadingTeamId: state.currentLeadingTeamId,
    currentLeadingTeam,
    status: state.status,
    timerSeconds: state.timerSeconds || rules.initialTimerSeconds || 45,
    timerExpiresAt: state.timerExpiresAt,
    bidExtensionSeconds: state.bidExtensionSeconds || rules.bidExtensionSeconds || 10,
    round: state.round || 1,
    bidCount: state.bidCount || 0,
    recentBids,
  };
}

/**
 * Retrieves authoritative state for a league from Google Sheets
 * Automatically checks and resolves expired lots with 0 bids to UNSOLD on the server
 */
export async function getAuthoritativeLeagueState(leagueId: string): Promise<LeagueState | null> {
  if (!leagueId || typeof leagueId !== "string") {
    return null;
  }

  const config = await getLeagueConfigFromSheets(leagueId);
  if (!config.league || (!config.league.name && !getInitialLeagueById(leagueId))) {
    return null;
  }

  const [stateRow, teams, players, recentBids] = await Promise.all([
    getAuctionStateFromSheets(leagueId),
    getTeamsFromSheets(leagueId),
    getPlayersFromSheets(leagueId),
    getRecentBidsFromSheets(leagueId, 20),
  ]);

  // Server-side wall-clock timer check: auto-resolve expired lot to UNSOLD
  const now = Date.now();
  const expiryTime = stateRow.timerExpiresAt ? new Date(stateRow.timerExpiresAt).getTime() : 0;

  if (
    stateRow.status === "IN_PROGRESS" &&
    expiryTime > 0 &&
    now >= expiryTime &&
    stateRow.currentHighestBid === 0 &&
    stateRow.currentPlayerId
  ) {
    // Automatically trigger server-side UNSOLD resolution
    try {
      await processAuctionAction({
        leagueId,
        type: "HAMMER_UNSOLD",
        playerId: stateRow.currentPlayerId,
        reason: "Timer expired with zero bids (Server-side auto hammer)",
      });
      // Re-fetch after auto-resolution
      return getAuthoritativeLeagueState(leagueId);
    } catch (err) {
      console.error("[AuctionStore] Error during auto UNSOLD resolution:", err);
    }
  }

  const session = buildAuctionSession(stateRow, players, teams, recentBids, config.rules);

  return {
    league: config.league,
    rules: config.rules,
    teams,
    players,
    session,
    pausedRemainingSeconds: stateRow.pausedRemainingSeconds,
  };
}

/**
 * Processes an authoritative auction action on the server through Google Sheets serialized write lock
 */
export async function processAuctionAction(payload: AuctionActionPayload): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  state?: LeagueState;
}> {
  const { leagueId, type } = payload;
  const nowIso = new Date().toISOString();

  // Handle UPDATE_LEAGUE directly if updating configuration
  if (type === "UPDATE_LEAGUE" && payload.league) {
    const config = await getLeagueConfigFromSheets(leagueId);
    const updatedLeague: League = {
      ...config.league,
      ...payload.league,
      id: leagueId,
      name: payload.league.name || config.league.name || "Nalanda Turf League",
      primaryColor: payload.league.primaryColor || config.league.primaryColor || "#059669",
      secondaryColor: payload.league.secondaryColor || config.league.secondaryColor || "#F59E0B",
    };

    await saveLeagueConfigToSheets(updatedLeague, config.rules);
    const freshState = await getAuthoritativeLeagueState(leagueId);
    if (freshState) {
      broadcastEvent({
        type: "LEAGUE_UPDATED",
        leagueId,
        timestamp: nowIso,
        session: freshState.session,
        league: freshState.league,
      });
      return { success: true, message: "League configuration updated", state: freshState };
    }
  }

  // Handle UPDATE_RULES directly
  if (type === "UPDATE_RULES" && payload.rules) {
    const config = await getLeagueConfigFromSheets(leagueId);
    const updatedRules: AuctionRules = {
      ...config.rules,
      ...payload.rules,
      seasonId: leagueId,
    };

    await saveLeagueConfigToSheets(config.league, updatedRules);
    const freshState = await getAuthoritativeLeagueState(leagueId);
    if (freshState) {
      broadcastEvent({
        type: "RULES_UPDATED",
        leagueId,
        timestamp: nowIso,
        session: freshState.session,
        rules: freshState.rules,
      });
      return { success: true, message: "Auction rules updated", state: freshState };
    }
  }

  // Handle UPDATE_TEAMS directly
  if (type === "UPDATE_TEAMS" && payload.teams) {
    await saveTeamsToSheets(leagueId, payload.teams);
    const freshState = await getAuthoritativeLeagueState(leagueId);
    if (freshState) {
      broadcastEvent({
        type: "TEAMS_UPDATED",
        leagueId,
        timestamp: nowIso,
        session: freshState.session,
        teams: freshState.teams,
      });
      return { success: true, message: "Teams updated", state: freshState };
    }
  }

  // Handle UPDATE_PLAYERS directly
  if (type === "UPDATE_PLAYERS" && payload.players) {
    await savePlayersToSheets(leagueId, payload.players);
    const freshState = await getAuthoritativeLeagueState(leagueId);
    if (freshState) {
      broadcastEvent({
        type: "PLAYERS_UPDATED",
        leagueId,
        timestamp: nowIso,
        session: freshState.session,
        players: freshState.players,
      });
      return { success: true, message: "Players updated", state: freshState };
    }
  }

  // Execute bidding and lifecycle actions inside serialized transaction
  const txResult = await executeSerializedAuctionAction(leagueId, async (ctx) => {
    const { state, teams, players, rules, recentBids } = ctx;

    switch (type) {
      case "PLACE_BID": {
        const { teamId, amount } = payload;
        if (!teamId || typeof amount !== "number" || amount <= 0) {
          return { success: false, error: "Invalid team or bid amount" };
        }

        if (state.status === "PAUSED") {
          return { success: false, error: "Auction is paused. Resume before accepting bids." };
        }

        const team = teams.find((t) => t.id === teamId);
        if (!team) {
          return { success: false, error: "Franchise not found" };
        }

        const currentHighest = state.currentHighestBid || 0;
        if (amount <= currentHighest && state.bidCount > 0) {
          return {
            success: false,
            error: `Bid of ₹${amount.toLocaleString()} must strictly exceed current highest bid of ₹${currentHighest.toLocaleString()}`,
          };
        }

        // Validate squad reserve rules
        const currentSquad = team.squadCount || 0;
        const minPlayers = team.purse?.minPlayers || 15;
        const minRequiredReserve = Math.max(0, minPlayers - currentSquad - 1) * 25000;
        const remainingAmount = team.purse?.remainingAmount || 5000000;

        if (remainingAmount - amount < minRequiredReserve) {
          return {
            success: false,
            error: `Purse Reserve Violation: ${team.name} must retain ₹${minRequiredReserve.toLocaleString()} for minimum squad spots`,
          };
        }

        // Authoritative timer extension (+10s or configured extension)
        const extensionSeconds = rules.bidExtensionSeconds || 10;
        const newExpiryTime = Date.now() + extensionSeconds * 1000;
        const newExpiryIso = new Date(newExpiryTime).toISOString();

        const newBid: Bid = {
          id: `bid-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          auctionId: state.id,
          playerId: state.currentPlayerId || "",
          teamId: team.id,
          teamName: team.name,
          teamShortCode: team.shortCode,
          teamLogoUrl: team.logoUrl,
          amount,
          bidType: state.bidCount === 0 ? "BASE" : "STANDARD",
          placedAt: nowIso,
        };

        const newState: AuctionStateRow = {
          ...state,
          status: "IN_PROGRESS",
          currentHighestBid: amount,
          currentLeadingTeamId: team.id,
          timerSeconds: extensionSeconds,
          timerExpiresAt: newExpiryIso,
          bidCount: (state.bidCount || 0) + 1,
        };

        const auditEntry: AuditLogEntry = {
          id: `audit-${Date.now()}`,
          seasonId: leagueId,
          actionType: "BID_PLACED",
          actor: "AUCTIONEER",
          detailsJson: JSON.stringify({ team: team.name, amount, player: state.currentPlayerId }),
          timestamp: nowIso,
        };

        return {
          success: true,
          message: `Bid ₹${amount.toLocaleString()} registered by ${team.name}`,
          newState,
          newBid,
          auditEntry,
        };
      }

      case "SELECT_LOT": {
        const { playerId } = payload;
        let targetPlayer: Player | undefined;

        if (playerId) {
          targetPlayer = players.find((p) => p.id === playerId);
        } else {
          targetPlayer = players.find((p) => p.status === "AVAILABLE") || players[0];
        }

        if (!targetPlayer) {
          return { success: false, error: "No players available to spotlight" };
        }

        const initialDuration = rules.initialTimerSeconds || 45;
        const expiryIso = new Date(Date.now() + initialDuration * 1000).toISOString();
        const basePrice = targetPlayer.basePriceOverride || targetPlayer.basePrice || 25000;

        const updatedPlayers = players.map((p) =>
          p.id === targetPlayer!.id
            ? { ...p, status: "ON_AUCTION" as const }
            : p.status === "ON_AUCTION"
            ? { ...p, status: "AVAILABLE" as const }
            : p
        );

        const newState: AuctionStateRow = {
          ...state,
          currentPlayerId: targetPlayer.id,
          currentHighestBid: 0,
          currentLeadingTeamId: null,
          timerSeconds: initialDuration,
          timerExpiresAt: expiryIso,
          status: "IN_PROGRESS",
          bidCount: 0,
        };

        const auditEntry: AuditLogEntry = {
          id: `audit-${Date.now()}`,
          seasonId: leagueId,
          actionType: "LOT_SELECTED",
          actor: "AUCTIONEER",
          detailsJson: JSON.stringify({ player: targetPlayer.fullName, basePrice }),
          timestamp: nowIso,
        };

        return {
          success: true,
          message: `Spotlighted ${targetPlayer.fullName} (Base: ₹${basePrice.toLocaleString()})`,
          newState,
          updatedPlayers,
          auditEntry,
        };
      }

      case "HAMMER_SOLD": {
        if (!state.currentPlayerId) {
          return { success: false, error: "No player currently on auction" };
        }

        if (!state.currentLeadingTeamId || state.currentHighestBid <= 0) {
          return { success: false, error: "Cannot sell lot without any valid bids" };
        }

        const soldPlayer = players.find((p) => p.id === state.currentPlayerId);
        const buyerTeam = teams.find((t) => t.id === state.currentLeadingTeamId);

        if (!soldPlayer || !buyerTeam) {
          return { success: false, error: "Player or winning franchise not found" };
        }

        const finalPrice = state.currentHighestBid;

        // Deduct purse and increment squad count
        const updatedTeams = teams.map((t) => {
          if (t.id === buyerTeam.id) {
            const currentSpent = t.purse?.spentAmount || 0;
            const newSpent = currentSpent + finalPrice;
            const newRemaining = (t.purse?.totalBudget || 5000000) - newSpent;
            const newSquadCount = (t.squadCount || 0) + 1;
            const minPlayers = t.purse?.minPlayers || 15;
            const reserved = Math.max(0, minPlayers - newSquadCount) * 25000;

            return {
              ...t,
              squadCount: newSquadCount,
              purse: {
                ...t.purse,
                spentAmount: newSpent,
                remainingAmount: newRemaining,
                reservedForSquad: reserved,
              },
            };
          }
          return t;
        });

        const updatedPlayers = players.map((p) =>
          p.id === soldPlayer.id
            ? { ...p, status: "SOLD" as const, soldToTeamId: buyerTeam.id, soldPrice: finalPrice }
            : p
        );

        // Find next AVAILABLE player
        const nextPlayer = updatedPlayers.find((p) => p.status === "AVAILABLE");
        const initialDuration = rules.initialTimerSeconds || 45;

        const newState: AuctionStateRow = {
          ...state,
          currentPlayerId: nextPlayer ? nextPlayer.id : null,
          currentHighestBid: 0,
          currentLeadingTeamId: null,
          timerSeconds: initialDuration,
          timerExpiresAt: new Date(Date.now() + initialDuration * 1000).toISOString(),
          status: nextPlayer ? "IN_PROGRESS" : "FINISHED",
          bidCount: 0,
          round: state.round || 1,
        };

        const newPurchase: PurchaseRecord = {
          id: `purchase-${soldPlayer.id}`,
          seasonId: leagueId,
          playerId: soldPlayer.id,
          playerName: soldPlayer.fullName,
          playerCategory: soldPlayer.category,
          playerRole: soldPlayer.primaryRole,
          teamId: buyerTeam.id,
          teamName: buyerTeam.name,
          soldPrice: finalPrice,
          round: state.round || 1,
          soldAt: nowIso,
        };

        const auditEntry: AuditLogEntry = {
          id: `audit-${Date.now()}`,
          seasonId: leagueId,
          actionType: "LOT_SOLD",
          actor: "AUCTIONEER",
          detailsJson: JSON.stringify({ player: soldPlayer.fullName, buyer: buyerTeam.name, price: finalPrice }),
          timestamp: nowIso,
        };

        return {
          success: true,
          message: `SOLD! ${soldPlayer.fullName} acquired by ${buyerTeam.name} for ₹${finalPrice.toLocaleString()}`,
          newState,
          updatedTeams,
          updatedPlayers,
          newPurchase,
          auditEntry,
        };
      }

      case "HAMMER_UNSOLD": {
        if (!state.currentPlayerId) {
          return { success: false, error: "No player currently on auction" };
        }

        const unsoldPlayer = players.find((p) => p.id === state.currentPlayerId);
        if (!unsoldPlayer) {
          return { success: false, error: "Target lot player not found" };
        }

        const updatedPlayers = players.map((p) =>
          p.id === unsoldPlayer.id ? { ...p, status: "UNSOLD" as const } : p
        );

        const nextPlayer = updatedPlayers.find((p) => p.status === "AVAILABLE");
        const initialDuration = rules.initialTimerSeconds || 45;

        const newState: AuctionStateRow = {
          ...state,
          currentPlayerId: nextPlayer ? nextPlayer.id : null,
          currentHighestBid: 0,
          currentLeadingTeamId: null,
          timerSeconds: initialDuration,
          timerExpiresAt: new Date(Date.now() + initialDuration * 1000).toISOString(),
          status: nextPlayer ? "IN_PROGRESS" : "FINISHED",
          bidCount: 0,
        };

        const auditEntry: AuditLogEntry = {
          id: `audit-${Date.now()}`,
          seasonId: leagueId,
          actionType: "LOT_UNSOLD",
          actor: "AUCTIONEER",
          detailsJson: JSON.stringify({ player: unsoldPlayer.fullName, reason: payload.reason || "Passed" }),
          timestamp: nowIso,
        };

        return {
          success: true,
          message: `${unsoldPlayer.fullName} marked UNSOLD`,
          newState,
          updatedPlayers,
          auditEntry,
        };
      }

      case "PAUSE_RESUME": {
        if (state.status === "PAUSED") {
          // Resume countdown
          const remainingSeconds = state.pausedRemainingSeconds || state.timerSeconds || 15;
          const newExpiryIso = new Date(Date.now() + remainingSeconds * 1000).toISOString();

          const newState: AuctionStateRow = {
            ...state,
            status: "IN_PROGRESS",
            timerSeconds: remainingSeconds,
            timerExpiresAt: newExpiryIso,
            pausedRemainingSeconds: undefined,
          };

          return { success: true, message: "Auction resumed", newState };
        } else {
          // Pause countdown
          const nowMs = Date.now();
          const expiryMs = new Date(state.timerExpiresAt).getTime();
          const remaining = Math.max(1, Math.round((expiryMs - nowMs) / 1000));

          const newState: AuctionStateRow = {
            ...state,
            status: "PAUSED",
            timerSeconds: remaining,
            pausedRemainingSeconds: remaining,
          };

          return { success: true, message: `Auction paused (${remaining}s remaining)`, newState };
        }
      }

      case "UNDO": {
        const undoneBid = await markLastBidUndoneInSheets(leagueId);
        if (!undoneBid) {
          return { success: false, error: "No active bids available to undo" };
        }

        const remainingBids = recentBids.filter((b) => b.id !== undoneBid.id);
        const prevBid = remainingBids[0];
        const extensionSeconds = rules.bidExtensionSeconds || 15;
        const restoredExpiry = new Date(Date.now() + extensionSeconds * 1000).toISOString();

        const newState: AuctionStateRow = {
          ...state,
          currentHighestBid: prevBid ? prevBid.amount : 0,
          currentLeadingTeamId: prevBid ? prevBid.teamId : null,
          bidCount: Math.max(0, (state.bidCount || 1) - 1),
          timerSeconds: extensionSeconds,
          timerExpiresAt: restoredExpiry,
        };

        const auditEntry: AuditLogEntry = {
          id: `audit-${Date.now()}`,
          seasonId: leagueId,
          actionType: "UNDO_BID",
          actor: "AUCTIONEER",
          detailsJson: JSON.stringify({ undoneBid: undoneBid.amount, team: undoneBid.teamName }),
          timestamp: nowIso,
        };

        return {
          success: true,
          message: `Undid last bid of ₹${undoneBid.amount.toLocaleString()}`,
          newState,
          auditEntry,
        };
      }

      case "RESET_LOT": {
        const initialDuration = rules.initialTimerSeconds || 45;
        const newState: AuctionStateRow = {
          ...state,
          currentHighestBid: 0,
          currentLeadingTeamId: null,
          bidCount: 0,
          timerSeconds: initialDuration,
          timerExpiresAt: new Date(Date.now() + initialDuration * 1000).toISOString(),
          status: "IN_PROGRESS",
        };

        return { success: true, message: "Current lot bidding ladder reset", newState };
      }

      default:
        return { success: false, error: `Unsupported action type: ${type}` };
    }
  }, { actionId: payload.actionId, clientVersion: payload.clientVersion });

  if (!txResult.success) {
    return { success: false, error: txResult.error };
  }

  // Load fresh authoritative state and broadcast real-time SSE event
  const freshState = await getAuthoritativeLeagueState(leagueId);
  if (freshState) {
    let eventType = "AUCTION_UPDATED";
    if (type === "PLACE_BID") eventType = "BID_PLACED";
    else if (type === "HAMMER_SOLD") eventType = "LOT_SOLD";
    else if (type === "HAMMER_UNSOLD") eventType = "LOT_UNSOLD";
    else if (type === "SELECT_LOT") eventType = "LOT_CHANGED";
    else if (type === "PAUSE_RESUME") eventType = freshState.session.status === "PAUSED" ? "PAUSED" : "RESUMED";
    else if (type === "UNDO") eventType = "BID_UNDONE";
    else if (type === "RESET_LOT") eventType = "LOT_RESET";

    broadcastEvent({
      type: eventType,
      leagueId,
      timestamp: nowIso,
      session: freshState.session,
      teams: freshState.teams,
      players: freshState.players,
      rules: freshState.rules,
      league: freshState.league,
      lastAction: {
        type,
        message: txResult.message,
      },
    });

    return {
      success: true,
      message: txResult.message,
      state: freshState,
    };
  }

  return { success: true, message: txResult.message };
}
