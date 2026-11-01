// ==============================================================================
// NTL AUCTION PLATFORM - GOOGLE SHEETS TAB DEFINITIONS & SCHEMAS
// Pure serialization & schema layer for 7 workbook tabs
// ==============================================================================

import {
  League,
  Team,
  Player,
  AuctionRules,
  Bid,
  PlayerCategory,
  PlayerRole,
  PlayerStatus,
  PhotoMatchStatus,
  AuctionStatus,
  BrandingPalette,
} from "@/types";

export const TAB_LEAGUE_CONFIG = "League_Config";
export const TAB_TEAMS = "Teams";
export const TAB_PLAYERS = "Players";
export const TAB_AUCTION_STATE = "Auction_State";
export const TAB_BID_HISTORY = "Bid_History";
export const TAB_PURCHASES = "Purchases";
export const TAB_AUDIT_LOG = "Audit_Log";

export const ALL_SHEET_TABS = [
  TAB_LEAGUE_CONFIG,
  TAB_TEAMS,
  TAB_PLAYERS,
  TAB_AUCTION_STATE,
  TAB_BID_HISTORY,
  TAB_PURCHASES,
  TAB_AUDIT_LOG,
] as const;

// ==============================================================================
// 1. LEAGUE_CONFIG SCHEMA
// ==============================================================================
export const LEAGUE_CONFIG_HEADERS = [
  "id",
  "slug",
  "name",
  "description",
  "logoUrl",
  "matchDate",
  "matchVenue",
  "auctionDate",
  "auctionTime",
  "timezone",
  "googleSheetsUrl",
  "googleDriveFolderUrl",
  "primaryColor",
  "secondaryColor",
  "brandingPaletteJson",
  "auctionRulesJson",
  "updatedAt",
];

export function serializeLeagueConfig(league: League, rules?: AuctionRules): string[] {
  const brandingWithBackground = {
    ...(league.brandingPalette || {}),
    backgroundConfig: league.backgroundConfig,
    importMetadata: league.importMetadata,
  };

  return [
    league.id || "",
    league.slug || "",
    league.name || "",
    league.description || "",
    league.logoUrl || "",
    league.matchDate || "",
    league.matchVenue || "",
    league.auctionDate || "",
    league.auctionTime || "",
    league.timezone || "Asia/Kolkata",
    league.googleSheetsUrl || "",
    league.googleDriveFolderUrl || "",
    league.primaryColor || "#059669",
    league.secondaryColor || "#F59E0B",
    JSON.stringify(brandingWithBackground),
    JSON.stringify(rules || {}),
    new Date().toISOString(),
  ];
}

export function deserializeLeagueConfig(row: (string | undefined)[]): { league: League; rules?: AuctionRules } | null {
  if (!row || row.length < 3 || !row[0]) return null;

  let brandingPalette: BrandingPalette | undefined;
  let backgroundConfig: League["backgroundConfig"] = undefined;
  let importMetadata: League["importMetadata"] = undefined;
  try {
    if (row[14]) {
      const parsed = JSON.parse(row[14]);
      brandingPalette = parsed;
      if (parsed.backgroundConfig) {
        backgroundConfig = parsed.backgroundConfig;
      }
      if (parsed.importMetadata) {
        importMetadata = parsed.importMetadata;
      }
    }
  } catch {}

  let rules: AuctionRules | undefined;
  try {
    if (row[15]) rules = JSON.parse(row[15]);
  } catch {}

  const league: League = {
    id: row[0],
    slug: row[1] || "",
    name: row[2] || "",
    description: row[3] || "",
    logoUrl: row[4] || "",
    matchDate: row[5] || "",
    matchVenue: row[6] || "",
    auctionDate: row[7] || "",
    auctionTime: row[8] || "",
    timezone: row[9] || "Asia/Kolkata",
    googleSheetsUrl: row[10] || "",
    googleDriveFolderUrl: row[11] || "",
    primaryColor: row[12] || "#059669",
    secondaryColor: row[13] || "#F59E0B",
    brandingPalette,
    backgroundConfig,
    importMetadata,
    created_at: row[16] || new Date().toISOString(),
  };

  return { league, rules };
}

// ==============================================================================
// 2. TEAMS SCHEMA
// ==============================================================================
export const TEAMS_HEADERS = [
  "id",
  "seasonId",
  "name",
  "shortCode",
  "logoUrl",
  "ownerName",
  "ownerPhotoUrl",
  "iconPlayerName",
  "iconPlayerPhotoUrl",
  "primaryColor",
  "secondaryColor",
  "totalBudget",
  "spentAmount",
  "remainingAmount",
  "minPlayers",
  "maxPlayers",
  "reservedForSquad",
  "squadCount",
  "categoryLimitsJson",
  "updatedAt",
];

