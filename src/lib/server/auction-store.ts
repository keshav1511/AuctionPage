// ==============================================================================
// NTL AUCTION PLATFORM - AUTHORITATIVE SERVER AUCTION STORE (GOOGLE SHEETS BACKED)
// Server-side authoritative state management with real-time event broadcasting
// Uses Google Sheets as the single source of truth for persistent data
// ==============================================================================

import {
  AuctionSession,
  Team,
  Player,
  AuctionRules,
  Bid,
  League,
  Round2QueueItem,
  AuctionAnnouncement,
} from "@/types";
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
import { validateBidEligibility } from "@/lib/auction/purse-validator";
import { getTeamParticipantCounts, formatTeamParticipantBreakdown } from "@/lib/auction/team-size-calculator";
import {
  detectRound1Completion,
  getEligibleRound2Players,
  createRound2Queue,
} from "@/lib/auction/round-manager";

export type AuctionActionType =
  | "PLACE_BID"
  | "SELECT_LOT"
  | "HAMMER_SOLD"
  | "HAMMER_UNSOLD"
  | "PAUSE_RESUME"
  | "UNDO"
  | "RESET_LOT"
  | "INIT_ROUND_2"
  | "START_ROUND_2"
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
  revision?: number;
  session?: AuctionSession;
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
    ? players.find(
        (p) =>
          p.id === state.currentPlayerId ||
          p.registrationNo === state.currentPlayerId ||
          (p.fullName && p.fullName === state.currentPlayerId)
      ) || null
    : null;

  const currentLeadingTeam = state.currentLeadingTeamId
    ? teams.find(
        (t) =>
          t.id === state.currentLeadingTeamId ||
          t.shortCode === state.currentLeadingTeamId
      ) || null
    : null;

  let round2Queue: Round2QueueItem[] | undefined;
  try {
    if (state.round2QueueJson) {
      const parsed = JSON.parse(state.round2QueueJson);
      if (Array.isArray(parsed)) {
        round2Queue = parsed.map((item) =>
          typeof item === "string" ? { id: item, status: "PENDING" as const } : item
        );
      }
    }
  } catch {}

  let announcement: AuctionAnnouncement | null = null;
  try {
    if (state.announcementJson) {
      const parsed = JSON.parse(state.announcementJson);
      if (parsed && parsed.type && parsed.type !== "NONE") {
        const nowMs = Date.now();
        const endsAtMs = parsed.endsAt ? new Date(parsed.endsAt).getTime() : 0;
        if (nowMs < endsAtMs) {
          const annPlayer = parsed.playerId
            ? players.find((p) => p.id === parsed.playerId) || null
            : null;
          const annTeam = parsed.winningTeamId
            ? teams.find((t) => t.id === parsed.winningTeamId) || null
            : null;
          announcement = {
            ...parsed,
            player: annPlayer,
            winningTeam: annTeam,
          };
        }
      }
    }
  } catch {}

  const stateVersion = Number(state.version) || 1;

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
    roundStage: state.roundStage || (state.round === 2 ? "ROUND_2" : "MAIN"),
    round2Queue,
    round2InitializedAt: state.round2InitializedAt,
    round1Completed: state.round1Completed,
    announcement,
    bidCount: state.bidCount || 0,
    recentBids,
    version: stateVersion,
    revision: stateVersion,
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
}

// Coalesce in-flight timer resolution to guarantee an expired lot is processed exactly once
const inFlightTimerResolutions = new Map<string, Promise<{ success: boolean; actionTaken: string; details?: Record<string, unknown> }>>();

/**
 * Idempotent request-driven auction timer processor.
 * Resolves expired lots without requiring Vercel Cron.
 * Checks whether the lot should be marked SOLD (with leading bid) or UNSOLD (zero bids),
 * preserves 5-second announcement windows, and advances according to tournament rules.
 */
