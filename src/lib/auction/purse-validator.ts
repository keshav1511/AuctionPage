// ==============================================================================
// NTL CRICKET AUCTION PLATFORM - DYNAMIC MINIMUM PURSE RESERVE & MAXIMUM BID VALIDATOR
// Pure authoritative calculation engine enforcing minimum squad size reserve rules
// ==============================================================================

import { Team, Player, AuctionRules, PlayerCategory } from "@/types";
import { getTeamParticipantCounts, formatTeamParticipantBreakdown } from "./team-size-calculator";

export interface PurseReserveCalculationParams {
  remainingPurse: number;
  minimumSquadSize: number;
  maximumSquadSize?: number;
  playersPurchased: number; // totalParticipants
  minimumBasePrice: number;
  teamPurchasedPlayers?: Player[];
  currentPlayerCategory?: PlayerCategory;
}

export interface PurseReserveCalculationResult {
  remainingSlots: number; // max(0, minimumSquadSize - playersPurchased)
  remainingPlayersRequired: number; // alias for remainingSlots
  slotsAfterWinningCurrentPlayer: number; // max(0, minimumSquadSize - playersPurchased - 1)
  remainingPlayersAfterCurrentBid: number; // alias for slotsAfterWinningCurrentPlayer
  standingReserve: number; // remainingSlots * minimumBasePrice
  requiredReserve: number; // alias for standingReserve (Reserve Required)
  biddingReserve: number; // slotsAfterWinningCurrentPlayer * minimumBasePrice
  maximumBidAllowed: number; // max(0, remainingPurse - biddingReserve)
  remainingPurse: number;
  playersPurchased: number;
  minimumSquadSize: number;
  maximumSquadSize: number;
  minimumBasePrice: number;
}

/**
 * Resolves tournament minimum base price (floor) from tournament rules with zero legacy fallbacks
 */
export function resolveEffectiveMinimumBasePrice(
  rules?: Partial<AuctionRules> | null,
  fallback: number = 1000
): number {
  if (!rules) return fallback;
  if (typeof rules.minimumBasePrice === "number" && rules.minimumBasePrice > 0) {
    return rules.minimumBasePrice;
  }
  if (typeof rules.basePrice === "number" && rules.basePrice > 0) {
    return rules.basePrice;
  }
  if (typeof rules.purseReservePerPlayer === "number" && rules.purseReservePerPlayer > 0) {
    return rules.purseReservePerPlayer;
  }
  return fallback;
}

/**
 * Resolves authoritative squad limits ensuring tournament rules strictly take precedence
 */
export function resolveEffectiveSquadLimits(
  rules?: Partial<AuctionRules> | null,
  team?: Pick<Team, "purse"> | null,
  defaultMin: number = 8,
  defaultMax: number = 8
): { minimumSquadSize: number; maximumSquadSize: number } {
  const min =
    typeof rules?.minimumSquadSize === "number" && rules.minimumSquadSize > 0
      ? rules.minimumSquadSize
      : typeof team?.purse?.minPlayers === "number" && team.purse.minPlayers > 0
      ? team.purse.minPlayers
      : defaultMin;

  const max =
    typeof rules?.maximumSquadSize === "number" && rules.maximumSquadSize > 0
      ? rules.maximumSquadSize
      : typeof team?.purse?.maxPlayers === "number" && team.purse.maxPlayers > 0
      ? team.purse.maxPlayers
      : Math.max(min, defaultMax);

  return { minimumSquadSize: min, maximumSquadSize: max };
}

/**
 * Core authoritative formula calculation complying with NTL Auction platform specifications:
 * 
 * Remaining Slots = max(0, Minimum Squad Size - Total Participants)
 * Standing Reserve (Reserve Required) = Remaining Slots × Minimum Base Price
 * Slots After Winning Current Player = max(0, Minimum Squad Size - Total Participants - 1)
 * Bidding Reserve = Slots After Winning Current Player × Minimum Base Price
 * Maximum Bid Allowed = max(0, Remaining Purse - Bidding Reserve)
 */
export function calculatePurseReserve(
  params: PurseReserveCalculationParams
): PurseReserveCalculationResult {
  const {
    remainingPurse,
    minimumSquadSize,
    maximumSquadSize = minimumSquadSize,
    playersPurchased,
    minimumBasePrice,
  } = params;

  // 1. Remaining slots needed to fulfill minimum squad requirement
  const remainingSlots = Math.max(0, minimumSquadSize - playersPurchased);

  // 2. Standing reserve required right now for all unfilled slots
  const standingReserve = remainingSlots * minimumBasePrice;

  // 3. Squad slots required after potentially winning the current player lot
  const slotsAfterWinningCurrentPlayer = Math.max(0, minimumSquadSize - playersPurchased - 1);

  // 4. Bidding reserve that MUST be retained for subsequent squad slots after winning current player
  const biddingReserve = slotsAfterWinningCurrentPlayer * minimumBasePrice;

  // 5. Maximum bid allowed on the current lot (never negative)
  const maximumBidAllowed = Math.max(0, remainingPurse - biddingReserve);

  return {
    remainingSlots,
    remainingPlayersRequired: remainingSlots,
    slotsAfterWinningCurrentPlayer,
    remainingPlayersAfterCurrentBid: slotsAfterWinningCurrentPlayer,
    standingReserve,
    requiredReserve: standingReserve,
    biddingReserve,
    maximumBidAllowed,
    remainingPurse,
    playersPurchased,
    minimumSquadSize,
    maximumSquadSize,
    minimumBasePrice,
  };
}

