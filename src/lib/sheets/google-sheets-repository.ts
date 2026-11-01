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
  deserializePurchase,
  serializeAuditLog,
  AuctionStateRow,
  PurchaseRecord,
  AuditLogEntry,
} from "./tab-definitions";
import { initializeLeagueWorkbook } from "./workbook-manager";
import { League, Team, Player, AuctionRules, Bid } from "@/types";
import { getInitialLeagueById } from "@/lib/mock-data/leagues";
import { NTL_DEFAULT_LEAGUE, NTL_DEFAULT_RULES, NTL_TEAMS, NTL_PLAYERS } from "@/config/ntl-season-1";
import { callAppsScript, isAppsScriptConfigured } from "./apps-script-client";

// Local in-process serialization mutex map per league ID
const leagueMutexChains = new Map<string, Promise<unknown>>();

function runSerialized<T>(leagueId: string, task: () => Promise<T>): Promise<T> {
  const currentChain = leagueMutexChains.get(leagueId) || Promise.resolve();
  const next = currentChain.then(task, task);
  leagueMutexChains.set(leagueId, next);
  return next;
}

// ==============================================================================
// SHORT-LIVED IN-MEMORY CACHE & REQUEST COALESCING (1.5s TTL)
// Dramatically reduces Google Sheets API consumption to keep well under 300 req/min
// ==============================================================================

export const CACHE_TTL_MS = 1500; // 1.5 seconds

interface CacheItem<T> {
  data: T;
  expiresAt: number;
}

const stateCache = new Map<string, CacheItem<AuctionStateRow>>();
const teamsCache = new Map<string, CacheItem<Team[]>>();
const playersCache = new Map<string, CacheItem<Player[]>>();
const configCache = new Map<string, CacheItem<{ league: League; rules: AuctionRules }>>();
const recentBidsCache = new Map<string, CacheItem<Bid[]>>();

export function invalidateLeagueCache(leagueId: string): void {
  stateCache.delete(leagueId);
  teamsCache.delete(leagueId);
  playersCache.delete(leagueId);
  configCache.delete(leagueId);
  recentBidsCache.delete(leagueId);
}

// In-flight request coalescing to prevent thundering herd on concurrent spectator requests
const inFlightRequests = new Map<string, Promise<unknown>>();

function coalesceRequest<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<T>;
  }
  const promise = fetchFn().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
}

// Exponential backoff retry with randomized jitter for transient Google API rate limits & 5xx errors
export async function withGoogleRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; initialDelayMs?: number; operationName?: string } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  let delay = options.initialDelayMs ?? 200;
  const operationName = options.operationName ?? "GoogleSheetsOperation";

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const errorObj = err as {
        status?: number;
        response?: { status?: number };
        code?: string | number;
        message?: string;
      };
      const status = errorObj?.status || errorObj?.response?.status || errorObj?.code;
      const isRateLimit =
        status === 429 || (errorObj?.message && errorObj.message.includes("Quota exceeded"));
      const isServerError = typeof status === "number" && status >= 500 && status < 600;
      const isNetworkError = errorObj?.code === "ECONNRESET" || errorObj?.code === "ETIMEDOUT";

      if ((isRateLimit || isServerError || isNetworkError) && attempt <= maxRetries) {
        const jitter = Math.random() * 80 - 40;
        const sleepTime = Math.max(50, Math.floor(delay + jitter));
        console.warn(
          `[GoogleRetry] ${operationName} failed (status=${status}). Retrying attempt ${attempt}/${maxRetries} after ${sleepTime}ms...`
        );
        await new Promise((res) => setTimeout(res, sleepTime));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
  throw new Error(`${operationName} failed after ${maxRetries} retries`);
}

// Idempotency cache for duplicate request suppression
const idempotencyStore = new Map<string, { result: AuctionActionTransactionResult; timestamp: number }>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedIdempotentResult(actionId?: string): AuctionActionTransactionResult | null {
  if (!actionId) return null;
  const entry = idempotencyStore.get(actionId);
  if (entry && Date.now() - entry.timestamp < IDEMPOTENCY_TTL_MS) {
    return entry.result;
  }
  return null;
}

