// ==============================================================================
// NTL AUCTION PLATFORM - CORE DOMAIN TYPE DEFINITIONS
// ==============================================================================

export type PlayerCategory = 'ICON' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'EMERGING';

export type PlayerRole = 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';

export type PlayerStatus = 'AVAILABLE' | 'ON_AUCTION' | 'SOLD' | 'UNSOLD' | 'WITHDRAWN';

export type AuctionStatus = 'IDLE' | 'IN_PROGRESS' | 'PAUSED' | 'FINISHED';

export type AdminRole = 'SUPER_ADMIN' | 'COMMISSIONER' | 'AUCTIONEER';

export interface League {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
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

export interface Team {
  id: string;
  seasonId: string;
  name: string;
  shortCode: string;
  logoUrl: string;
  ownerName: string;
  ownerPhotoUrl?: string;
  iconPlayerName?: string;
  primaryColor: string;
  secondaryColor: string;
  purse: TeamPurse;
  squadCount?: number;
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
  category: PlayerCategory;
  primaryRole: PlayerRole;
  battingStyle: string;
  bowlingStyle: string;
  photoUrl: string;
  basePrice: number;
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
  round: number;
  bidCount: number;
  recentBids: Bid[];
}

export interface BidSlab {
  max: number;
  step: number;
}

export interface AuctionRules {
  id: string;
  seasonId: string;
  iconBasePrice: number;
  platinumBasePrice: number;
  goldBasePrice: number;
  silverBasePrice: number;
  emergingBasePrice: number;
  bidSlabRules: BidSlab[];
  timerDurationSeconds: number;
}
