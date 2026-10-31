// ==============================================================================
// NTL CRICKET AUCTION PLATFORM - DYNAMIC MINIMUM PURSE RESERVE & MAXIMUM BID VALIDATOR
// Pure authoritative calculation engine enforcing minimum squad size reserve rules
// ==============================================================================

import { Team, Player, AuctionRules, PlayerCategory, TeamCategoryLimits } from "@/types";

export interface PurseReserveCalculationParams {
  remainingPurse: number;
  minimumSquadSize: number;
  playersPurchased: number;
  minimumBasePrice: number;
  categoryMinimumBasePrices?: Partial<Record<PlayerCategory, number>>;
  teamCategoryLimits?: TeamCategoryLimits;
  teamPurchasedPlayers?: Player[];
  currentPlayerCategory?: PlayerCategory;
}

export interface PurseReserveCalculationResult {
  remainingPlayersAfterCurrentBid: number;
  requiredReserve: number;
  maximumBidAllowed: number;
  remainingPurse: number;
  playersPurchased: number;
  minimumSquadSize: number;
  minimumBasePrice: number;
}

/**
 * Core formula calculation complying with Phase 5.3 specifications:
 * 
 * remainingPlayersAfterCurrentBid = max(0, minimumSquadSize - playersPurchased - 1)
 * requiredReserve = remainingPlayersAfterCurrentBid * minimumBasePrice
 * maximumBidAllowed = max(0, remainingPurse - requiredReserve)
 */
export function calculatePurseReserve(
  params: PurseReserveCalculationParams
): PurseReserveCalculationResult {
  const {
    remainingPurse,
    minimumSquadSize,
    playersPurchased,
    minimumBasePrice,
    categoryMinimumBasePrices,
    teamCategoryLimits,
    teamPurchasedPlayers = [],
    currentPlayerCategory,
  } = params;

  // 1. Calculate remaining squad slots required after potentially winning current player
  const remainingPlayersAfterCurrentBid = Math.max(
    0,
    minimumSquadSize - playersPurchased - 1
  );

  // 2. Calculate required reserve (supporting category-specific floor prices if configured)
  let requiredReserve = 0;

  if (remainingPlayersAfterCurrentBid > 0) {
    if (categoryMinimumBasePrices && Object.keys(categoryMinimumBasePrices).length > 0) {
      let slotsToFill = remainingPlayersAfterCurrentBid;

      // Handle category quotas (e.g. min_emerging requirement)
      if (teamCategoryLimits?.min_emerging && teamCategoryLimits.min_emerging > 0) {
        const currentEmergingCount =
          teamPurchasedPlayers.filter((p) => p.category === "EMERGING").length +
          (currentPlayerCategory === "EMERGING" ? 1 : 0);

        const neededEmerging = Math.max(0, teamCategoryLimits.min_emerging - currentEmergingCount);
        const emergingSlots = Math.min(slotsToFill, neededEmerging);
        const emergingPrice = categoryMinimumBasePrices.EMERGING ?? minimumBasePrice;

        requiredReserve += emergingSlots * emergingPrice;
        slotsToFill -= emergingSlots;
      }

      // Remaining unfilled slots use the lowest category base price (or league-wide minimum)
      if (slotsToFill > 0) {
        const activePrices = Object.values(categoryMinimumBasePrices).filter(
          (p): p is number => typeof p === "number" && p > 0
        );
        const lowestCategoryPrice =
          activePrices.length > 0 ? Math.min(...activePrices) : minimumBasePrice;
        const effectiveFloorPrice = Math.min(minimumBasePrice, lowestCategoryPrice);

        requiredReserve += slotsToFill * effectiveFloorPrice;
      }
    } else {
      // Standard league-wide formula
      requiredReserve = remainingPlayersAfterCurrentBid * minimumBasePrice;
    }
  }

  // 3. Maximum bid allowed (never negative)
  const rawMaxBid = remainingPurse - requiredReserve;
  const maximumBidAllowed = Math.max(0, rawMaxBid);

  return {
    remainingPlayersAfterCurrentBid,
    requiredReserve,
    maximumBidAllowed,
    remainingPurse,
    playersPurchased,
    minimumSquadSize,
    minimumBasePrice,
  };
}