function storeIdempotentResult(
  actionId: string | undefined,
  result: AuctionActionTransactionResult
): void {
  if (!actionId) return;
  if (idempotencyStore.size > 2000) {
    const now = Date.now();
    for (const [k, v] of idempotencyStore.entries()) {
      if (now - v.timestamp > IDEMPOTENCY_TTL_MS) idempotencyStore.delete(k);
    }
  }
  idempotencyStore.set(actionId, { result, timestamp: Date.now() });
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
    const base = getInitialLeagueById(leagueId) || NTL_DEFAULT_LEAGUE;
    const initialPlayers: Player[] = [...NTL_PLAYERS];
    const initialTeams: Team[] = [...NTL_TEAMS];
    const initialRules = { ...NTL_DEFAULT_RULES, seasonId: leagueId };

    const initialAuctionState: AuctionStateRow = {
      id: `auction-${leagueId}`,
      seasonId: leagueId,
      status: "IDLE",
      currentPlayerId: initialPlayers[0]?.id || null,
      currentHighestBid: 0,
      currentLeadingTeamId: null,
      timerSeconds: initialRules.initialTimerSeconds || 45,
      timerExpiresAt: new Date(Date.now() + (initialRules.initialTimerSeconds || 45) * 1000).toISOString(),
      round: 1,
      roundStage: "MAIN",
      round2QueueJson: "[]",
      round1Completed: false,
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

  // 2. Check active memory mirror configured URL for this specific league
  const mirror = memoryMirrors.get(leagueId);
  if (mirror?.league?.googleSheetsUrl) {
    const extracted = extractSpreadsheetId(mirror.league.googleSheetsUrl);
    if (extracted) return extracted;
  }

  // 3. Check initial league configured URL
  const league = getInitialLeagueById(leagueId);
  if (league?.googleSheetsUrl) {
    const extracted = extractSpreadsheetId(league.googleSheetsUrl);
    if (extracted) return extracted;
  }

  return null;
}

/**
 * Synchronizes complete state from Google Apps Script Web App in a single network request
 */
async function syncFromAppsScript(leagueId: string): Promise<boolean> {
  if (!isAppsScriptConfigured()) return false;
  try {
    const data = await callAppsScript<{
      state?: AuctionStateRow;
      teams?: Team[];
      players?: Player[];
      recentBids?: Bid[];
    }>("GET_ALL_DATA");

    if (data) {
      const mirror = getOrCreateMemoryMirror(leagueId);
      if (Array.isArray(data.teams) && data.teams.length > 0) {
        mirror.teams = data.teams;
        teamsCache.set(leagueId, { data: data.teams, expiresAt: Date.now() + CACHE_TTL_MS });
      }
      if (Array.isArray(data.players) && data.players.length > 0) {
        mirror.players = data.players;
        playersCache.set(leagueId, { data: data.players, expiresAt: Date.now() + CACHE_TTL_MS });
      }
      if (data.state && data.state.id) {
        mirror.state = data.state;
        stateCache.set(leagueId, { data: data.state, expiresAt: Date.now() + CACHE_TTL_MS });
      }
      if (Array.isArray(data.recentBids)) {
        mirror.bids = data.recentBids;
        recentBidsCache.set(leagueId, { data: data.recentBids, expiresAt: Date.now() + CACHE_TTL_MS });
      }
      return true;
    }
  } catch (err) {
    console.warn("[SheetsRepository] Apps Script sync warning:", err);
  }
  return false;
}

// ==============================================================================
// REPOSITORY METHODS
// ==============================================================================

/**
 * Loads the complete league configuration and rules from Google Sheets
 */
export async function getLeagueConfigFromSheets(
  leagueId: string,
  skipCache = false
): Promise<{ league: League; rules: AuctionRules }> {
  const now = Date.now();
  if (!skipCache) {
    const cached = configCache.get(leagueId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
  }

  return coalesceRequest(`config:${leagueId}`, async () => {
    const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
    const sheets = getGoogleSheetsClient();

    if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
      const mirror = getOrCreateMemoryMirror(leagueId);
      return { league: mirror.league, rules: mirror.rules };
    }

    try {
      const res = await withGoogleRetry(
        () =>
          sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${TAB_LEAGUE_CONFIG}!A2:Q2`,
          }),
        { operationName: "GetLeagueConfig" }
      );

      const rows = res.data.values;
      if (rows && rows[0]) {
        const parsed = deserializeLeagueConfig(rows[0]);
        if (parsed) {
          const result = {
            league: parsed.league,
            rules: parsed.rules || { ...NTL_DEFAULT_RULES, seasonId: leagueId },
          };
          configCache.set(leagueId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
          return result;
        }
      }

      // Tab was empty; initialize and seed
      await initializeLeagueWorkbook(spreadsheetId, {
        league: getInitialLeagueById(leagueId),
        rules: { ...NTL_DEFAULT_RULES, seasonId: leagueId },
      });

      const mirror = getOrCreateMemoryMirror(leagueId);
      const fallback = { league: mirror.league, rules: mirror.rules };
      configCache.set(leagueId, { data: fallback, expiresAt: Date.now() + CACHE_TTL_MS });
      return fallback;
    } catch (error) {
      console.error(`[SheetsRepository] Error getting league config for ${leagueId}:`, error);
      const mirror = getOrCreateMemoryMirror(leagueId);
      return { league: mirror.league, rules: mirror.rules };
    }
  });
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
  invalidateLeagueCache(league.id);

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    return;
  }

  try {
    const values = [serializeLeagueConfig(mirror.league, mirror.rules)];
    await withGoogleRetry(
      () =>
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${TAB_LEAGUE_CONFIG}!A2:Q2`,
          valueInputOption: "RAW",
          requestBody: { values },
        }),
      { operationName: "SaveLeagueConfig" }
    );
  } catch (error) {
    console.error(`[SheetsRepository] Failed to save league config for ${league.id}:`, error);
    throw error;
  }
}

/**
 * Retrieves all teams from Google Sheets
 */
export async function getTeamsFromSheets(leagueId: string, skipCache = false): Promise<Team[]> {
  const now = Date.now();
  if (!skipCache) {
    const cached = teamsCache.get(leagueId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
  }

  return coalesceRequest(`teams:${leagueId}`, async () => {
    if (isAppsScriptConfigured()) {
      await syncFromAppsScript(leagueId);
      return getOrCreateMemoryMirror(leagueId).teams;
    }

    const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
    const sheets = getGoogleSheetsClient();

    if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
      const mirror = getOrCreateMemoryMirror(leagueId);
      return mirror.teams;
    }

    try {
      const res = await withGoogleRetry(
        () =>
          sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${TAB_TEAMS}!A2:T`,
          }),
        { operationName: "GetTeams" }
      );

      const rows = res.data.values || [];
      if (rows.length === 0) {
        const mirror = getOrCreateMemoryMirror(leagueId);
        teamsCache.set(leagueId, { data: mirror.teams, expiresAt: Date.now() + CACHE_TTL_MS });
        return mirror.teams;
      }

      const teams: Team[] = [];
      for (const row of rows) {
        const team = deserializeTeam(row);
        if (team) teams.push(team);
      }
      teamsCache.set(leagueId, { data: teams, expiresAt: Date.now() + CACHE_TTL_MS });
      return teams;
    } catch (error) {
      console.error(`[SheetsRepository] Error fetching teams for ${leagueId}:`, error);
      return getOrCreateMemoryMirror(leagueId).teams;
    }
  });
}

/**
 * Saves or completely replaces all teams in Google Sheets
 */
export async function saveTeamsToSheets(leagueId: string, teams: Team[]): Promise<void> {
  // Update memory mirror
  const mirror = getOrCreateMemoryMirror(leagueId);
  mirror.teams = teams;
  teamsCache.set(leagueId, { data: teams, expiresAt: Date.now() + CACHE_TTL_MS });

  if (isAppsScriptConfigured()) {
    try {
      await callAppsScript("INIT_WORKBOOK", { teams });
    } catch (err) {
      console.warn("[SheetsRepository] Apps Script saveTeams error:", err);
    }
    return;
  }

  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    return;
  }

  try {
    await withGoogleRetry(
      () =>
        sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `${TAB_TEAMS}!A2:T`,
        }),
      { operationName: "ClearTeams" }
    );

    if (teams.length > 0) {
      const values = teams.map(serializeTeam);
      await withGoogleRetry(
        () =>
          sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${TAB_TEAMS}!A2:T${teams.length + 1}`,
            valueInputOption: "RAW",
            requestBody: { values },
          }),
        { operationName: "UpdateTeams" }
      );
    }
  } catch (error) {
    console.error(`[SheetsRepository] Failed to save teams for ${leagueId}:`, error);
    throw error;
  }
}

