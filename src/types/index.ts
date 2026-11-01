// ==============================================================================
// NTL AUCTION PLATFORM - CORE DOMAIN TYPE DEFINITIONS (PHASE 2)
// ==============================================================================

export type PlayerCategory = 'ICON' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'EMERGING';

export type PlayerRole = 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';

export type PlayerStatus = 'AVAILABLE' | 'ON_AUCTION' | 'SOLD' | 'UNSOLD' | 'WITHDRAWN';

export type PhotoMatchStatus = 'MATCHED' | 'UNMATCHED' | 'MANUAL_OVERRIDE';

export type AuctionStatus = 'IDLE' | 'IN_PROGRESS' | 'PAUSED' | 'FINISHED';

export type AdminRole = 'SUPER_ADMIN' | 'COMMISSIONER' | 'AUCTIONEER';

export interface BrandingPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  card: string;
  border: string;
  text: string;
}

export interface BackgroundCustomization {
  imageUrl?: string;
  driveFileId?: string;
  position?: 'center' | 'top' | 'bottom';
  scale?: 'cover' | 'contain' | 'fill';
  overlayOpacity?: number; // 0 to 100
}

export interface League {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logoUrl?: string;
  matchDate?: string;
  matchVenue?: string;
  auctionDate?: string;
  auctionTime?: string;
  timezone?: string;
  googleSheetsUrl?: string;
  googleDriveFolderUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  brandingPalette?: BrandingPalette;
  backgroundConfig?: BackgroundCustomization;
  importMetadata?: LeagueImportMetadata;
  created_at?: string;
}

export interface LeagueImportMetadata {
  lastImportedAt?: string;
  totalImported?: number;
  playerCount?: number;
  ownerCount?: number;
  iconCount?: number;
  teamCount?: number;
  sourceSheetId?: string;
  sourceFolderId?: string;
  sourceSheetUrl?: string;
  sourceDriveUrl?: string;
  validationStatus?: 'VALID' | 'WARNING' | 'ERROR';
}

export type RegistrationPersonType = 'PLAYER' | 'OWNER' | 'ICON';

export interface RegistrationRecord {
  rowIndex: number;
  name: string;
  type: RegistrationPersonType;
  photoRef: string;
  teamAffiliation?: string;
  category?: PlayerCategory;
  role?: PlayerRole;
  basePrice?: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  resolvedPhotoUrl?: string;
}

export interface RegistrationValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  playerCount: number;
  ownerCount: number;
  iconCount: number;
  teamsDiscovered: string[];
  duplicates: string[];
  unmatchedPhotos: string[];
  errors: string[];
  warnings: string[];
  records: RegistrationRecord[];
}

export interface Season {
  id: string;
  leagueId: string;
  edition: number;
  name: string;
  year: number;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
  totalPursePerTeam: number;
  minPlayersPerTeam: number;
  maxPlayersPerTeam: number;
}

export interface TeamCategoryLimits {
  max_icon?: number;
  max_platinum?: number;
  min_emerging?: number;
  [key: string]: number | undefined;
}

export interface Team {
  id: string;
  seasonId: string;
  name: string;
  shortCode: string;
  logoUrl: string;
  ownerName: string;
  ownerPhotoUrl?: string;
  iconPlayerName?: string;
  iconPlayerPhotoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  purse: TeamPurse;
  squadCount?: number;
  categoryLimits?: TeamCategoryLimits;
  isCompleted?: boolean;
  completionStatus?: "INCOMPLETE" | "PENDING_FINAL" | "COMPLETED";
}

export interface TeamPurse {
  id: string;
  teamId: string;
  totalBudget: number;
  spentAmount: number;
  remainingAmount: number;
  minPlayers: number;
  maxPlayers: number;
  reservedForSquad: number;
  totalPurse?: number;
  reservedPurse?: number;
}

export interface PlayerStatsSummary {
  matches?: number;
  runs?: number;
  wickets?: number;
  highestScore?: string;
  economy?: number;
  strikeRate?: number;
  notableAchievement?: string;
}

export interface Player {
  id: string;
  seasonId: string;
  registrationNo: string;
  fullName: string;
  name?: string;
  category: PlayerCategory;
  primaryRole: PlayerRole;
  battingStyle: string;
  bowlingStyle: string;
  photoUrl: string;
  originalPhotoUrl?: string;
  normalizedPhotoUrl?: string;
  photoAspectRatio?: string;
  photoMatchStatus?: PhotoMatchStatus;
  driveFileId?: string;
  basePrice: number;
  basePriceOverride?: number;
  status: PlayerStatus;
  sortOrder: number;
  statsSummary?: PlayerStatsSummary;
  soldToTeamId?: string;
  soldPrice?: number;
}

export interface Bid {
  id: string;
  auctionId: string;
  playerId: string;
  teamId: string;
  teamName?: string;
  teamShortCode?: string;
  teamLogoUrl?: string;
  amount: number;
  bidType: 'BASE' | 'STANDARD' | 'OVERRIDE' | 'UNDONE';
  placedAt: string;
}

export interface Round2QueueItem {
  id: string;
  status: "PENDING" | "SOLD" | "UNSOLD";
}

export interface AuctionAnnouncement {
  type: 'NONE' | 'SOLD' | 'UNSOLD';
  playerId?: string | null;
  player?: Player | null;
  winningTeamId?: string | null;
  winningTeam?: Team | null;
  soldPrice?: number | null;
  startedAt: string;
  endsAt: string;
}

export interface AuctionSession {
  id: string;
  seasonId: string;
  currentPlayerId: string | null;
  currentPlayer?: Player | null;
  currentHighestBid: number;
  currentLeadingTeamId: string | null;
  currentLeadingTeam?: Team | null;
  status: AuctionStatus;
  timerSeconds: number;
  timerExpiresAt?: string;
  lastBidAt?: string;
  bidExtensionSeconds?: number;
  round: number;
  roundStage?: 'MAIN' | 'ROUND_2_TRANSITION' | 'ROUND_2';
  round2Queue?: Round2QueueItem[];
  round2InitializedAt?: string;
  round1Completed?: boolean;
  announcement?: AuctionAnnouncement | null;
  bidCount: number;
  recentBids: Bid[];
}

export interface BidSlab {
  id?: string;
  min?: number;
  max: number;
  step: number;
}

export interface AuctionRules {
  id?: string;
  seasonId: string;
  iconBasePrice?: number;
  platinumBasePrice?: number;
  goldBasePrice?: number;
  silverBasePrice?: number;
  emergingBasePrice?: number;
  categoryBasePrices?: Record<PlayerCategory, number>;
  enableIndividualOverrides?: boolean;
  bidSlabRules?: BidSlab[];
  initialTimerSeconds: number;
  bidExtensionSeconds: number;
  timerDurationSeconds?: number;
  minimumSquadSize?: number;
  maximumSquadSize?: number;
  minimumBasePrice?: number;
  minBidIncrement?: number;
  purseAmount?: number;
  categoryQuotas?: Record<string, number>;
  bidIncrements?: Array<{ upTo: number; increment: number }>;
  categoryMinimumBasePrices?: Partial<Record<PlayerCategory, number>>;
}

export interface GoogleDriveFileRecord {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  webContentLink?: string;
  matchedPlayerId?: string;
  matchedPlayerName?: string;
  matchConfidence?: number;
}