export function serializeTeam(team: Team): string[] {
  const purse = team.purse || {
    id: `purse-${team.id}`,
    teamId: team.id,
    totalBudget: 5000000,
    spentAmount: 0,
    remainingAmount: 5000000,
    minPlayers: 15,
    maxPlayers: 18,
    reservedForSquad: 350000,
  };

  return [
    team.id || "",
    team.seasonId || "",
    team.name || "",
    team.shortCode || "",
    team.logoUrl || "",
    team.ownerName || "",
    team.ownerPhotoUrl || "",
    team.iconPlayerName || "",
    team.iconPlayerPhotoUrl || "",
    team.primaryColor || "#059669",
    team.secondaryColor || "#F59E0B",
    String(purse.totalBudget || 5000000),
    String(purse.spentAmount || 0),
    String(purse.remainingAmount || 5000000),
    String(purse.minPlayers || 15),
    String(purse.maxPlayers || 18),
    String(purse.reservedForSquad || 350000),
    String(team.squadCount || 0),
    JSON.stringify(team.categoryLimits || {}),
    new Date().toISOString(),
  ];
}

export function deserializeTeam(row: (string | undefined)[]): Team | null {
  if (!row || row.length < 3 || !row[0]) return null;

  let categoryLimits = undefined;
  try {
    if (row[18]) categoryLimits = JSON.parse(row[18]);
  } catch {}

  const totalBudget = Number(row[11]) || 5000000;
  const spentAmount = Number(row[12]) || 0;
  const remainingAmount = Number(row[13]) || (totalBudget - spentAmount);
  const minPlayers = Number(row[14]) || 15;
  const maxPlayers = Number(row[15]) || 18;
  const reservedForSquad = Number(row[16]) || 350000;
  const squadCount = Number(row[17]) || 0;

  return {
    id: row[0],
    seasonId: row[1] || "",
    name: row[2] || "",
    shortCode: row[3] || "",
    logoUrl: row[4] || "",
    ownerName: row[5] || "",
    ownerPhotoUrl: row[6] || "",
    iconPlayerName: row[7] || "",
    iconPlayerPhotoUrl: row[8] || "",
    primaryColor: row[9] || "#059669",
    secondaryColor: row[10] || "#F59E0B",
    purse: {
      id: `purse-${row[0]}`,
      teamId: row[0],
      totalBudget,
      spentAmount,
      remainingAmount,
      minPlayers,
      maxPlayers,
      reservedForSquad,
    },
    squadCount,
    categoryLimits,
  };
}

// ==============================================================================
// 3. PLAYERS SCHEMA
// ==============================================================================
export const PLAYERS_HEADERS = [
  "id",
  "seasonId",
  "registrationNo",
  "fullName",
  "category",
  "primaryRole",
  "battingStyle",
  "bowlingStyle",
  "photoUrl",
  "originalPhotoUrl",
  "normalizedPhotoUrl",
  "photoAspectRatio",
  "photoMatchStatus",
  "driveFileId",
  "basePrice",
  "basePriceOverride",
  "status",
  "sortOrder",
  "soldToTeamId",
  "soldPrice",
  "statsSummaryJson",
  "updatedAt",
];

export function serializePlayer(player: Player): string[] {
  return [
    player.id || "",
    player.seasonId || "",
    player.registrationNo || "",
    player.fullName || "",
    player.category || "SILVER",
    player.primaryRole || "BATSMAN",
    player.battingStyle || "Right Hand Bat",
    player.bowlingStyle || "Right Arm Medium",
    player.photoUrl || "",
    player.originalPhotoUrl || "",
    player.normalizedPhotoUrl || "",
    player.photoAspectRatio || "3:4",
    player.photoMatchStatus || "UNMATCHED",
    player.driveFileId || "",
    String(player.basePrice || 25000),
    player.basePriceOverride != null ? String(player.basePriceOverride) : "",
    player.status || "AVAILABLE",
    String(player.sortOrder || 0),
    player.soldToTeamId || "",
    player.soldPrice != null ? String(player.soldPrice) : "",
    JSON.stringify(player.statsSummary || {}),
    new Date().toISOString(),
  ];
}

