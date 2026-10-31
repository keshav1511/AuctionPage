import { AuctionSession, AuctionRules, Bid } from "@/types";
import { MOCK_PLAYERS } from "./players";
import { MOCK_TEAMS } from "./teams";

export const MOCK_RULES: AuctionRules = {
  id: "rules-ntl-1",
  seasonId: "season-ntl-1",
  iconBasePrice: 200000,
  platinumBasePrice: 100000,
  goldBasePrice: 50000,
  silverBasePrice: 25000,
  emergingBasePrice: 15000,
  timerDurationSeconds: 30,
  bidSlabRules: [
    { max: 100000, step: 10000 },
    { max: 500000, step: 25000 },
    { max: 1000000, step: 50000 },
    { max: 999999999, step: 100000 },
  ],
};

export const MOCK_RECENT_BIDS: Bid[] = [
  {
    id: "bid-1",
    auctionId: "auction-1",
    playerId: "player-1",
    teamId: "team-1",
    teamName: "Nalanda Strikers",
    teamShortCode: "NST",
    teamLogoUrl: MOCK_TEAMS[0].logoUrl,
    amount: 100000,
    bidType: "BASE",
    placedAt: new Date(Date.now() - 45000).toISOString(),
  },
  {
    id: "bid-2",
    auctionId: "auction-1",
    playerId: "player-1",
    teamId: "team-3",
    teamName: "Magadh Warriors",
    teamShortCode: "MGW",
    teamLogoUrl: MOCK_TEAMS[2].logoUrl,
    amount: 150000,
    bidType: "STANDARD",
    placedAt: new Date(Date.now() - 30000).toISOString(),
  },
  {
    id: "bid-3",
    auctionId: "auction-1",
    playerId: "player-1",
    teamId: "team-1",
    teamName: "Nalanda Strikers",
    teamShortCode: "NST",
    teamLogoUrl: MOCK_TEAMS[0].logoUrl,
    amount: 200000,
    bidType: "STANDARD",
    placedAt: new Date(Date.now() - 18000).toISOString(),
  },
  {
    id: "bid-4",
    auctionId: "auction-1",
    playerId: "player-1",
    teamId: "team-5",
    teamName: "Maurya Super Kings",
    teamShortCode: "MSK",
    teamLogoUrl: MOCK_TEAMS[4].logoUrl,
    amount: 275000,
    bidType: "STANDARD",
    placedAt: new Date(Date.now() - 5000).toISOString(),
  },
];

export const MOCK_AUCTION_SESSION: AuctionSession = {
  id: "auction-1",
  seasonId: "season-ntl-1",
  currentPlayerId: "player-1",
  currentPlayer: MOCK_PLAYERS[0],
  currentHighestBid: 275000,
  currentLeadingTeamId: "team-5",
  currentLeadingTeam: MOCK_TEAMS[4],
  status: "IN_PROGRESS",
  timerSeconds: 21,
  round: 1,
  bidCount: 4,
  recentBids: MOCK_RECENT_BIDS,
};

/**
 * Calculates next minimum bid according to slab rules
 */
export function getNextMinimumBid(currentBid: number, basePrice: number): number {
  if (currentBid <= 0) return basePrice;

  for (const slab of MOCK_RULES.bidSlabRules) {
    if (currentBid < slab.max) {
      return currentBid + slab.step;
    }
  }

  return currentBid + 100000;
}