/**
 * Retrieves all players from Google Sheets
 */
export async function getPlayersFromSheets(leagueId: string, skipCache = false): Promise<Player[]> {
  const now = Date.now();
  if (!skipCache) {
    const cached = playersCache.get(leagueId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
  }

  return coalesceRequest(`players:${leagueId}`, async () => {
    if (isAppsScriptConfigured()) {
      await syncFromAppsScript(leagueId);
      return getOrCreateMemoryMirror(leagueId).players;
    }

    const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
    const sheets = getGoogleSheetsClient();

    if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
      const mirror = getOrCreateMemoryMirror(leagueId);
      return mirror.players;
    }

    try {
      const res = await withGoogleRetry(
        () =>
          sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${TAB_PLAYERS}!A2:V`,
          }),
        { operationName: "GetPlayers" }
      );

      const rows = res.data.values || [];
      if (rows.length === 0) {
        const mirror = getOrCreateMemoryMirror(leagueId);
        playersCache.set(leagueId, { data: mirror.players, expiresAt: Date.now() + CACHE_TTL_MS });
        return mirror.players;
      }

      const players: Player[] = [];
      for (const row of rows) {
        const player = deserializePlayer(row);
        if (player) players.push(player);
      }
      playersCache.set(leagueId, { data: players, expiresAt: Date.now() + CACHE_TTL_MS });
      return players;
    } catch (error) {
      console.error(`[SheetsRepository] Error fetching players for ${leagueId}:`, error);
      return getOrCreateMemoryMirror(leagueId).players;
    }
  });
}

/**
 * Saves or completely replaces all players in Google Sheets
 */
export async function savePlayersToSheets(leagueId: string, players: Player[]): Promise<void> {
  // Update memory mirror
  const mirror = getOrCreateMemoryMirror(leagueId);
  mirror.players = players;
  playersCache.set(leagueId, { data: players, expiresAt: Date.now() + CACHE_TTL_MS });

  if (isAppsScriptConfigured()) {
    try {
      await callAppsScript("INIT_WORKBOOK", { players });
    } catch (err) {
      console.warn("[SheetsRepository] Apps Script savePlayers error:", err);
    }
    return;
  }

  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    return;
  }

  try {
    await withGoogleRetry(
      () =>
        sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `${TAB_PLAYERS}!A2:V`,
        }),
      { operationName: "ClearPlayers" }
    );

    if (players.length > 0) {
      const values = players.map(serializePlayer);
      await withGoogleRetry(
        () =>
          sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${TAB_PLAYERS}!A2:V${players.length + 1}`,
            valueInputOption: "RAW",
            requestBody: { values },
          }),
        { operationName: "UpdatePlayers" }
      );
    }
  } catch (error) {
    console.error(`[SheetsRepository] Failed to save players for ${leagueId}:`, error);
    throw error;
  }
}

