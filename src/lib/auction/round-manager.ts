// ==============================================================================
// NTL CRICKET AUCTION PLATFORM - ROUND 2 RE-AUCTION ENGINE
// Pure calculation and queue orchestration engine for Round 2 unsold re-auction
// ==============================================================================

import { Player, Round2QueueItem } from "@/types";

export interface RoundStatistics {
  round: number;
  roundStage: "MAIN" | "ROUND_2_TRANSITION" | "ROUND_2";
  roundLabel: string;
  totalInRound: number;
  soldCount: number;
  unsoldCount: number;
  pendingCount: number;
  completedCount: number;
  progressPercent: number;
}

/**
 * Detects whether the first-round sequence has completed.
 * First round is complete ONLY when:
 * 1. No players remain in 'AVAILABLE' status.
 * 2. No player is currently active in 'ON_AUCTION' status.
 */
export function detectRound1Completion(players: Player[]): boolean {
  if (!players || players.length === 0) return false;

  const hasAvailable = players.some((p) => p.status === "AVAILABLE");
  const hasOnAuction = players.some((p) => p.status === "ON_AUCTION");

  return !hasAvailable && !hasOnAuction;
}

/**
 * Extracts players eligible for Round 2 re-auction.
 * Strictly includes players whose final Round 1 status is 'UNSOLD'.
 * Strictly excludes 'SOLD', 'AVAILABLE', and 'WITHDRAWN' players.
 */
export function getEligibleRound2Players(players: Player[]): Player[] {
  if (!players) return [];
  return players.filter((p) => p.status === "UNSOLD");
}

/**
 * Randomizes the eligible unsold players into a fixed Round 2 queue.
 * Implements Fisher-Yates shuffle algorithm.
 * Guarantees each eligible unsold player appears exactly once with 'PENDING' status.
 */
export function createRound2Queue(unsoldPlayers: Player[]): {
  queue: Round2QueueItem[];
  orderedPlayers: Player[];
} {
  const eligible = [...unsoldPlayers];

  // Fisher-Yates shuffle
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }

  const queue: Round2QueueItem[] = eligible.map((p) => ({
    id: p.id,
    status: "PENDING" as const,
  }));

  return {
    queue,
    orderedPlayers: eligible,
  };
}

/**
 * Resolves full round progression statistics for both admin controls and spectator views
 */
export function calculateRoundStatistics(params: {
  players: Player[];
  round: number;
  roundStage?: "MAIN" | "ROUND_2_TRANSITION" | "ROUND_2";
  round2Queue?: Round2QueueItem[] | string[];
  currentPlayerId?: string | null;
}): RoundStatistics {
  const {
    players,
    round,
    roundStage = round === 2 ? "ROUND_2" : "MAIN",
    round2Queue = [],
  } = params;

  if (round === 2 || roundStage === "ROUND_2" || roundStage === "ROUND_2_TRANSITION") {
    // Normalize queue items
    const queueItems: Round2QueueItem[] = round2Queue.map((item) =>
      typeof item === "string" ? { id: item, status: "PENDING" as const } : item
    );

    const totalInRound = queueItems.length;
    const soldCount = queueItems.filter((item) => item.status === "SOLD").length;
    const unsoldCount = queueItems.filter((item) => item.status === "UNSOLD").length;
    const pendingCount = queueItems.filter((item) => item.status === "PENDING").length;
    const completedCount = soldCount + unsoldCount;
    const progressPercent = totalInRound > 0 ? Math.round((completedCount / totalInRound) * 100) : 100;

    return {
      round: 2,
      roundStage,
      roundLabel: "ROUND 2 — UNSOLD PLAYERS",
      totalInRound,
      soldCount,
      unsoldCount,
      pendingCount,
      completedCount,
      progressPercent,
    };
  }

  // Round 1 statistics based on all registered players
  const totalInRound = players.length;
  const soldCount = players.filter((p) => p.status === "SOLD").length;
  const unsoldCount = players.filter((p) => p.status === "UNSOLD").length;
  const pendingCount = players.filter(
    (p) => p.status === "AVAILABLE" || p.status === "ON_AUCTION"
  ).length;
  const completedCount = soldCount + unsoldCount;
  const progressPercent = totalInRound > 0 ? Math.round((completedCount / totalInRound) * 100) : 0;

  return {
    round: 1,
    roundStage: "MAIN",
    roundLabel: "ROUND 1 — MAIN AUCTION",
    totalInRound,
    soldCount,
    unsoldCount,
    pendingCount,
    completedCount,
    progressPercent,
  };
}