export async function checkAndProcessAuctionTimer(
  leagueId: string
): Promise<{ success: boolean; actionTaken: string; details?: Record<string, unknown> }> {
  try {
    const stateRow = await getAuctionStateFromSheets(leagueId);

    // 1. Guard: Only in-progress auctions with an active player and expiry timestamp can expire
    if (stateRow.status !== "IN_PROGRESS" || !stateRow.currentPlayerId || !stateRow.timerExpiresAt) {
      return { success: true, actionTaken: `NO_OP_${stateRow.status}` };
    }

    const now = Date.now();
    const expiryTimeMs = new Date(stateRow.timerExpiresAt).getTime();

    // 2. Guard: Timer has not expired yet
    if (now < expiryTimeMs) {
      return {
        success: true,
        actionTaken: "TIMER_ACTIVE",
        details: { remainingSeconds: Math.ceil((expiryTimeMs - now) / 1000) },
      };
    }

    // 3. Guard: 5-second announcement window protection
    // If an announcement is currently active, freeze the timer and do not process expiry
    if (stateRow.announcementJson) {
      try {
        const ann = JSON.parse(stateRow.announcementJson);
        if (ann && ann.endsAt && now < new Date(ann.endsAt).getTime()) {
          return {
            success: true,
            actionTaken: "ANNOUNCEMENT_ACTIVE",
            details: { announcementRemainingMs: new Date(ann.endsAt).getTime() - now },
          };
        }
      } catch {}
    }

    // 4. Coalesce concurrent timer resolutions for (leagueId, currentPlayerId, version)
    const resolutionKey = `${leagueId}:${stateRow.currentPlayerId}:v${stateRow.version}`;
    if (inFlightTimerResolutions.has(resolutionKey)) {
      return inFlightTimerResolutions.get(resolutionKey)!;
    }

    const resolutionPromise = (async () => {
      try {
        // Re-verify latest state inside resolution to protect against race conditions
        const latestState = await getAuctionStateFromSheets(leagueId, true);
        if (
          latestState.status !== "IN_PROGRESS" ||
          latestState.currentPlayerId !== stateRow.currentPlayerId ||
          latestState.version !== stateRow.version
        ) {
          return { success: true, actionTaken: "ALREADY_RESOLVED" };
        }

        const hasWinningBid =
          (latestState.currentHighestBid || 0) > 0 && Boolean(latestState.currentLeadingTeamId);

        if (hasWinningBid) {
          const actionRes = await processAuctionAction({
            leagueId,
            type: "HAMMER_SOLD",
            playerId: latestState.currentPlayerId ?? undefined,
            reason: "Request-Driven Timer: Authoritative timer expired with active bid",
            actionId: `timer-sold-${leagueId}-${latestState.currentPlayerId}-v${latestState.version}`,
            clientVersion: latestState.version,
          });

          return {
            success: actionRes.success,
            actionTaken: "HAMMER_SOLD",
            details: {
              playerId: latestState.currentPlayerId,
              winningTeamId: latestState.currentLeadingTeamId,
              soldPrice: latestState.currentHighestBid,
              message: actionRes.message,
            },
          };
        } else {
          const actionRes = await processAuctionAction({
            leagueId,
            type: "HAMMER_UNSOLD",
            playerId: latestState.currentPlayerId ?? undefined,
            reason: "Request-Driven Timer: Authoritative timer expired with zero bids",
            actionId: `timer-unsold-${leagueId}-${latestState.currentPlayerId}-v${latestState.version}`,
            clientVersion: latestState.version,
          });

          return {
            success: actionRes.success,
            actionTaken: "HAMMER_UNSOLD",
            details: {
              playerId: latestState.currentPlayerId,
              message: actionRes.message,
            },
          };
        }
      } finally {
        inFlightTimerResolutions.delete(resolutionKey);
      }
    })();

    inFlightTimerResolutions.set(resolutionKey, resolutionPromise);
    return resolutionPromise;
  } catch (err) {
    console.error(`[AuctionStore] Error checking auction timer for ${leagueId}:`, err);
    return { success: false, actionTaken: "ERROR", details: { error: (err as Error).message } };
  }
}

/**
 * Retrieves authoritative state for a league from Google Sheets
 * Automatically checks and executes request-driven timer transitions on the server
 */
