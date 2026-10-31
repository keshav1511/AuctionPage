// ==============================================================================
// NTL AUCTION PLATFORM - AUTHORITATIVE GOOGLE SHEETS REPOSITORY
// Server-side repository for Google Sheets as the single source of truth
// Implements serialized write locking, versioning, atomic batch writes, and CRUD
// ==============================================================================

import { getGoogleSheetsClient, extractSpreadsheetId, isGoogleSheetsConfigured } from "./google-sheets-client";
import {
  TAB_LEAGUE_CONFIG,
  TAB_TEAMS,
  TAB_PLAYERS,
  TAB_AUCTION_STATE,
  TAB_BID_HISTORY,
  TAB_PURCHASES,
  TAB_AUDIT_LOG,
  serializeLeagueConfig,
  deserializeLeagueConfig,
  serializeTeam,
  deserializeTeam,
  serializePlayer,
  deserializePlayer,
  serializeAuctionState,
  deserializeAuctionState,
  serializeBid,
  deserializeBid,
  serializePurchase,
  serializeAuditLog,
  AuctionStateRow,
  PurchaseRecord,
  AuditLogEntry,
} from "./tab-definitions";
import { initializeLeagueWorkbook } from "./workbook-manager";
import { League, Team, Player, AuctionRules, Bid } from "@/types";
import { INITIAL_LEAGUES, getInitialLeagueById } from "@/lib/mock-data/leagues";
import { MOCK_TEAMS } from "@/lib/mock-data/teams";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";
import { MOCK_RULES } from "@/lib/mock-data/auction";

// Local in-process serialization mutex map per league ID
const leagueMutexChains = new Map<string, Promise<unknown>>();

function runSerialized<T>(leagueId: string, task: () => Promise<T>): Promise<T> {
  const currentChain = leagueMutexChains.get(leagueId) || Promise.resolve();
  const next = currentChain.then(task, task);
  leagueMutexChains.set(leagueId, next);
  return next;
}

// In-memory fallback mirror when Google credentials are not yet populated
interface InMemoryLeagueMirror {
  league: League;
  rules: AuctionRules;
  teams: Team[];
  players: Player[];
  state: AuctionStateRow;
  bids: Bid[];
  purchases: PurchaseRecord[];
  auditLogs: AuditLogEntry[];
}

const memoryMirrors = new Map<string, InMemoryLeagueMirror>();

