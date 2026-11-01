// ==============================================================================
// BLANK, ADMIN-CONFIGURABLE CRICKET AUCTION PLATFORM — DEFAULT CONFIGURATION
// Zero preloaded players, teams, owners, icons, or tournament-specific branding.
// Everything is created and configured dynamically by the tournament administrator.
// ==============================================================================

import { League, Team, Player, AuctionRules } from "@/types";

export const DEFAULT_DRIVE_PHOTO_BASE = "https://lh3.googleusercontent.com/d";

export function drivePhotoUrl(fileId?: string): string {
  if (!fileId) return "";
  return `${DEFAULT_DRIVE_PHOTO_BASE}/${fileId}`;
}

export const DEFAULT_LEAGUE: League = {
  id: "league-main",
  slug: "cricket-auction",
  name: "Cricket Auction",
  description: "Official Tournament Player Auction",
  logoUrl: "",
  orgName: "",
  orgLogoUrl: "",
  defaultBasePrice: 2000,
  defaultPurse: 100000,
  matchDate: "",
  matchVenue: "",
  auctionDate: "",
  auctionTime: "18:00",
  timezone: "Asia/Kolkata",
  primaryColor: "#059669",
  secondaryColor: "#F59E0B",
  brandingPalette: {
    primary: "#059669",
    secondary: "#F59E0B",
    accent: "#10B981",
    background: "#090D10",
    card: "#111827",
    border: "#1F2937",
    text: "#F9FAFB",
  },
};

export const DEFAULT_AUCTION_RULES: AuctionRules = {
  id: "rules-main",
  seasonId: "league-main",
  totalPurse: 100000,
  basePrice: 2000,
  minBidIncrement: 500,
  initialTimerSeconds: 45,
  bidExtensionSeconds: 10,
  bidExtensionThresholdSeconds: 10,
  minimumSquadSize: 8,
  maximumSquadSize: 8,
  purseReservePerPlayer: 2000,
  bidIncrements: [
    { upTo: 10000, increment: 500 },
    { upTo: 25000, increment: 1000 },
    { upTo: 50000, increment: 2000 },
    { upTo: 100000, increment: 5000 },
  ],
};

export const INITIAL_TEAMS: Team[] = [];

export const INITIAL_PLAYERS: Player[] = [];

// Backwards-compatible aliases pointing to clean blank defaults
export const NTL_DEFAULT_LEAGUE = DEFAULT_LEAGUE;
export const NTL_DEFAULT_RULES = DEFAULT_AUCTION_RULES;
export const NTL_TEAMS: Team[] = INITIAL_TEAMS;
export const NTL_PLAYERS: Player[] = INITIAL_PLAYERS;
export const NTL_OWNERS: Array<{ name: string; photoUrl?: string; teamAffiliation?: string }> = [];
export const NTL_ICONS: Array<{ name: string; photoUrl?: string; teamAffiliation?: string }> = [];
export const NTL_ORGANIZATIONS = {};