export interface TeamPurseReserveAnalysis extends PurseReserveCalculationResult {
  teamId: string;
  teamName: string;
  teamShortCode: string;
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
    allPurchasedPlayersForTeam,
  } = options;

  // Determine effective total participants:
  // Total Team Size = Registered Purchased Players + Team Owner (1 if assigned) + Team Icon (1 if assigned)
  const registeredCount =
    allPurchasedPlayersForTeam !== undefined
      ? allPurchasedPlayersForTeam.length
      : Math.max(
          0,
          (team.squadCount || 0) - ((team.ownerName ? 1 : 0) + (team.iconPlayerName ? 1 : 0))
        );

  const participantCounts = getTeamParticipantCounts(team, registeredCount);
  const totalParticipants = participantCounts.totalParticipants;
  const breakdown = formatTeamParticipantBreakdown(participantCounts);

  // Team remaining purse
  const remainingPurse = team.purse?.remainingAmount ?? (rules.totalPurse || 50000);

  // Authoritative squad limits from tournament rules
  const { minimumSquadSize, maximumSquadSize } = resolveEffectiveSquadLimits(rules, team, 8, 8);

  // Authoritative minimum base price (floor) from tournament rules
  const minimumBasePrice = resolveEffectiveMinimumBasePrice(rules, 1000);

  // Core authoritative reserve calculation
  const reserveResult = calculatePurseReserve({
    remainingPurse,
    minimumSquadSize,
    maximumSquadSize,
    playersPurchased: totalParticipants,
    minimumBasePrice,
    teamPurchasedPlayers: allPurchasedPlayersForTeam,
    currentPlayerCategory: currentPlayer?.category,
  });

  const isMinSquadMet = totalParticipants >= minimumSquadSize;
  const isMaxSquadReached = totalParticipants >= maximumSquadSize;
  const isCompleted = isMinSquadMet && minimumSquadSize === maximumSquadSize;

  // Individual player base price floor for the current spotlighted lot
  const playerLotFloorPrice = currentPlayer
    ? currentPlayer.basePriceOverride || currentPlayer.basePrice || minimumBasePrice
    : minimumBasePrice;

  // Evaluate Eligibility
  let isEligibleToBid = true;
  let ineligibilityReason: string | undefined = undefined;

  if (isCompleted) {
    isEligibleToBid = false;
    ineligibilityReason = `Squad completed (${totalParticipants}/${minimumSquadSize} participants). Current count: ${breakdown}`;
  } else if (isMaxSquadReached) {
    isEligibleToBid = false;
    ineligibilityReason = `Squad limit reached (${totalParticipants}/${maximumSquadSize} participants). Current count: ${breakdown}`;
  } else if (isCurrentLeadingTeam) {
    isEligibleToBid = false;
    ineligibilityReason = "Already leading current highest bid";
  } else if (remainingPurse < reserveResult.standingReserve) {
    // Cannot afford minimum squad reserve
    isEligibleToBid = false;
    ineligibilityReason = `Cannot afford minimum squad reserve (Purse: ₹${remainingPurse.toLocaleString()} < Reserve: ₹${reserveResult.standingReserve.toLocaleString()} for ${reserveResult.remainingSlots} remaining slots)`;
  } else if (reserveResult.maximumBidAllowed < nextBidAmount) {
    isEligibleToBid = false;
    ineligibilityReason = `Maximum permitted bid (₹${reserveResult.maximumBidAllowed.toLocaleString()}) is below next valid bid (₹${nextBidAmount.toLocaleString()})`;
  } else if (reserveResult.maximumBidAllowed < playerLotFloorPrice) {
    isEligibleToBid = false;
    ineligibilityReason = `Maximum permitted bid (₹${reserveResult.maximumBidAllowed.toLocaleString()}) is below player base price (₹${playerLotFloorPrice.toLocaleString()})`;
  }

  return {
    ...reserveResult,
    teamId: team.id,
    teamName: team.name,
    teamShortCode: team.shortCode,
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

  if (analysis.isCompleted) {
    return {
      valid: false,
      error: `Squad Completed: ${team.name} has already completed its required squad (${analysis.playersPurchased}/${analysis.requiredSquadSize} participants). ${analysis.ineligibilityReason || ""}`.trim(),
      analysis,
    };
  }

  if (analysis.playersPurchased >= analysis.maximumSquadSize) {
    return {
      valid: false,
      error: `Squad Limit Reached: ${team.name} already has maximum squad size (${analysis.playersPurchased}/${analysis.maximumSquadSize} participants). ${analysis.ineligibilityReason || ""}`.trim(),
      analysis,
    };
  }

  if (analysis.remainingPurse < analysis.standingReserve) {
    return {
      valid: false,
      error: `Purse Reserve Violation: ${team.name} has ₹${analysis.remainingPurse.toLocaleString()} remaining, but requires ₹${analysis.standingReserve.toLocaleString()} reserve to purchase ${analysis.remainingSlots} remaining squad players. Cannot place bids.`,
      analysis,
    };
  }

  if (proposedBidAmount > analysis.maximumBidAllowed) {
    return {
      valid: false,
      error: `Bid Limit Exceeded: Bid of ₹${proposedBidAmount.toLocaleString()} exceeds maximum permitted bid of ₹${analysis.maximumBidAllowed.toLocaleString()} (₹${analysis.biddingReserve.toLocaleString()} must be retained for ${analysis.slotsAfterWinningCurrentPlayer} remaining squad slots).`,
      analysis,
    };
  }

  return { valid: true, analysis };
}