export interface TeamPurseReserveAnalysis extends PurseReserveCalculationResult {
  teamId: string;
  teamName: string;
  teamShortCode: string;
  remainingPlayersRequired: number; // max(0, minimumSquadSize - playersPurchased)
  isEligibleToBid: boolean;
  ineligibilityReason?: string;
  isCurrentLeader: boolean;
  nextBidAmount: number;
  isCompleted: boolean;
  requiredSquadSize: number;
  completionStatus: 'INCOMPLETE' | 'COMPLETED';
}

/**
 * Computes complete bidding eligibility and reserve analysis for a team
 */
export function analyzeTeamBiddingEligibility(
  team: Team,
  options: {
    rules: AuctionRules;
    currentPlayer?: Player | null;
    nextBidAmount: number;
    isCurrentLeadingTeam?: boolean;
    allPurchasedPlayersForTeam?: Player[];
  }
): TeamPurseReserveAnalysis {
  const {
    rules,
    currentPlayer,
    nextBidAmount,
    isCurrentLeadingTeam = false,
    allPurchasedPlayersForTeam = [],
  } = options;

  // Determine actual players purchased
  // Uses actual valid purchased players list if provided, otherwise team.squadCount
  const playersPurchased =
    allPurchasedPlayersForTeam.length > 0
      ? allPurchasedPlayersForTeam.length
      : team.squadCount || 0;

  // Team remaining purse
  const remainingPurse = team.purse?.remainingAmount ?? 5000000;

  // Team minimum squad size (team-specific or league rule)
  const minimumSquadSize =
    team.purse?.minPlayers || rules.minimumSquadSize || 15;

  // Maximum squad limit
  const maxSquadSize = team.purse?.maxPlayers || 18;

  // League minimum base price (default 25000 if not configured)
  const minimumBasePrice =
    rules.minimumBasePrice ||
    (rules.categoryBasePrices?.SILVER ?? rules.silverBasePrice ?? 25000);

  // Core reserve calculation
  const reserveResult = calculatePurseReserve({
    remainingPurse,
    minimumSquadSize,
    playersPurchased,
    minimumBasePrice,
    categoryMinimumBasePrices: rules.categoryMinimumBasePrices,
    teamCategoryLimits: team.categoryLimits,
    teamPurchasedPlayers: allPurchasedPlayersForTeam,
    currentPlayerCategory: currentPlayer?.category,
  });

  const remainingPlayersRequired = Math.max(0, minimumSquadSize - playersPurchased);
  const isCompleted = playersPurchased >= minimumSquadSize;

  // Evaluate Eligibility
  let isEligibleToBid = true;
  let ineligibilityReason: string | undefined = undefined;

  if (isCompleted) {
    isEligibleToBid = false;
    ineligibilityReason = `Squad completed (${playersPurchased}/${minimumSquadSize} players required)`;
  } else if (isCurrentLeadingTeam) {
    isEligibleToBid = false;
    ineligibilityReason = "Already leading current highest bid";
  } else if (playersPurchased >= maxSquadSize) {
    isEligibleToBid = false;
    ineligibilityReason = `Squad limit reached (${playersPurchased}/${maxSquadSize} players)`;
  } else if (remainingPurse < reserveResult.requiredReserve) {
    // Example D condition: Team cannot afford required reserve
    isEligibleToBid = false;
    ineligibilityReason = `Cannot afford minimum squad reserve (Purse: ₹${remainingPurse.toLocaleString()} < Reserve: ₹${reserveResult.requiredReserve.toLocaleString()} for ${reserveResult.remainingPlayersAfterCurrentBid} remaining slots)`;
  } else if (reserveResult.maximumBidAllowed < nextBidAmount) {
    isEligibleToBid = false;
    ineligibilityReason = `Maximum permitted bid (₹${reserveResult.maximumBidAllowed.toLocaleString()}) is below next valid bid (₹${nextBidAmount.toLocaleString()})`;
  } else if (currentPlayer?.category && team.categoryLimits) {
    // Check category maximum caps
    const cat = currentPlayer.category;
    if (cat === "ICON" && team.categoryLimits.max_icon) {
      const currentIcons = allPurchasedPlayersForTeam.filter((p) => p.category === "ICON").length;
      if (currentIcons >= team.categoryLimits.max_icon) {
        isEligibleToBid = false;
        ineligibilityReason = `Maximum ICON player cap reached (${currentIcons}/${team.categoryLimits.max_icon})`;
      }
    } else if (cat === "PLATINUM" && team.categoryLimits.max_platinum) {
      const currentPlats = allPurchasedPlayersForTeam.filter((p) => p.category === "PLATINUM").length;
      if (currentPlats >= team.categoryLimits.max_platinum) {
        isEligibleToBid = false;
        ineligibilityReason = `Maximum PLATINUM player cap reached (${currentPlats}/${team.categoryLimits.max_platinum})`;
      }
    }
  }

  return {
    ...reserveResult,
    teamId: team.id,
    teamName: team.name,
    teamShortCode: team.shortCode,
    remainingPlayersRequired,
    isEligibleToBid,
    ineligibilityReason,
    isCurrentLeader: isCurrentLeadingTeam,
    nextBidAmount,
    isCompleted,
    requiredSquadSize: minimumSquadSize,
    completionStatus: isCompleted ? "COMPLETED" : "INCOMPLETE",
  };
}