/**
 * Reads current authoritative auction state from Google Sheets
 */
export async function getAuctionStateFromSheets(
  leagueId: string,
  skipCache = false
): Promise<AuctionStateRow> {
  const now = Date.now();
  if (!skipCache) {
    const cached = stateCache.get(leagueId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
  }

  return coalesceRequest(`state:${leagueId}`, async () => {
    if (isAppsScriptConfigured()) {
      await syncFromAppsScript(leagueId);
      return getOrCreateMemoryMirror(leagueId).state;
    }

    const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
    const sheets = getGoogleSheetsClient();

    if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
      const mirror = getOrCreateMemoryMirror(leagueId);
      return mirror.state;
    }

    try {
      const res = await withGoogleRetry(
        () =>
          sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${TAB_AUCTION_STATE}!A2:U2`,
          }),
        { operationName: "GetAuctionState" }
      );

      const rows = res.data.values;
      if (rows && rows[0]) {
        const state = deserializeAuctionState(rows[0]);
        if (state) {
          stateCache.set(leagueId, { data: state, expiresAt: Date.now() + CACHE_TTL_MS });
          return state;
        }
      }

      // Tab empty, initialize
      const mirror = getOrCreateMemoryMirror(leagueId);
      await saveAuctionStateToSheets(leagueId, mirror.state);
      stateCache.set(leagueId, { data: mirror.state, expiresAt: Date.now() + CACHE_TTL_MS });
      return mirror.state;
    } catch (error) {
      console.error(`[SheetsRepository] Error fetching auction state for ${leagueId}:`, error);
      return getOrCreateMemoryMirror(leagueId).state;
    }
  });
}

/**
 * Writes updated auction state directly to Google Sheets
 */
export async function saveAuctionStateToSheets(leagueId: string, state: AuctionStateRow): Promise<void> {
  // Update memory mirror
  const mirror = getOrCreateMemoryMirror(leagueId);
  mirror.state = state;
  stateCache.set(leagueId, { data: state, expiresAt: Date.now() + CACHE_TTL_MS });

  if (isAppsScriptConfigured()) {
    try {
      await callAppsScript("SAVE_AUCTION_STATE", state);
    } catch (err) {
      console.warn("[SheetsRepository] Apps Script saveAuctionState error:", err);
    }
    return;
  }

  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    return;
  }

  try {
    const values = [serializeAuctionState(state)];
    await withGoogleRetry(
      () =>
        sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${TAB_AUCTION_STATE}!A2:U2`,
          valueInputOption: "RAW",
          requestBody: { values },
        }),
      { operationName: "SaveAuctionState" }
    );
  } catch (error) {
    console.error(`[SheetsRepository] Failed to save auction state for ${leagueId}:`, error);
    throw error;
  }
}