export function deserializePlayer(row: (string | undefined)[]): Player | null {
  if (!row || row.length < 4 || !row[0]) return null;

  let statsSummary = undefined;
  try {
    if (row[20]) statsSummary = JSON.parse(row[20]);
  } catch {}

  return {
    id: row[0],
    seasonId: row[1] || "",
    registrationNo: row[2] || "",
    fullName: row[3] || "",
    category: (row[4] as PlayerCategory) || "SILVER",
    primaryRole: (row[5] as PlayerRole) || "BATSMAN",
    battingStyle: row[6] || "Right Hand Bat",
    bowlingStyle: row[7] || "Right Arm Medium",
    photoUrl: row[8] || "",
    originalPhotoUrl: row[9] || "",
    normalizedPhotoUrl: row[10] || "",
    photoAspectRatio: row[11] || "3:4",
    photoMatchStatus: (row[12] as PhotoMatchStatus) || "UNMATCHED",
    driveFileId: row[13] || "",
    basePrice: Number(row[14]) || 25000,
    basePriceOverride: row[15] ? Number(row[15]) : undefined,
    status: (row[16] as PlayerStatus) || "AVAILABLE",
    sortOrder: Number(row[17]) || 0,
    soldToTeamId: row[18] || undefined,
    soldPrice: row[19] ? Number(row[19]) : undefined,
    statsSummary,
  };
}

// ==============================================================================
// 4. AUCTION_STATE SCHEMA
// ==============================================================================
export const AUCTION_STATE_HEADERS = [
  "id",
  "seasonId",
  "status",
  "currentPlayerId",
  "currentHighestBid",
  "currentLeadingTeamId",
  "timerSeconds",
  "timerExpiresAt",
  "pausedRemainingSeconds",
  "round",
  "bidCount",
  "bidExtensionSeconds",
  "version",
  "lockToken",
  "lockExpiresAt",
  "updatedAt",
  "roundStage",
  "round2QueueJson",
  "round2InitializedAt",
  "round1Completed",
  "announcementJson",
];

export interface AuctionStateRow {
  id: string;
  seasonId: string;
  status: AuctionStatus;
  currentPlayerId: string | null;
  currentHighestBid: number;
  currentLeadingTeamId: string | null;
  timerSeconds: number;
  timerExpiresAt: string;
  pausedRemainingSeconds?: number;
  round: number;
  bidCount: number;
  bidExtensionSeconds: number;
  version: number;
  lockToken?: string | null;
  lockExpiresAt?: string | null;
  updatedAt?: string;
  roundStage?: 'MAIN' | 'ROUND_2_TRANSITION' | 'ROUND_2';
  round2QueueJson?: string;
  round2InitializedAt?: string;
  round1Completed?: boolean;
  announcementJson?: string;
}

export function serializeAuctionState(state: AuctionStateRow): string[] {
  return [
    state.id || "",
    state.seasonId || "",
    state.status || "IDLE",
    state.currentPlayerId || "",
    String(state.currentHighestBid || 0),
    state.currentLeadingTeamId || "",
    String(state.timerSeconds || 45),
    state.timerExpiresAt || new Date().toISOString(),
    state.pausedRemainingSeconds != null ? String(state.pausedRemainingSeconds) : "",
    String(state.round || 1),
    String(state.bidCount || 0),
    String(state.bidExtensionSeconds || 10),
    String(state.version || 1),
    state.lockToken || "",
    state.lockExpiresAt || "",
    new Date().toISOString(),
    state.roundStage || (state.round === 2 ? "ROUND_2" : "MAIN"),
    state.round2QueueJson || "[]",
    state.round2InitializedAt || "",
    state.round1Completed ? "TRUE" : "FALSE",
    state.announcementJson || "",
  ];
}

export function deserializeAuctionState(row: (string | undefined)[]): AuctionStateRow | null {
  if (!row || row.length < 3 || !row[0]) return null;

  return {
    id: row[0],
    seasonId: row[1] || "",
    status: (row[2] as AuctionStatus) || "IDLE",
    currentPlayerId: row[3] || null,
    currentHighestBid: Number(row[4]) || 0,
    currentLeadingTeamId: row[5] || null,
    timerSeconds: Number(row[6]) || 45,
    timerExpiresAt: row[7] || new Date().toISOString(),
    pausedRemainingSeconds: row[8] ? Number(row[8]) : undefined,
    round: Number(row[9]) || 1,
    bidCount: Number(row[10]) || 0,
    bidExtensionSeconds: Number(row[11]) || 10,
    version: Number(row[12]) || 1,
    lockToken: row[13] || null,
    lockExpiresAt: row[14] || null,
    updatedAt: row[15] || new Date().toISOString(),
    roundStage: (row[16] as 'MAIN' | 'ROUND_2_TRANSITION' | 'ROUND_2') || (Number(row[9]) === 2 ? "ROUND_2" : "MAIN"),
    round2QueueJson: row[17] || "[]",
    round2InitializedAt: row[18] || "",
    round1Completed: row[19] === "TRUE" || row[19] === "true",
    announcementJson: row[20] || undefined,
  };
}

