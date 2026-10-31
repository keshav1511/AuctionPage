import { Player } from "@/types";
import { DriveFileMetadata } from "./drive-service";

export interface MatchResult {
  playerId: string;
  playerName: string;
  fileId: string;
  fileName: string;
  fileUrl: string;
  confidence: number; // 0 to 1
  isAutoMatched: boolean;
}

export interface DriveMatchSummary {
  totalPlayers: number;
  totalDriveFiles: number;
  matchedCount: number;
  missingCount: number;
  unmatchedFilesCount: number;
  matches: MatchResult[];
  unmatchedFiles: DriveFileMetadata[];
  missingPlayerIds: string[];
}

/**
 * Strips leading numbers, timestamps, prefixes like "1000147764 - ", file extensions, and extra whitespace
 */
export function cleanPlayerName(str: string): string {
  if (!str) return "";
  let name = str;

  // Remove file extension
  name = name.replace(/\.(jpg|jpeg|png|webp)$/i, "");

  // Remove leading numbers and hyphens (e.g. "1000147764 - Ashwin Pai")
  name = name.replace(/^[0-9_\-\s]+[_\-\s]+/, "");

  // Remove trailing numbers or brackets
  name = name.replace(/\([0-9]+\)/g, "");

  // Normalize spaces
  return name.trim().toLowerCase();
}

/**
 * Calculates a match score between a player name and a filename
 */
export function calculateMatchConfidence(playerName: string, fileName: string): number {
  const cleanPlayer = cleanPlayerName(playerName);
  const cleanFile = cleanPlayerName(fileName);

  if (!cleanPlayer || !cleanFile) return 0;

  // Exact match
  if (cleanPlayer === cleanFile) return 1.0;

  // Full substring containment
  if (cleanFile.includes(cleanPlayer) || cleanPlayer.includes(cleanFile)) {
    return 0.9;
  }

  // Token / word comparison
  const playerTokens = cleanPlayer.split(/\s+/).filter(Boolean);
  const fileTokens = cleanFile.split(/\s+/).filter(Boolean);

  const matchedTokens = playerTokens.filter((token) =>
    fileTokens.some((fToken) => fToken === token || fToken.startsWith(token))
  );

  if (matchedTokens.length === playerTokens.length) {
    return 0.85;
  }

  if (matchedTokens.length > 0) {
    return 0.5 + (0.35 * matchedTokens.length) / playerTokens.length;
  }

  return 0;
}

/**
 * Matches a list of players against Google Drive files
 */
export function matchPlayersWithDriveFiles(
  players: Player[],
  files: DriveFileMetadata[]
): DriveMatchSummary {
  const matches: MatchResult[] = [];
  const matchedFileIds = new Set<string>();
  const matchedPlayerIds = new Set<string>();

  // Pass 1: High confidence matches (score >= 0.7)
  for (const player of players) {
    let bestMatch: { file: DriveFileMetadata; score: number } | null = null;

    for (const file of files) {
      if (matchedFileIds.has(file.id)) continue;

      const score = calculateMatchConfidence(player.fullName, file.name);
      if (score >= 0.7 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { file, score };
      }
    }

    if (bestMatch) {
      matches.push({
        playerId: player.id,
        playerName: player.fullName,
        fileId: bestMatch.file.id,
        fileName: bestMatch.file.name,
        fileUrl: bestMatch.file.directUrl || `https://lh3.googleusercontent.com/d/${bestMatch.file.id}`,
        confidence: bestMatch.score,
        isAutoMatched: true,
      });
      matchedFileIds.add(bestMatch.file.id);
      matchedPlayerIds.add(player.id);
    }
  }

  const unmatchedFiles = files.filter((f) => !matchedFileIds.has(f.id));
  const missingPlayerIds = players
    .filter((p) => !matchedPlayerIds.has(p.id))
    .map((p) => p.id);

  return {
    totalPlayers: players.length,
    totalDriveFiles: files.length,
    matchedCount: matches.length,
    missingCount: missingPlayerIds.length,
    unmatchedFilesCount: unmatchedFiles.length,
    matches,
    unmatchedFiles,
    missingPlayerIds,
  };
}