function getOrCreateMemoryMirror(leagueId: string): InMemoryLeagueMirror {
  if (!memoryMirrors.has(leagueId)) {
    const base = getInitialLeagueById(leagueId) || INITIAL_LEAGUES[0];
    const initialPlayers = MOCK_PLAYERS.map((p) => ({ ...p, seasonId: leagueId }));
    const initialTeams = MOCK_TEAMS.map((t) => ({ ...t, seasonId: leagueId }));
    const initialRules = { ...MOCK_RULES, seasonId: leagueId };

    const firstPlayer = initialPlayers[0];
    const initialAuctionState: AuctionStateRow = {
      id: `auction-${leagueId}`,
      seasonId: leagueId,
      status: "IDLE",
      currentPlayerId: firstPlayer ? firstPlayer.id : null,
      currentHighestBid: 0,
      currentLeadingTeamId: null,
      timerSeconds: initialRules.initialTimerSeconds || 45,
      timerExpiresAt: new Date(Date.now() + (initialRules.initialTimerSeconds || 45) * 1000).toISOString(),
      round: 1,
      bidCount: 0,
      bidExtensionSeconds: initialRules.bidExtensionSeconds || 10,
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    memoryMirrors.set(leagueId, {
      league: { ...base, id: leagueId },
      rules: initialRules,
      teams: initialTeams,
      players: initialPlayers,
      state: initialAuctionState,
      bids: [],
      purchases: [],
      auditLogs: [],
    });
  }
  return memoryMirrors.get(leagueId)!;
}

/**
 * Resolves the Google Spreadsheet ID for a given league
 */
export function resolveSpreadsheetIdForLeague(leagueId: string): string | null {
  // 1. Check environment variable override
  if (process.env.GOOGLE_SHEETS_DATABASE_ID) {
    return process.env.GOOGLE_SHEETS_DATABASE_ID;
  }

  // 2. Check initial league configured URL
  const league = getInitialLeagueById(leagueId);
  if (league?.googleSheetsUrl) {
    const extracted = extractSpreadsheetId(league.googleSheetsUrl);
    if (extracted) return extracted;
  }

  // 3. Fallback default spreadsheet ID if present
  if (process.env.GOOGLE_SHEET_ID) {
    return process.env.GOOGLE_SHEET_ID;
  }

  return null;
}

// ==============================================================================
// REPOSITORY METHODS
// ==============================================================================

/**
 * Loads the complete league configuration and rules from Google Sheets
 */
export async function getLeagueConfigFromSheets(leagueId: string): Promise<{ league: League; rules: AuctionRules }> {
  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    const mirror = getOrCreateMemoryMirror(leagueId);
    return { league: mirror.league, rules: mirror.rules };
  }

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${TAB_LEAGUE_CONFIG}!A2:Q2`,
    });

    const rows = res.data.values;
    if (rows && rows[0]) {
      const parsed = deserializeLeagueConfig(rows[0]);
      if (parsed) {
        return {
          league: parsed.league,
          rules: parsed.rules || { ...MOCK_RULES, seasonId: leagueId },
        };
      }
    }

    // Tab was empty; initialize and seed
    await initializeLeagueWorkbook(spreadsheetId, {
      league: getInitialLeagueById(leagueId),
      rules: { ...MOCK_RULES, seasonId: leagueId },
    });

    const mirror = getOrCreateMemoryMirror(leagueId);
    return { league: mirror.league, rules: mirror.rules };
  } catch (error) {
    console.error(`[SheetsRepository] Error getting league config for ${leagueId}:`, error);
    const mirror = getOrCreateMemoryMirror(leagueId);
    return { league: mirror.league, rules: mirror.rules };
  }
}

/**
 * Saves/updates league configuration to Google Sheets
 */
export async function saveLeagueConfigToSheets(league: League, rules?: AuctionRules): Promise<void> {
  const spreadsheetId = resolveSpreadsheetIdForLeague(league.id);
  const sheets = getGoogleSheetsClient();

  // Always update memory mirror for fast local fallback
  const mirror = getOrCreateMemoryMirror(league.id);
  mirror.league = { ...mirror.league, ...league };
  if (rules) mirror.rules = { ...mirror.rules, ...rules };

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    return;
  }

  try {
    const values = [serializeLeagueConfig(mirror.league, mirror.rules)];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${TAB_LEAGUE_CONFIG}!A2:Q2`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  } catch (error) {
    console.error(`[SheetsRepository] Failed to save league config for ${league.id}:`, error);
    throw error;
  }
}

/**
 * Retrieves all teams from Google Sheets
 */
