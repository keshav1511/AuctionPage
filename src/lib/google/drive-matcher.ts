import { Player } from "@/types";
import { DriveFileMetadata } from "./drive-service";

export type MatchEntityType = "PLAYER" | "OWNER" | "ICON";

export interface MatchEntity {
  id: string;
  name: string;
  type: MatchEntityType;
  teamId?: string;
  teamName?: string;
  currentPhotoUrl?: string;
}

export interface EntityMatchResult {
  entityId: string;
  entityName: string;
  entityType: MatchEntityType;
  teamName?: string;
  fileId?: string;
  fileName?: string;
  fileUrl?: string;
  confidence: number; // 0 to 1
  confidenceLabel: "EXACT" | "HIGH" | "REVIEW" | "UNMATCHED";
  status: "AUTO_MATCHED" | "MANUAL_ASSIGNED" | "UNMATCHED";
}

export interface MultiEntityMatchSummary {
  totalEntities: number;
  totalDriveFiles: number;
  matchedCount: number;
  missingCount: number;
  unmatchedFilesCount: number;
  results: EntityMatchResult[];
  players: EntityMatchResult[];
  owners: EntityMatchResult[];
  icons: EntityMatchResult[];
  unmatchedFiles: DriveFileMetadata[];
}

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
 * Strips leading numbers, timestamps, prefixes like "1000147764 - ", file extensions,
 * nicknames in brackets like "(kutta)", and extra whitespace.
 */
export function cleanPlayerName(str: string): string {
  if (!str) return "";
  let name = str;

  // Remove file extension
  name = name.replace(/\.(jpg|jpeg|png|webp|jfif)$/i, "");

  // Remove leading numbers, IDs, and hyphens (e.g. "1000147764 - Ashwin Pai")
  name = name.replace(/^[0-9_\-\s]+[_\-\s]+/, "");

  // Remove nicknames or parenthesized info (e.g. "Gopalakrishna Pai(kutta)" -> "Gopalakrishna Pai")
  name = name.replace(/\([^)]*\)/g, "");

  // Normalize single initial prefixes if followed by a space (e.g. "M Vikram Kamath" -> "Vikram Kamath", "J Anirudh Bhat" -> "Anirudh Bhat")
  // Keep clean tokens
  return name.trim().toLowerCase();
}

/**
 * Extracts normalized tokens ignoring single-letter initials (e.g., "M", "S", "J")
 */