/**
 * Reads recent bids from Google Sheets
 */
export async function getRecentBidsFromSheets(
  leagueId: string,
  limit: number = 20,
  skipCache = false
): Promise<Bid[]> {
  const now = Date.now();
  if (!skipCache) {
    const cached = recentBidsCache.get(leagueId);
    if (cached && cached.expiresAt > now) {
      return cached.data.slice(0, limit);
    }
  }

  return coalesceRequest(`bids:${leagueId}`, async () => {
    const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
    const sheets = getGoogleSheetsClient();

    if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
      const mirror = getOrCreateMemoryMirror(leagueId);
      return mirror.bids.slice(0, limit);
    }

    try {
      const res = await withGoogleRetry(
        () =>
          sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${TAB_BID_HISTORY}!A2:K`,
          }),
        { operationName: "GetRecentBids" }
      );

      const rows = res.data.values || [];
      const bids: Bid[] = [];

      // Rows stored chronologically; read from end for recents
      for (let i = rows.length - 1; i >= 0 && bids.length < 50; i--) {
        const row = rows[i];
        if (row[10] === "TRUE") continue; // Exclude undone bids
        const bid = deserializeBid(row);
        if (bid) bids.push(bid);
      }

      recentBidsCache.set(leagueId, { data: bids, expiresAt: Date.now() + CACHE_TTL_MS });
      return bids.slice(0, limit);
    } catch (error) {
      console.error(`[SheetsRepository] Error fetching bids for ${leagueId}:`, error);
      return getOrCreateMemoryMirror(leagueId).bids.slice(0, limit);
    }
  });
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
  recentBidsCache.delete(leagueId);

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    return;
  }

  try {
    const values = [serializeBid(bid, leagueId)];
    await withGoogleRetry(
      () =>
        sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${TAB_BID_HISTORY}!A1`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values },
        }),
      { operationName: "AppendBid" }
    );
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
  recentBidsCache.delete(leagueId);

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    return undoneBid;
  }

  try {
    const res = await withGoogleRetry(
      () =>
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${TAB_BID_HISTORY}!A2:K`,
        }),
      { operationName: "FindUndoneBid" }
    );

    const rows = res.data.values || [];
    // Search backward for last row where isUndone !== TRUE
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i][10] !== "TRUE") {
        const rowIndex = i + 2; // 1-indexed, skipping header
        await withGoogleRetry(
          () =>
            sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `${TAB_BID_HISTORY}!K${rowIndex}`,
              valueInputOption: "RAW",
              requestBody: { values: [["TRUE"]] },
            }),
          { operationName: "MarkBidUndone" }
        );
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
 * Retrieves all finalized purchases from Google Sheets
 */
export async function getPurchasesFromSheets(leagueId: string): Promise<PurchaseRecord[]> {
  const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
  const sheets = getGoogleSheetsClient();

  if (!isGoogleSheetsConfigured() || !sheets || !spreadsheetId) {
    const mirror = getOrCreateMemoryMirror(leagueId);
    return mirror.purchases;
  }

  try {
    const res = await withGoogleRetry(
      () =>
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${TAB_PURCHASES}!A2:K`,
        }),
      { operationName: "GetPurchases" }
    );

    const rows = res.data.values || [];
    const purchases: PurchaseRecord[] = [];
    for (const row of rows) {
      const p = deserializePurchase(row);
      if (p) purchases.push(p);
    }
    return purchases;
  } catch (error) {
    console.error(`[SheetsRepository] Error fetching purchases for ${leagueId}:`, error);
    return getOrCreateMemoryMirror(leagueId).purchases;
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
    await withGoogleRetry(
      () =>
        sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${TAB_PURCHASES}!A1`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values },
        }),
      { operationName: "RecordPurchase" }
    );
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
    await withGoogleRetry(
      () =>
        sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${TAB_AUDIT_LOG}!A1`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values },
        }),
      { operationName: "AppendAuditLog" }
    );
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

export interface AuctionActionOptions {
  actionId?: string;
  clientVersion?: number;
}

/**
 * Executes an auction action inside a serialized write lock
 * Enforces the sequence:
 * 1. Check idempotency cache (returns previous result on network retries)
 * 2. Acquire local process mutex
 * 3. Fetch latest authoritative state from Google Sheets (bypassing read cache)
 * 4. Verify client version (optimistic concurrency check)
 * 5. Acquire lease lock with write-and-verify confirmation loop in Sheets
 * 6. Execute validation & action logic
 * 7. Commit atomic batchUpdate to Google Sheets
 * 8. Release lock, invalidate cache, store idempotency result
 */