export async function getTeamsFromSheets(leagueId: string): Promise<Team[]> {
  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    const mirror = getOrCreateMemoryMirror(leagueId);
    return mirror.teams;
  }

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${TAB_TEAMS}!A2:T`,
    });

    const rows = res.data.values || [];
    if (rows.length === 0) {
      // Seed initial teams if blank
      const mirror = getOrCreateMemoryMirror(leagueId);
      await saveTeamsToSheets(leagueId, mirror.teams);
      return mirror.teams;
    }

    const teams: Team[] = [];
    for (const row of rows) {
      const team = deserializeTeam(row);
      if (team) teams.push(team);
    }
    return teams;
  } catch (error) {
    console.error(`[SheetsRepository] Error fetching teams for ${leagueId}:`, error);
    return getOrCreateMemoryMirror(leagueId).teams;
  }
}

/**
 * Saves or completely replaces all teams in Google Sheets
 */
export async function saveTeamsToSheets(leagueId: string, teams: Team[]): Promise<void> {
  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  // Update memory mirror
  const mirror = getOrCreateMemoryMirror(leagueId);
  mirror.teams = teams;

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    return;
  }

  try {
    // Clear existing range and write new rows
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${TAB_TEAMS}!A2:T`,
    });

    if (teams.length > 0) {
      const values = teams.map(serializeTeam);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${TAB_TEAMS}!A2:T${teams.length + 1}`,
        valueInputOption: "RAW",
        requestBody: { values },
      });
    }
  } catch (error) {
    console.error(`[SheetsRepository] Failed to save teams for ${leagueId}:`, error);
    throw error;
  }
}

/**
 * Retrieves all players from Google Sheets
 */
export async function getPlayersFromSheets(leagueId: string): Promise<Player[]> {
  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    const mirror = getOrCreateMemoryMirror(leagueId);
    return mirror.players;
  }

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${TAB_PLAYERS}!A2:V`,
    });

    const rows = res.data.values || [];
    if (rows.length === 0) {
      // Seed initial players if blank
      const mirror = getOrCreateMemoryMirror(leagueId);
      await savePlayersToSheets(leagueId, mirror.players);
      return mirror.players;
    }

    const players: Player[] = [];
    for (const row of rows) {
      const player = deserializePlayer(row);
      if (player) players.push(player);
    }
    return players;
  } catch (error) {
    console.error(`[SheetsRepository] Error fetching players for ${leagueId}:`, error);
    return getOrCreateMemoryMirror(leagueId).players;
  }
}

/**
 * Saves or completely replaces all players in Google Sheets
 */
export async function savePlayersToSheets(leagueId: string, players: Player[]): Promise<void> {
  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  // Update memory mirror
  const mirror = getOrCreateMemoryMirror(leagueId);
  mirror.players = players;

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    return;
  }

  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${TAB_PLAYERS}!A2:V`,
    });

    if (players.length > 0) {
      const values = players.map(serializePlayer);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${TAB_PLAYERS}!A2:V${players.length + 1}`,
        valueInputOption: "RAW",
        requestBody: { values },
      });
    }
  } catch (error) {
    console.error(`[SheetsRepository] Failed to save players for ${leagueId}:`, error);
    throw error;
  }
}

/**
 * Reads current authoritative auction state from Google Sheets
 */
export async function getAuctionStateFromSheets(leagueId: string): Promise<AuctionStateRow> {
  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    const mirror = getOrCreateMemoryMirror(leagueId);
    return mirror.state;
  }

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${TAB_AUCTION_STATE}!A2:P2`,
    });

    const rows = res.data.values;
    if (rows && rows[0]) {
      const state = deserializeAuctionState(rows[0]);
      if (state) {
        return state;
      }
    }

    // Tab empty, initialize
    const mirror = getOrCreateMemoryMirror(leagueId);
    await saveAuctionStateToSheets(leagueId, mirror.state);
    return mirror.state;
  } catch (error) {
    console.error(`[SheetsRepository] Error fetching auction state for ${leagueId}:`, error);
    return getOrCreateMemoryMirror(leagueId).state;
  }
}

/**
 * Writes updated auction state directly to Google Sheets
 */
export async function saveAuctionStateToSheets(leagueId: string, state: AuctionStateRow): Promise<void> {
  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  // Update memory mirror
  const mirror = getOrCreateMemoryMirror(leagueId);
  mirror.state = state;

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    return;
  }

  try {
    const values = [serializeAuctionState(state)];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${TAB_AUCTION_STATE}!A2:P2`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  } catch (error) {
    console.error(`[SheetsRepository] Failed to save auction state for ${leagueId}:`, error);
    throw error;
  }
}

/**
 * Reads recent bids from Google Sheets
 */
