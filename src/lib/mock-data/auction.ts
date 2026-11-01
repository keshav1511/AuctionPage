import { AuctionSession, AuctionRules, Bid } from "@/types";
import { DEFAULT_AUCTION_RULES } from "@/config/default-config";

export const MOCK_RULES: AuctionRules = DEFAULT_AUCTION_RULES;

export const MOCK_RECENT_BIDS: Bid[] = [];

export const MOCK_AUCTION_SESSION: AuctionSession = {
  id: "auction-main",
  seasonId: "league-main",
  currentPlayerId: null,
  currentPlayer: null,
  currentHighestBid: 0,
  currentLeadingTeamId: null,
  currentLeadingTeam: null,
  status: "IDLE",
  timerSeconds: 45,
  round: 1,
  bidCount: 0,
  recentBids: [],
};

/**
 * Calculates next minimum bid according to rules
 */
export function getNextMinimumBid(currentBid: number, basePrice: number): number {
  if (currentBid <= 0) return basePrice;

  if (MOCK_RULES.bidIncrements && MOCK_RULES.bidIncrements.length > 0) {
    for (const slab of MOCK_RULES.bidIncrements) {
      if (currentBid < slab.upTo) {
        return currentBid + slab.increment;
      }
    }
  }

  return currentBid + (MOCK_RULES.minBidIncrement || 500);
}