export async function executeSerializedAuctionAction(
  leagueId: string,
  actionFn: (ctx: AuctionActionTransactionContext) => Promise<AuctionActionTransactionResult>,
  options?: AuctionActionOptions
): Promise<AuctionActionTransactionResult> {
  // 1. Idempotency fast-path: return cached result if actionId was already processed
  if (options?.actionId) {
    const cachedResult = getCachedIdempotentResult(options.actionId);
    if (cachedResult) {
      return cachedResult;
    }
  }

  return runSerialized(leagueId, async () => {
    const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
    const sheets = getGoogleSheetsClient();
    const lockToken = `lock-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = Date.now();

    // 2. Fetch latest authoritative state directly from Sheets (bypassing cache)
    const [currentState, currentTeams, currentPlayers, config, recentBids] = await Promise.all([
      getAuctionStateFromSheets(leagueId, true),
      getTeamsFromSheets(leagueId, true),
      getPlayersFromSheets(leagueId, true),
      getLeagueConfigFromSheets(leagueId, true),
      getRecentBidsFromSheets(leagueId, 10, true),
    ]);

    // 3. Optimistic concurrency version check
    if (
      options?.clientVersion != null &&
      options.clientVersion > 0 &&
      currentState.version !== options.clientVersion
    ) {
      return {
        success: false,
        error: `Stale state conflict: Current auction version is ${currentState.version}, but client submitted version ${options.clientVersion}. Please refresh.`,
      };
    }

    // 4. Check & acquire lease lock in Sheets if configured
    if (isGoogleSheetsConfigured() && sheets && spreadsheetId) {
      if (currentState.lockToken && currentState.lockExpiresAt) {
        const lockExpiryTime = new Date(currentState.lockExpiresAt).getTime();
        if (lockExpiryTime > now && currentState.lockToken !== lockToken) {
          // Lock held by another process; back off with jitter and retry once
          const backoff = 200 + Math.floor(Math.random() * 200);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          const refreshed = await getAuctionStateFromSheets(leagueId, true);
          if (
            refreshed.lockToken &&
            new Date(refreshed.lockExpiresAt || 0).getTime() > Date.now()
          ) {
            return {
              success: false,
              error: "Auction is currently processing another transaction. Please retry in a moment.",
            };
          }
        }
      }

      // Claim lease lock in Sheets
      const lockExpiresAt = new Date(now + 5000).toISOString();
      currentState.lockToken = lockToken;
      currentState.lockExpiresAt = lockExpiresAt;

      await withGoogleRetry(
        () =>
          sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${TAB_AUCTION_STATE}!N2:O2`,
            valueInputOption: "RAW",
            requestBody: { values: [[lockToken, lockExpiresAt]] },
          }),
        { operationName: "AcquireLeaseLock" }
      );

      // Write-and-verify confirmation loop (Phase 5.1 production audit)
      await new Promise((resolve) => setTimeout(resolve, 100 + Math.floor(Math.random() * 50)));
      const verifyRes = await withGoogleRetry(
        () =>
          sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${TAB_AUCTION_STATE}!N2`,
          }),
        { operationName: "VerifyLeaseLock" }
      );
      const confirmedToken = verifyRes.data.values?.[0]?.[0];
      if (confirmedToken && confirmedToken !== lockToken) {
        return {
          success: false,
          error: "Lock contention conflict: Another transaction acquired the lease simultaneously. Please retry.",
        };
      }
    }

    try {
      // 5. Execute action callback
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
          await withGoogleRetry(
            () =>
              sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${TAB_AUCTION_STATE}!N2:O2`,
                valueInputOption: "RAW",
                requestBody: { values: [["", ""]] },
              }),
            { operationName: "ReleaseLeaseLockOnFailure" }
          ).catch(() => {});
        }
        return result;
      }

      // 6. Consolidate updates into atomic batchUpdate
      const updatedState = result.newState || currentState;
      updatedState.version = (currentState.version || 1) + 1;
      updatedState.lockToken = null;
      updatedState.lockExpiresAt = null;
      updatedState.updatedAt = new Date().toISOString();

      if (isGoogleSheetsConfigured() && sheets && spreadsheetId) {
        const batchData: Array<{ range: string; values: string[][] }> = [];

        // Updated auction state row (A2:P2)
        batchData.push({
          range: `${TAB_AUCTION_STATE}!A2:P2`,
          values: [serializeAuctionState(updatedState)],
        });

        // Updated teams (if modified)
        if (result.updatedTeams && result.updatedTeams.length > 0) {
          batchData.push({
            range: `${TAB_TEAMS}!A2:T${result.updatedTeams.length + 1}`,
            values: result.updatedTeams.map(serializeTeam),
          });
        }

        // Updated players (if modified)
        if (result.updatedPlayers && result.updatedPlayers.length > 0) {
          batchData.push({
            range: `${TAB_PLAYERS}!A2:V${result.updatedPlayers.length + 1}`,
            values: result.updatedPlayers.map(serializePlayer),
          });
        }

        // Commit consolidated values in ONE atomic batchUpdate request!
        await withGoogleRetry(
          () =>
            sheets.spreadsheets.values.batchUpdate({
              spreadsheetId,
              requestBody: {
                valueInputOption: "RAW",
                data: batchData,
              },
            }),
          { operationName: "BatchUpdateAuctionStateAndEntities" }
        );

        // Concurrent appends for bid history, purchase record, and audit log
        const appends: Promise<unknown>[] = [];
        if (result.newBid) {
          appends.push(appendBidToSheets(leagueId, result.newBid));
        }
        if (result.newPurchase) {
          appends.push(recordPurchaseInSheets(leagueId, result.newPurchase));
        }
        if (result.auditEntry) {
          appends.push(appendAuditLogInSheets(leagueId, result.auditEntry));
        }

        if (appends.length > 0) {
          await Promise.all(appends);
        }
      }

      // Invalidate short-lived caches and sync local memory mirror
      invalidateLeagueCache(leagueId);
      const mirror = getOrCreateMemoryMirror(leagueId);
      mirror.state = updatedState;
      if (result.updatedTeams) mirror.teams = result.updatedTeams;
      if (result.updatedPlayers) mirror.players = result.updatedPlayers;

      // Store in idempotency cache
      storeIdempotentResult(options?.actionId, result);

      return {
        ...result,
        newState: updatedState,
      };
    } catch (err) {
      console.error(`[SheetsRepository] Transaction execution failure for ${leagueId}:`, err);

      // Attempt to clear lock on unexpected crash
      if (isGoogleSheetsConfigured() && sheets && spreadsheetId) {
        try {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${TAB_AUCTION_STATE}!N2:O2`,
            valueInputOption: "RAW",
            requestBody: { values: [["", ""]] },
          });
        } catch {}
      }

      return {
        success: false,
        error: `Persistence error: ${(err as Error).message || "Transaction failed"}`,
      };
    }
  });
}

// ==============================================================================
// DATA RECONCILIATION & RECOVERY UTILITY
// Audits purchases, team purses, and player ownership to repair any inconsistencies
// ==============================================================================

export interface ReconciliationReport {
  leagueId: string;
  discrepanciesFound: number;
  fixedTeams: Array<{
    teamId: string;
    teamName: string;
    oldPurse: number;
    newPurse: number;
    oldPlayersCount: number;
    newPlayersCount: number;
  }>;
  fixedPlayers: Array<{
    playerId: string;
    playerName: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  totalPurchasesAudited: number;
  totalPurseSpentAudited: number;
  timestamp: string;
}

export async function reconcileLeaguePurchasesAndPurses(
  leagueId: string
): Promise<ReconciliationReport> {
  return runSerialized(leagueId, async () => {
    const spreadsheetId = resolveSpreadsheetIdForLeague(leagueId);
    const sheets = getGoogleSheetsClient();

    // 1. Fetch latest raw records bypassing cache
    const [purchases, teams, players] = await Promise.all([
      getPurchasesFromSheets(leagueId),
      getTeamsFromSheets(leagueId, true),
      getPlayersFromSheets(leagueId, true),
    ]);

    const report: ReconciliationReport = {
      leagueId,
      discrepanciesFound: 0,
      fixedTeams: [],
      fixedPlayers: [],
      totalPurchasesAudited: purchases.length,
      totalPurseSpentAudited: 0,
      timestamp: new Date().toISOString(),
    };

    // Calculate total spend & player roster per team from canonical purchases
    const teamSpendMap = new Map<string, number>();
    const teamPlayerCountMap = new Map<string, number>();
    for (const p of purchases) {
      report.totalPurseSpentAudited += p.soldPrice || 0;
      teamSpendMap.set(p.teamId, (teamSpendMap.get(p.teamId) || 0) + (p.soldPrice || 0));
      teamPlayerCountMap.set(p.teamId, (teamPlayerCountMap.get(p.teamId) || 0) + 1);
    }

    // 2. Audit and fix Teams
    let teamsChanged = false;
    const reconciledTeams = teams.map((team) => {
      const currentPurse = team.purse || {
        id: `purse-${team.id}`,
        teamId: team.id,
        totalBudget: 5000000,
        spentAmount: 0,
        remainingAmount: 5000000,
        minPlayers: 15,
        maxPlayers: 18,
        reservedForSquad: 350000,
      };
      const spent = teamSpendMap.get(team.id) || 0;
      const expectedRemaining = Math.max(0, (currentPurse.totalBudget || 5000000) - spent);
      const expectedPlayersCount = teamPlayerCountMap.get(team.id) || 0;

      if (
        currentPurse.remainingAmount !== expectedRemaining ||
        currentPurse.spentAmount !== spent ||
        (team.squadCount || 0) !== expectedPlayersCount
      ) {
        report.discrepanciesFound++;
        report.fixedTeams.push({
          teamId: team.id,
          teamName: team.name,
          oldPurse: currentPurse.remainingAmount,
          newPurse: expectedRemaining,
          oldPlayersCount: team.squadCount || 0,
          newPlayersCount: expectedPlayersCount,
        });
        teamsChanged = true;
        return {
          ...team,
          squadCount: expectedPlayersCount,
          purse: {
            ...currentPurse,
            spentAmount: spent,
            remainingAmount: expectedRemaining,
          },
        };
      }
      return team;
    });

    // 3. Audit and fix Players
    let playersChanged = false;
    const purchaseByPlayerId = new Map<string, PurchaseRecord>();
    for (const p of purchases) {
      purchaseByPlayerId.set(p.playerId, p);
    }

    const reconciledPlayers = players.map((player) => {
      const canonicalPurchase = purchaseByPlayerId.get(player.id);
      const updated = { ...player };

      if (canonicalPurchase) {
        if (player.status !== "SOLD") {
          report.discrepanciesFound++;
          report.fixedPlayers.push({
            playerId: player.id,
            playerName: player.fullName,
            field: "status",
            oldValue: player.status,
            newValue: "SOLD",
          });
          updated.status = "SOLD";
          playersChanged = true;
        }
        if (player.soldPrice !== canonicalPurchase.soldPrice) {
          report.discrepanciesFound++;
          report.fixedPlayers.push({
            playerId: player.id,
            playerName: player.fullName,
            field: "soldPrice",
            oldValue: player.soldPrice,
            newValue: canonicalPurchase.soldPrice,
          });
          updated.soldPrice = canonicalPurchase.soldPrice;
          playersChanged = true;
        }
        if (player.soldToTeamId !== canonicalPurchase.teamId) {
          report.discrepanciesFound++;
          report.fixedPlayers.push({
            playerId: player.id,
            playerName: player.fullName,
            field: "soldToTeamId",
            oldValue: player.soldToTeamId,
            newValue: canonicalPurchase.teamId,
          });
          updated.soldToTeamId = canonicalPurchase.teamId;
          playersChanged = true;
        }
      }

      return updated;
    });

    // 4. If discrepancies found, commit atomically via batchUpdate
    if (report.discrepanciesFound > 0) {
      if (isGoogleSheetsConfigured() && sheets && spreadsheetId) {
        const batchData: Array<{ range: string; values: string[][] }> = [];
        if (teamsChanged && reconciledTeams.length > 0) {
          batchData.push({
            range: `${TAB_TEAMS}!A2:T${reconciledTeams.length + 1}`,
            values: reconciledTeams.map(serializeTeam),
          });
        }
        if (playersChanged && reconciledPlayers.length > 0) {
          batchData.push({
            range: `${TAB_PLAYERS}!A2:V${reconciledPlayers.length + 1}`,
            values: reconciledPlayers.map(serializePlayer),
          });
        }

        if (batchData.length > 0) {
          await withGoogleRetry(
            () =>
              sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                requestBody: {
                  valueInputOption: "RAW",
                  data: batchData,
                },
              }),
            { operationName: "CommitReconciledData" }
          );
        }

        // Record Audit Log entry
        await appendAuditLogInSheets(leagueId, {
          id: `reconcile-${Date.now()}`,
          seasonId: leagueId,
          actionType: "DATA_RECONCILIATION",
          actor: "SYSTEM_RECONCILER",
          detailsJson: JSON.stringify({
            discrepanciesFound: report.discrepanciesFound,
            fixedTeamsCount: report.fixedTeams.length,
            fixedPlayersCount: report.fixedPlayers.length,
          }),
          timestamp: new Date().toISOString(),
        });
      }

      // Update memory mirror and invalidate cache
      const mirror = getOrCreateMemoryMirror(leagueId);
      if (teamsChanged) mirror.teams = reconciledTeams;
      if (playersChanged) mirror.players = reconciledPlayers;
      invalidateLeagueCache(leagueId);
    }

    return report;
  });
}