// ==============================================================================
// 5. BID_HISTORY SCHEMA
// ==============================================================================
export const BID_HISTORY_HEADERS = [
  "id",
  "auctionId",
  "seasonId",
  "playerId",
  "teamId",
  "teamName",
  "teamShortCode",
  "amount",
  "bidType",
  "placedAt",
  "isUndone",
];

export function serializeBid(bid: Bid, seasonId: string = ""): string[] {
  return [
    bid.id || "",
    bid.auctionId || "",
    seasonId,
    bid.playerId || "",
    bid.teamId || "",
    bid.teamName || "",
    bid.teamShortCode || "",
    String(bid.amount || 0),
    bid.bidType || "STANDARD",
    bid.placedAt || new Date().toISOString(),
    "FALSE",
  ];
}

export function deserializeBid(row: (string | undefined)[]): Bid | null {
  if (!row || row.length < 5 || !row[0]) return null;

  return {
    id: row[0],
    auctionId: row[1] || "",
    playerId: row[3] || "",
    teamId: row[4] || "",
    teamName: row[5] || "",
    teamShortCode: row[6] || "",
    amount: Number(row[7]) || 0,
    bidType: (row[8] as Bid["bidType"]) || "STANDARD",
    placedAt: row[9] || new Date().toISOString(),
  };
}

// ==============================================================================
// 6. PURCHASES SCHEMA
// ==============================================================================
export const PURCHASES_HEADERS = [
  "id",
  "seasonId",
  "playerId",
  "playerName",
  "playerCategory",
  "playerRole",
  "teamId",
  "teamName",
  "soldPrice",
  "round",
  "soldAt",
];

export interface PurchaseRecord {
  id: string;
  seasonId: string;
  playerId: string;
  playerName: string;
  playerCategory: PlayerCategory;
  playerRole: PlayerRole;
  teamId: string;
  teamName: string;
  soldPrice: number;
  round: number;
  soldAt: string;
}

export function serializePurchase(purchase: PurchaseRecord): string[] {
  return [
    purchase.id || "",
    purchase.seasonId || "",
    purchase.playerId || "",
    purchase.playerName || "",
    purchase.playerCategory || "SILVER",
    purchase.playerRole || "BATSMAN",
    purchase.teamId || "",
    purchase.teamName || "",
    String(purchase.soldPrice || 0),
    String(purchase.round || 1),
    purchase.soldAt || new Date().toISOString(),
  ];
}

export function deserializePurchase(row: (string | undefined)[]): PurchaseRecord | null {
  if (!row || row.length < 7 || !row[0]) return null;

  return {
    id: row[0],
    seasonId: row[1] || "",
    playerId: row[2] || "",
    playerName: row[3] || "",
    playerCategory: (row[4] as PlayerCategory) || "SILVER",
    playerRole: (row[5] as PlayerRole) || "BATSMAN",
    teamId: row[6] || "",
    teamName: row[7] || "",
    soldPrice: Number(row[8]) || 0,
    round: Number(row[9]) || 1,
    soldAt: row[10] || new Date().toISOString(),
  };
}

// ==============================================================================
// 7. AUDIT_LOG SCHEMA
// ==============================================================================
export const AUDIT_LOG_HEADERS = [
  "id",
  "seasonId",
  "actionType",
  "actor",
  "detailsJson",
  "timestamp",
];

export interface AuditLogEntry {
  id: string;
  seasonId: string;
  actionType: string;
  actor: string;
  detailsJson: string;
  timestamp: string;
}

export function serializeAuditLog(log: AuditLogEntry): string[] {
  return [
    log.id || "",
    log.seasonId || "",
    log.actionType || "",
    log.actor || "AUCTIONEER",
    log.detailsJson || "{}",
    log.timestamp || new Date().toISOString(),
  ];
}

export function deserializeAuditLog(row: (string | undefined)[]): AuditLogEntry | null {
  if (!row || row.length < 3 || !row[0]) return null;

  return {
    id: row[0],
    seasonId: row[1] || "",
    actionType: row[2] || "",
    actor: row[3] || "AUCTIONEER",
    detailsJson: row[4] || "{}",
    timestamp: row[5] || new Date().toISOString(),
  };
}