export async function getAuthoritativeLeagueState(leagueId: string): Promise<LeagueState | null> {
  if (!leagueId || typeof leagueId !== "string") {
    return null;
  }

  const config = await getLeagueConfigFromSheets(leagueId);
  if (!config.league || (!config.league.name && !getInitialLeagueById(leagueId))) {
    return null;
  }

  // Request-driven timer processing: evaluate expiration before reading snapshot
  await checkAndProcessAuctionTimer(leagueId).catch((err) => {
    console.error(`[AuctionStore] Request-driven timer evaluation warning for ${leagueId}:`, err);
  });

  const [stateRow, teams, players, recentBids] = await Promise.all([
    getAuctionStateFromSheets(leagueId),
    getTeamsFromSheets(leagueId),
    getPlayersFromSheets(leagueId),
    getRecentBidsFromSheets(leagueId, 20),
  ]);

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
      name: payload.league.name || config.league.name || "Cricket Auction",
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
        revision: freshState.session.revision || freshState.session.version || 1,
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
        revision: freshState.session.revision || freshState.session.version || 1,
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
        revision: freshState.session.revision || freshState.session.version || 1,
        session: freshState.session,
        teams: freshState.teams,
      });
      return { success: true, message: "Teams updated", state: freshState };
    }
  }

  // Handle UPDATE_PLAYERS directly with Active Auction Protection
  if (type === "UPDATE_PLAYERS" && payload.players) {
    const currentState = await getAuctionStateFromSheets(leagueId);
    if (currentState && (currentState.status === "IN_PROGRESS" || currentState.status === "PAUSED" || currentState.status === "FINISHED")) {
      const existingPlayers = await getPlayersFromSheets(leagueId);
      const soldPlayers = existingPlayers.filter((p) => p.status === "SOLD");

      // Verify that all sold players are preserved intact
      for (const sp of soldPlayers) {
        const matchingUpdated = payload.players.find((p) => p.id === sp.id);
        if (!matchingUpdated || matchingUpdated.status !== "SOLD" || matchingUpdated.soldToTeamId !== sp.soldToTeamId) {
          return {
            success: false,
            error: `Cannot modify or delete player "${sp.fullName}" who is already SOLD during an active auction.`,
          };
        }
      }
    }

    await savePlayersToSheets(leagueId, payload.players);
    const freshState = await getAuthoritativeLeagueState(leagueId);
    if (freshState) {
      broadcastEvent({
        type: "PLAYERS_UPDATED",
        leagueId,
        timestamp: nowIso,
        revision: freshState.session.revision || freshState.session.version || 1,
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

        // Authoritative Dynamic Minimum Purse Reserve & Maximum Bid Validation (Phase 5.3)
        const currentPlayer = state.currentPlayerId
          ? players.find((p) => p.id === state.currentPlayerId) || null
          : null;

        // Ensure player has a configured base price (> 0); reject unset or ₹0 base price bidding
        const effectiveBasePrice =
          currentPlayer?.basePriceOverride ||
          currentPlayer?.basePrice ||
          rules.basePrice ||
          0;

        if (effectiveBasePrice <= 0) {
          return {
            success: false,
            error: `Cannot place bid: Player "${currentPlayer?.fullName || state.currentPlayerId}" has no configured base price (unset / ₹0). An administrator must configure a base price before opening bidding.`,
          };
        }

        const currentHighest = state.currentHighestBid || 0;
        if (state.bidCount === 0) {
          if (amount < effectiveBasePrice) {
            return {
              success: false,
              error: `Opening bid of ₹${amount.toLocaleString()} must be at least player base price of ₹${effectiveBasePrice.toLocaleString()}`,
            };
          }
        } else if (amount <= currentHighest) {
          return {
            success: false,
            error: `Bid of ₹${amount.toLocaleString()} must strictly exceed current highest bid of ₹${currentHighest.toLocaleString()}`,
          };
        }

        // Accurate count of valid purchased players (unsold players strictly excluded)
        const teamPurchasedPlayers = players.filter(
          (p) => p.status === "SOLD" && p.soldToTeamId === team.id
        );

        // Enforce team squad completion and limit restriction using total participants:
        // Total Team Size = Registered Players + Team Owner (1 if assigned) + Team Icon (1 if assigned)
        const counts = getTeamParticipantCounts(team, teamPurchasedPlayers.length);
        const minSquadSize = team.purse?.minPlayers || rules.minimumSquadSize || 15;
        const maxSquadSize = team.purse?.maxPlayers || 18;

        if (counts.totalParticipants >= minSquadSize) {
          return {
            success: false,
            error: `Team ${team.name} has already completed its required squad (${counts.totalParticipants}/${minSquadSize} participants). Current count: ${formatTeamParticipantBreakdown(counts)}.`,
          };
        }

        if (counts.totalParticipants >= maxSquadSize) {
          return {
            success: false,
            error: `Squad limit reached (${counts.totalParticipants}/${maxSquadSize} participants). Current count: ${formatTeamParticipantBreakdown(counts)}.`,
          };
        }

        const bidValidation = validateBidEligibility(team, amount, {
          rules,
          currentPlayer,
          isCurrentLeadingTeam: state.currentLeadingTeamId === team.id,
          allPurchasedPlayersForTeam: teamPurchasedPlayers,
        });

        if (!bidValidation.valid) {
          return {
            success: false,
            error: bidValidation.error || "Bid violates minimum purse reserve rules",
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

        if (state.round === 2) {
          let queue: Round2QueueItem[] = [];
          try {
            if (state.round2QueueJson) queue = JSON.parse(state.round2QueueJson);
          } catch {}

          if (playerId) {
            targetPlayer = players.find((p) => p.id === playerId);
          } else {
            const nextPending = queue.find((item) => item.status === "PENDING");
            if (nextPending) {
              targetPlayer = players.find((p) => p.id === nextPending.id);
            }
          }

          if (!targetPlayer) {
            return { success: false, error: "No pending players available in Round 2 queue" };
          }
        } else {
          if (playerId) {
            targetPlayer = players.find((p) => p.id === playerId);
          } else {
            targetPlayer = players.find((p) => p.status === "AVAILABLE") || players[0];
          }

          if (!targetPlayer) {
            return { success: false, error: "No players available to spotlight" };
          }
        }

        const initialDuration = rules.initialTimerSeconds || 45;
        const expiryIso = new Date(Date.now() + initialDuration * 1000).toISOString();
        const basePrice = targetPlayer.basePriceOverride || targetPlayer.basePrice || rules.basePrice || 0;

        const updatedPlayers = players.map((p) =>
          p.id === targetPlayer!.id
            ? { ...p, status: "ON_AUCTION" as const }
            : p.status === "ON_AUCTION"
            ? (state.round === 2 ? { ...p, status: "UNSOLD" as const } : { ...p, status: "AVAILABLE" as const })
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
          roundStage: state.round === 2 ? "ROUND_2" : "MAIN",
          bidCount: 0,
        };

        const auditEntry: AuditLogEntry = {
          id: `audit-${Date.now()}`,
          seasonId: leagueId,
          actionType: "LOT_SELECTED",
          actor: "AUCTIONEER",
          detailsJson: JSON.stringify({ player: targetPlayer.fullName, basePrice, round: state.round || 1 }),
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

      case "INIT_ROUND_2": {
        // Idempotency: If Round 2 queue already exists, do not re-randomize or duplicate
        let existingQueue: Round2QueueItem[] = [];
        try {
          if (state.round2QueueJson) existingQueue = JSON.parse(state.round2QueueJson);
        } catch {}

        if (state.round === 2 && existingQueue.length > 0) {
          return {
            success: true,
            message: "Round 2 queue is already initialized",
            newState: state,
          };
        }

        const isR1Done = detectRound1Completion(players);
        if (!isR1Done) {
          return {
            success: false,
            error: "Cannot initialize Round 2: First-round players are still pending or on auction",
          };
        }

        const eligibleUnsold = getEligibleRound2Players(players);
        if (eligibleUnsold.length === 0) {
          return {
            success: false,
            error: "No unsold players eligible for Round 2. All players were sold!",
          };
        }

        const { queue } = createRound2Queue(eligibleUnsold);
        const newState: AuctionStateRow = {
          ...state,
          currentPlayerId: null,
          currentHighestBid: 0,
          currentLeadingTeamId: null,
          timerSeconds: 0,
          status: "PAUSED",
          round: 2,
          roundStage: "ROUND_2_TRANSITION",
          round2QueueJson: JSON.stringify(queue),
          round2InitializedAt: nowIso,
          round1Completed: true,
          bidCount: 0,
        };

        const auditEntry: AuditLogEntry = {
          id: `audit-${Date.now()}`,
          seasonId: leagueId,
          actionType: "ROUND_INITIALIZED",
          actor: "AUCTIONEER",
          detailsJson: JSON.stringify({ round: 2, eligibleCount: eligibleUnsold.length }),
          timestamp: nowIso,
        };

        return {
          success: true,
          message: `ROUND 2 initialized with ${eligibleUnsold.length} unsold players`,
          newState,
          auditEntry,
        };
      }

      case "START_ROUND_2": {
        let queue: Round2QueueItem[] = [];
        try {
          if (state.round2QueueJson) queue = JSON.parse(state.round2QueueJson);
        } catch {}

        if (queue.length === 0) {
          const eligibleUnsold = getEligibleRound2Players(players);
          if (eligibleUnsold.length === 0) {
            return { success: false, error: "No unsold players available for Round 2" };
          }
          const created = createRound2Queue(eligibleUnsold);
          queue = created.queue;
        }

        const firstPending = queue.find((item) => item.status === "PENDING");
        if (!firstPending) {
          return { success: false, error: "No pending players in Round 2 queue" };
        }

        const targetPlayer = players.find((p) => p.id === firstPending.id);
        if (!targetPlayer) {
          return { success: false, error: "First Round 2 player not found in roster" };
        }

        const initialDuration = rules.initialTimerSeconds || 45;
        const expiryIso = new Date(Date.now() + initialDuration * 1000).toISOString();
        const basePrice = targetPlayer.basePriceOverride || targetPlayer.basePrice || 25000;

        const updatedPlayers = players.map((p) =>
          p.id === targetPlayer.id ? { ...p, status: "ON_AUCTION" as const } : p
        );

        const newState: AuctionStateRow = {
          ...state,
          currentPlayerId: targetPlayer.id,
          currentHighestBid: 0,
          currentLeadingTeamId: null,
          timerSeconds: initialDuration,
          timerExpiresAt: expiryIso,
          status: "IN_PROGRESS",
          round: 2,
          roundStage: "ROUND_2",
          round2QueueJson: JSON.stringify(queue),
          round2InitializedAt: state.round2InitializedAt || nowIso,
          round1Completed: true,
          bidCount: 0,
        };

        const auditEntry: AuditLogEntry = {
          id: `audit-${Date.now()}`,
          seasonId: leagueId,
          actionType: "ROUND_2_STARTED",
          actor: "AUCTIONEER",
          detailsJson: JSON.stringify({ player: targetPlayer.fullName, basePrice }),
          timestamp: nowIso,
        };

        return {
          success: true,
          message: `ROUND 2 started with ${targetPlayer.fullName}`,
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
            const currentPurchased = players.filter(
              (p) => p.status === "SOLD" && p.soldToTeamId === t.id
            ).length;
            const newCounts = getTeamParticipantCounts(t, currentPurchased + 1);
            const newSquadCount = newCounts.totalParticipants;
            const minPlayers = t.purse?.minPlayers || rules.minimumSquadSize || 15;
            const minBasePrice =
              rules.minimumBasePrice ||
              (rules.categoryBasePrices?.SILVER ?? rules.silverBasePrice ?? 25000);
            const remainingNeeded = Math.max(0, minPlayers - newSquadCount);
            const reserved = remainingNeeded * minBasePrice;

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

        // Module 2: Authoritative 5-second announcement window
        const announcementDurationMs = 5000;
        const announcementEndsAt = new Date(Date.now() + announcementDurationMs).toISOString();
        const announcementData: AuctionAnnouncement = {
          type: "SOLD",
          playerId: soldPlayer.id,
          winningTeamId: buyerTeam.id,
          soldPrice: finalPrice,
          startedAt: nowIso,
          endsAt: announcementEndsAt,
        };
        const announcementJson = JSON.stringify(announcementData);

        const initialDuration = rules.initialTimerSeconds || 45;
        let newState: AuctionStateRow;

        if (state.round === 2) {
          // --- ROUND 2 LOT RESOLUTION ---
          let queue: Round2QueueItem[] = [];
          try {
            if (state.round2QueueJson) queue = JSON.parse(state.round2QueueJson);
          } catch {}

          const updatedQueue = queue.map((item) =>
            item.id === soldPlayer.id ? { ...item, status: "SOLD" as const } : item
          );

          const nextPending = updatedQueue.find((item) => item.status === "PENDING");
          const nextPlayer = nextPending ? updatedPlayers.find((p) => p.id === nextPending.id) : null;

          if (nextPlayer) {
            updatedPlayers.forEach((p) => {
              if (p.id === nextPlayer.id) p.status = "ON_AUCTION";
            });

            newState = {
              ...state,
              currentPlayerId: nextPlayer.id,
              currentHighestBid: 0,
              currentLeadingTeamId: null,
              timerSeconds: initialDuration,
              timerExpiresAt: new Date(Date.now() + announcementDurationMs + initialDuration * 1000).toISOString(),
              status: "IN_PROGRESS",
              round: 2,
              roundStage: "ROUND_2",
              round2QueueJson: JSON.stringify(updatedQueue),
              announcementJson,
              bidCount: 0,
            };
          } else {
            // Round 2 complete! No Round 3.
            newState = {
              ...state,
              currentPlayerId: null,
              currentHighestBid: 0,
              currentLeadingTeamId: null,
              timerSeconds: 0,
              status: "FINISHED",
              round: 2,
              roundStage: "ROUND_2",
              round2QueueJson: JSON.stringify(updatedQueue),
              announcementJson,
              bidCount: 0,
            };
          }
        } else {
          // --- ROUND 1 LOT RESOLUTION ---
          const nextPlayer = updatedPlayers.find((p) => p.status === "AVAILABLE");

          if (nextPlayer) {
            newState = {
              ...state,
              currentPlayerId: nextPlayer.id,
              currentHighestBid: 0,
              currentLeadingTeamId: null,
              timerSeconds: initialDuration,
              timerExpiresAt: new Date(Date.now() + announcementDurationMs + initialDuration * 1000).toISOString(),
              status: "IN_PROGRESS",
              round: 1,
              roundStage: "MAIN",
              announcementJson,
              bidCount: 0,
            };
          } else {
            // Round 1 completed! Check if any unsold players exist
            const eligibleUnsold = getEligibleRound2Players(updatedPlayers);
            if (eligibleUnsold.length > 0) {
              const { queue } = createRound2Queue(eligibleUnsold);
              newState = {
                ...state,
                currentPlayerId: null,
                currentHighestBid: 0,
                currentLeadingTeamId: null,
                timerSeconds: 0,
                status: "PAUSED",
                round: 2,
                roundStage: "ROUND_2_TRANSITION",
                round2QueueJson: JSON.stringify(queue),
                round2InitializedAt: nowIso,
                round1Completed: true,
                announcementJson,
                bidCount: 0,
              };
            } else {
              // All players sold!
              newState = {
                ...state,
                currentPlayerId: null,
                currentHighestBid: 0,
                currentLeadingTeamId: null,
                timerSeconds: 0,
                status: "FINISHED",
                round: 1,
                roundStage: "MAIN",
                round1Completed: true,
                announcementJson,
                bidCount: 0,
              };
            }
          }
        }

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

        // Module 2: Authoritative 5-second UNSOLD announcement window
        const announcementDurationMs = 5000;
        const announcementEndsAt = new Date(Date.now() + announcementDurationMs).toISOString();
        const announcementData: AuctionAnnouncement = {
          type: "UNSOLD",
          playerId: unsoldPlayer.id,
          winningTeamId: null,
          soldPrice: null,
          startedAt: nowIso,
          endsAt: announcementEndsAt,
        };
        const announcementJson = JSON.stringify(announcementData);

        const initialDuration = rules.initialTimerSeconds || 45;
        let newState: AuctionStateRow;

        if (state.round === 2) {
          // --- ROUND 2 LOT UNSOLD ---
          let queue: Round2QueueItem[] = [];
          try {
            if (state.round2QueueJson) queue = JSON.parse(state.round2QueueJson);
          } catch {}

          // Mark current player as UNSOLD in Round 2 queue
          // A player remaining unsold in Round 2 must remain marked UNSOLD and must not be added to another round
          const updatedQueue = queue.map((item) =>
            item.id === unsoldPlayer.id ? { ...item, status: "UNSOLD" as const } : item
          );

          const nextPending = updatedQueue.find((item) => item.status === "PENDING");
          const nextPlayer = nextPending ? updatedPlayers.find((p) => p.id === nextPending.id) : null;

          if (nextPlayer) {
            updatedPlayers.forEach((p) => {
              if (p.id === nextPlayer.id) p.status = "ON_AUCTION";
            });

            newState = {
              ...state,
              currentPlayerId: nextPlayer.id,
              currentHighestBid: 0,
              currentLeadingTeamId: null,
              timerSeconds: initialDuration,
              timerExpiresAt: new Date(Date.now() + announcementDurationMs + initialDuration * 1000).toISOString(),
              status: "IN_PROGRESS",
              round: 2,
              roundStage: "ROUND_2",
              round2QueueJson: JSON.stringify(updatedQueue),
              announcementJson,
              bidCount: 0,
            };
          } else {
            // Round 2 complete! No Round 3.
            newState = {
              ...state,
              currentPlayerId: null,
              currentHighestBid: 0,
              currentLeadingTeamId: null,
              timerSeconds: 0,
              status: "FINISHED",
              round: 2,
              roundStage: "ROUND_2",
              round2QueueJson: JSON.stringify(updatedQueue),
              announcementJson,
              bidCount: 0,
            };
          }
        } else {
          // --- ROUND 1 LOT UNSOLD ---
          const nextPlayer = updatedPlayers.find((p) => p.status === "AVAILABLE");

          if (nextPlayer) {
            newState = {
              ...state,
              currentPlayerId: nextPlayer.id,
              currentHighestBid: 0,
              currentLeadingTeamId: null,
              timerSeconds: initialDuration,
              timerExpiresAt: new Date(Date.now() + announcementDurationMs + initialDuration * 1000).toISOString(),
              status: "IN_PROGRESS",
              round: 1,
              roundStage: "MAIN",
              announcementJson,
              bidCount: 0,
            };
          } else {
            // Round 1 completed! Check if any unsold players exist
            const eligibleUnsold = getEligibleRound2Players(updatedPlayers);
            if (eligibleUnsold.length > 0) {
              const { queue } = createRound2Queue(eligibleUnsold);
              newState = {
                ...state,
                currentPlayerId: null,
                currentHighestBid: 0,
                currentLeadingTeamId: null,
                timerSeconds: 0,
                status: "PAUSED",
                round: 2,
                roundStage: "ROUND_2_TRANSITION",
                round2QueueJson: JSON.stringify(queue),
                round2InitializedAt: nowIso,
                round1Completed: true,
                announcementJson,
                bidCount: 0,
              };
            } else {
              newState = {
                ...state,
                currentPlayerId: null,
                currentHighestBid: 0,
                currentLeadingTeamId: null,
                timerSeconds: 0,
                status: "FINISHED",
                round: 1,
                roundStage: "MAIN",
                round1Completed: true,
                announcementJson,
                bidCount: 0,
              };
            }
          }
        }

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
          announcementJson: "",
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
      revision: freshState.session.revision || freshState.session.version || 1,
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