export async function getRecentBidsFromSheets(leagueId: string, limit: number = 20): Promise<Bid[]> {
  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    const mirror = getOrCreateMemoryMirror(leagueId);
    return mirror.bids.slice(0, limit);
  }

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${TAB_BID_HISTORY}!A2:K`,
    });

    const rows = res.data.values || [];
    const bids: Bid[] = [];

    // Rows stored chronologically; read from end for recents
    for (let i = rows.length - 1; i >= 0 && bids.length < limit; i--) {
      const row = rows[i];
      if (row[10] === "TRUE") continue; // Exclude undone bids
      const bid = deserializeBid(row);
      if (bid) bids.push(bid);
    }

    return bids;
  } catch (error) {
    console.error(`[SheetsRepository] Error fetching bids for ${leagueId}:`, error);
    return getOrCreateMemoryMirror(leagueId).bids.slice(0, limit);
  }
}

/**
 * Appends a new bid to Google Sheets
 */
export async function appendBidToSheets(leagueId: string, bid: Bid): Promise<void> {
  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  // Update memory mirror
  const mirror = getOrCreateMemoryMirror(leagueId);
  mirror.bids = [bid, ...mirror.bids];

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    return;
  }

  try {
    const values = [serializeBid(bid, leagueId)];
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${TAB_BID_HISTORY}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
  } catch (error) {
    console.error(`[SheetsRepository] Failed to append bid for ${leagueId}:`, error);
    throw error;
  }
}

/**
 * Marks the last active bid in Bid_History as undone
 */
export async function markLastBidUndoneInSheets(leagueId: string): Promise<Bid | null> {
  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  const mirror = getOrCreateMemoryMirror(leagueId);
  const undoneBid = mirror.bids.shift() || null;

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    return undoneBid;
  }

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${TAB_BID_HISTORY}!A2:K`,
    });

    const rows = res.data.values || [];
    // Search backward for last row where isUndone !== TRUE
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i][10] !== "TRUE") {
        const rowIndex = i + 2; // 1-indexed, skipping header
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${TAB_BID_HISTORY}!K${rowIndex}`,
          valueInputOption: "RAW",
          requestBody: { values: [["TRUE"]] },
        });
        return deserializeBid(rows[i]);
      }
    }
    return null;
  } catch (error) {
    console.error(`[SheetsRepository] Failed to undo bid for ${leagueId}:`, error);
    return undoneBid;
  }
}

/**
 * Records a finalized lot purchase in Purchases tab
 */
export async function recordPurchaseInSheets(leagueId: string, purchase: PurchaseRecord): Promise<void> {
  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  const mirror = getOrCreateMemoryMirror(leagueId);
  mirror.purchases.push(purchase);

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    return;
  }

  try {
    const values = [serializePurchase(purchase)];
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${TAB_PURCHASES}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
  } catch (error) {
    console.error(`[SheetsRepository] Failed to record purchase for ${leagueId}:`, error);
    throw error;
  }
}

/**
 * Appends an entry to the Audit_Log tab
 */
export async function appendAuditLogInSheets(leagueId: string, log: AuditLogEntry): Promise<void> {
  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  const mirror = getOrCreateMemoryMirror(leagueId);
  mirror.auditLogs.push(log);

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    return;
  }

  try {
    const values = [serializeAuditLog(log)];
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${TAB_AUDIT_LOG}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
  } catch (error) {
    console.error(`[SheetsRepository] Failed to append audit log for ${leagueId}:`, error);
  }
}

// ==============================================================================
// SERIALIZED AUCTION ACTION TRANSACTION
// ==============================================================================

export interface AuctionActionTransactionContext {
  state: AuctionStateRow;
  teams: Team[];
  players: Player[];
  rules: AuctionRules;
  recentBids: Bid[];
}

export interface AuctionActionTransactionResult {
  success: boolean;
  message?: string;
  error?: string;
  newState?: AuctionStateRow;
  updatedTeams?: Team[];
  updatedPlayers?: Player[];
  newBid?: Bid;
  newPurchase?: PurchaseRecord;
  auditEntry?: AuditLogEntry;
}

/**
 * Executes an auction action inside a serialized write lock
 * Enforces the sequence:
 * 1. Acquire local process mutex
 * 2. Fetch latest authoritative state from Google Sheets
 * 3. Verify / acquire sheet lease lock
 * 4. Execute validation & action logic
 * 5. Commit atomic batch write to Google Sheets
 * 6. Release lock
 */
export async function executeSerializedAuctionAction(
  leagueId: string,
  actionFn: (ctx: AuctionActionTransactionContext) => Promise<AuctionActionTransactionResult>
): Promise<AuctionActionTransactionResult> {
  return runSerialized(leagueId, async () => {
    const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
    const sheets = getGoogleSheetsClient();
    const lockToken = `lock-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    // 1. Fetch latest state from Google Sheets (or mirror)
    const [currentState, currentTeams, currentPlayers, config, recentBids] = await Promise.all([
      getAuctionStateFromSheets(leagueId),
      getTeamsFromSheets(leagueId),
      getPlayersFromSheets(leagueId),
      getLeagueConfigFromSheets(leagueId),
      getRecentBidsFromSheets(leagueId, 10),
    ]);

    // 2. Check lease lock if Google Sheets is active
    if (isGoogleSheetsConfigured() && sheets && spreadsheetId) {
      if (currentState.lockToken && currentState.lockExpiresAt) {
        const lockExpiryTime = new Date(currentState.lockExpiresAt).getTime();
        if (lockExpiryTime > now && currentState.lockToken !== lockToken) {
          // Lock held by another process; retry once after 350ms
          await new Promise((resolve) => setTimeout(resolve, 350));
          const refreshed = await getAuctionStateFromSheets(leagueId);
          if (refreshed.lockToken && new Date(refreshed.lockExpiresAt || 0).getTime() > Date.now()) {
            return {
              success: false,
              error: "Auction is currently processing another transaction. Please retry in a moment.",
            };
          }
        }
      }

      // Mark lease lock in Sheets
      currentState.lockToken = lockToken;
      currentState.lockExpiresAt = new Date(now + 4000).toISOString();
      await saveAuctionStateToSheets(leagueId, currentState);
    }

    try {
      // 3. Execute action callback
      const result = await actionFn({
        state: currentState,
        teams: currentTeams,
        players: currentPlayers,
        rules: config.rules,
        recentBids,
      });

      if (!result.success) {
        // Release lock and abort
        if (isGoogleSheetsConfigured() && sheets && spreadsheetId) {
          currentState.lockToken = null;
          currentState.lockExpiresAt = null;
          await saveAuctionStateToSheets(leagueId, currentState);
        }
        return result;
      }

      // 4. Commit results to Google Sheets
      const updatedState = result.newState || currentState;
      updatedState.version = (currentState.version || 1) + 1;
      updatedState.lockToken = null;
      updatedState.lockExpiresAt = null;
      updatedState.updatedAt = new Date().toISOString();

      await saveAuctionStateToSheets(leagueId, updatedState);

      if (result.updatedTeams) {
        await saveTeamsToSheets(leagueId, result.updatedTeams);
      }

      if (result.updatedPlayers) {
        await savePlayersToSheets(leagueId, result.updatedPlayers);
      }

      if (result.newBid) {
        await appendBidToSheets(leagueId, result.newBid);
      }

      if (result.newPurchase) {
        await recordPurchaseInSheets(leagueId, result.newPurchase);
      }

      if (result.auditEntry) {
        await appendAuditLogInSheets(leagueId, result.auditEntry);
      }

      return {
        ...result,
        newState: updatedState,
      };
    } catch (err) {
      console.error(`[SheetsRepository] Transaction execution failure for ${leagueId}:`, err);

      // Attempt to clear lock on unexpected crash
      if (isGoogleSheetsConfigured() && sheets && spreadsheetId) {
        try {
          currentState.lockToken = null;
          currentState.lockExpiresAt = null;
          await saveAuctionStateToSheets(leagueId, currentState);
        } catch {}
      }

      return {
        success: false,
        error: `Persistence error: ${(err as Error).message || "Transaction failed"}`,
      };
    }
  });
}