/**
 * Validates whether a specific proposed bid amount is permissible for a team
 */
export function validateBidEligibility(
  team: Team,
  proposedBidAmount: number,
  options: {
    rules: AuctionRules;
    currentPlayer?: Player | null;
    isCurrentLeadingTeam?: boolean;
    allPurchasedPlayersForTeam?: Player[];
  }
): { valid: boolean; error?: string; analysis: TeamPurseReserveAnalysis } {
  const analysis = analyzeTeamBiddingEligibility(team, {
    rules: options.rules,
    currentPlayer: options.currentPlayer,
    nextBidAmount: proposedBidAmount,
    isCurrentLeadingTeam: options.isCurrentLeadingTeam,
    allPurchasedPlayersForTeam: options.allPurchasedPlayersForTeam,
  });

  if (analysis.isCurrentLeader) {
    return {
      valid: false,
      error: `Action Rejected: ${team.name} already holds the highest standing bid.`,
      analysis,
    };
  }

  if (analysis.playersPurchased >= (team.purse?.maxPlayers || 18)) {
    return {
      valid: false,
      error: `Squad Limit Reached: ${team.name} already has maximum squad size (${analysis.playersPurchased} players).`,
      analysis,
    };
  }

  if (analysis.remainingPurse < analysis.requiredReserve) {
    return {
      valid: false,
      error: `Purse Reserve Violation: ${team.name} has ₹${analysis.remainingPurse.toLocaleString()} remaining, but requires ₹${analysis.requiredReserve.toLocaleString()} reserve to purchase ${analysis.remainingPlayersAfterCurrentBid} remaining squad players. Cannot place bids.`,
      analysis,
    };
  }

  if (proposedBidAmount > analysis.maximumBidAllowed) {
    return {
      valid: false,
      error: `Bid Limit Exceeded: Bid of ₹${proposedBidAmount.toLocaleString()} exceeds maximum permitted bid of ₹${analysis.maximumBidAllowed.toLocaleString()} (₹${analysis.requiredReserve.toLocaleString()} must be retained for ${analysis.remainingPlayersAfterCurrentBid} remaining squad slots).`,
      analysis,
    };
  }

  return { valid: true, analysis };
}