export function extractSignificantTokens(nameStr: string): string[] {
  const clean = cleanPlayerName(nameStr);
  return clean
    .split(/[\s_\-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Calculates a match score between an entity name and a filename
 */
export function calculateMatchConfidence(entityName: string, fileName: string): number {
  const cleanEntity = cleanPlayerName(entityName);
  const cleanFile = cleanPlayerName(fileName);

  if (!cleanEntity || !cleanFile) return 0;

  // Exact match
  if (cleanEntity === cleanFile) return 1.0;

  // Full containment
  if (cleanFile.includes(cleanEntity) || cleanEntity.includes(cleanFile)) {
    return 0.95;
  }

  // Token comparison ignoring single-letter initials
  const entityTokens = extractSignificantTokens(entityName);
  const fileTokens = extractSignificantTokens(fileName);

  // Filter out single-letter initials for core matching
  const coreEntityTokens = entityTokens.filter((t) => t.length > 1);
  const coreFileTokens = fileTokens.filter((t) => t.length > 1);

  if (coreEntityTokens.length === 0 || coreFileTokens.length === 0) {
    return 0;
  }

  // Check how many core tokens match exactly
  const matchedCoreCount = coreEntityTokens.filter((et) =>
    coreFileTokens.some((ft) => ft === et)
  ).length;

  if (matchedCoreCount === coreEntityTokens.length && coreEntityTokens.length >= 2) {
    return 0.92;
  }

  if (matchedCoreCount === coreEntityTokens.length && coreEntityTokens.length === 1) {
    return 0.85;
  }

  // Partial match where first name and last name match or prefix match
  if (matchedCoreCount > 0) {
    const fraction = matchedCoreCount / coreEntityTokens.length;
    return Math.min(0.84, 0.5 + fraction * 0.35);
  }

  return 0;
}

/**
 * Derives a human-readable confidence label
 */
export function getConfidenceLabel(score: number): "EXACT" | "HIGH" | "REVIEW" | "UNMATCHED" {
  if (score >= 0.95) return "EXACT";
  if (score >= 0.8) return "HIGH";
  if (score >= 0.55) return "REVIEW";
  return "UNMATCHED";
}

/**
 * Matches entities (Players, Owners, Icon Players) separately against Google Drive files.
 */
export function matchEntitiesWithDriveFiles(
  entities: MatchEntity[],
  files: DriveFileMetadata[]
): MultiEntityMatchSummary {
  const results: EntityMatchResult[] = [];
  const matchedFileIds = new Set<string>();

  // Pass 1: High confidence matches (score >= 0.75)
  for (const entity of entities) {
    let bestMatch: { file: DriveFileMetadata; score: number } | null = null;

    for (const file of files) {
      if (matchedFileIds.has(file.id)) continue;

      const score = calculateMatchConfidence(entity.name, file.name);
      if (score >= 0.75 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { file, score };
      }
    }

    if (bestMatch) {
      const fileUrl = bestMatch.file.directUrl || `https://lh3.googleusercontent.com/d/${bestMatch.file.id}`;
      results.push({
        entityId: entity.id,
        entityName: entity.name,
        entityType: entity.type,
        teamName: entity.teamName,
        fileId: bestMatch.file.id,
        fileName: bestMatch.file.name,
        fileUrl,
        confidence: bestMatch.score,
        confidenceLabel: getConfidenceLabel(bestMatch.score),
        status: "AUTO_MATCHED",
      });
      matchedFileIds.add(bestMatch.file.id);
    } else {
      // Unmatched entity
      results.push({
        entityId: entity.id,
        entityName: entity.name,
        entityType: entity.type,
        teamName: entity.teamName,
        fileUrl: entity.currentPhotoUrl,
        confidence: 0,
        confidenceLabel: "UNMATCHED",
        status: "UNMATCHED",
      });
    }
  }

  const unmatchedFiles = files.filter((f) => !matchedFileIds.has(f.id));
  const players = results.filter((r) => r.entityType === "PLAYER");
  const owners = results.filter((r) => r.entityType === "OWNER");
  const icons = results.filter((r) => r.entityType === "ICON");
  const matchedCount = results.filter((r) => r.status === "AUTO_MATCHED").length;

  return {
    totalEntities: entities.length,
    totalDriveFiles: files.length,
    matchedCount,
    missingCount: entities.length - matchedCount,
    unmatchedFilesCount: unmatchedFiles.length,
    results,
    players,
    owners,
    icons,
    unmatchedFiles,
  };
}

/**
 * Legacy player-only matcher retained for backwards compatibility
 */
export function matchPlayersWithDriveFiles(
  players: Player[],
  files: DriveFileMetadata[]
): DriveMatchSummary {
  const entities: MatchEntity[] = players.map((p) => ({
    id: p.id,
    name: p.fullName,
    type: "PLAYER",
    currentPhotoUrl: p.photoUrl,
  }));

  const summary = matchEntitiesWithDriveFiles(entities, files);

  const matches: MatchResult[] = summary.players
    .filter((p) => p.status === "AUTO_MATCHED" && p.fileId && p.fileName)
    .map((p) => ({
      playerId: p.entityId,
      playerName: p.entityName,
      fileId: p.fileId!,
      fileName: p.fileName!,
      fileUrl: p.fileUrl || "",
      confidence: p.confidence,
      isAutoMatched: true,
    }));

  const matchedPlayerIds = new Set(matches.map((m) => m.playerId));
  const missingPlayerIds = players.filter((p) => !matchedPlayerIds.has(p.id)).map((p) => p.id);

  return {
    totalPlayers: players.length,
    totalDriveFiles: files.length,
    matchedCount: matches.length,
    missingCount: missingPlayerIds.length,
    unmatchedFilesCount: summary.unmatchedFiles.length,
    matches,
    unmatchedFiles: summary.unmatchedFiles,
    missingPlayerIds,
  };
}

