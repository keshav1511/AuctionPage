// ==============================================================================
// NTL CRICKET AUCTION PLATFORM - DYNAMIC REGISTRATION SHEET PARSER
// Robust, schema-agnostic parser for player/owner/icon registration sheets
// ==============================================================================

import {
  RegistrationRecord,
  RegistrationPersonType,
  RegistrationValidationSummary,
  PlayerCategory,
  PlayerRole,
} from "@/types";

export interface ColumnMappingConfig {
  nameCol: string;
  photoCol: string;
  typeCol: string;
  teamCol: string;
  regNoCol?: string;
  categoryCol?: string;
  roleCol?: string;
  priceCol?: string;
}

/**
 * Normalizes a header string for tolerant comparison
 */
function normalizeHeader(h: string): string {
  return (h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Automatically infers column indices and names from a spreadsheet header row
 */
export function detectRegistrationColumns(
  headers: string[],
  sampleRows: (string | number | null | undefined)[][] = []
): ColumnMappingConfig {
  const normHeaders = headers.map(normalizeHeader);

  const findHeader = (aliases: string[], fallbackIndex?: number): string => {
    // 1. Exact or partial alias matching
    for (const alias of aliases) {
      const cleanAlias = normalizeHeader(alias);
      const matchIdx = normHeaders.findIndex(
        (nh) => nh === cleanAlias || nh.includes(cleanAlias)
      );
      if (matchIdx !== -1) return headers[matchIdx];
    }
    // 2. Fallback index if within bounds
    if (fallbackIndex !== undefined && fallbackIndex < headers.length && headers[fallbackIndex]) {
      return headers[fallbackIndex];
    }
    return "";
  };

  const nameCol = findHeader(["name", "playername", "fullname", "athlete", "player"], 0);
  const photoCol = findHeader(["photolink", "photo", "image", "picture", "imagelink", "photourl"], headers.length >= 4 ? 1 : undefined);
  const typeCol = findHeader(["playericonowner", "type", "roleorowner", "categoryortype", "designation"], headers.length >= 4 ? 2 : undefined);

  // For Team column: check alias, or if Col 4 exists and has team values
  let teamCol = findHeader(["team", "teamname", "franchise", "club", "teamaffiliation"], headers.length >= 4 ? 3 : undefined);

  // If teamCol was blank (e.g. Col 4 header is empty string ""), check if sample rows have data in col 3
  if (!teamCol && headers.length >= 4) {
    const hasValuesInCol4 = sampleRows.some((r) => r && r[3] && String(r[3]).trim().length > 0);
    if (hasValuesInCol4) {
      teamCol = headers[3] || `Column 4`;
    }
  }

  const regNoCol = findHeader(["regno", "registrationno", "token", "playerid", "id"]);
  const categoryCol = findHeader(["category", "tier", "grade"]);
  const roleCol = findHeader(["role", "primaryrole", "specialization", "skill"]);
  const priceCol = findHeader(["price", "baseprice", "base"]);

  return {
    nameCol,
    photoCol,
    typeCol,
    teamCol,
    regNoCol,
    categoryCol,
    roleCol,
    priceCol,
  };
}

/**
 * Normalizes raw category string into standard PlayerCategory
 */
export function normalizePlayerCategory(val?: string): PlayerCategory {
  const clean = (val || "").toUpperCase();
  if (clean.includes("ICON")) return "ICON";
  if (clean.includes("PLATINUM")) return "PLATINUM";
  if (clean.includes("GOLD")) return "GOLD";
  if (clean.includes("EMERGING")) return "EMERGING";
  return "SILVER";
}

/**
 * Normalizes raw cricket role string into standard PlayerRole
 */
export function normalizePlayerRole(val?: string): PlayerRole {
  const clean = (val || "").toUpperCase();
  if (clean.includes("BOWL") || clean.includes("PACE") || clean.includes("SPIN")) return "BOWLER";
  if (clean.includes("ALL") || clean.includes("AR")) return "ALL_ROUNDER";
  if (clean.includes("KEEP") || clean.includes("WK")) return "WICKET_KEEPER";
  return "BATSMAN";
}

/**
 * Parses dynamic registration rows from Google Sheets or Excel
 */
export function parseRegistrationRows(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  customMapping?: Partial<ColumnMappingConfig>,
  defaultBasePrice?: number
): RegistrationValidationSummary {
  const mapping = {
    ...detectRegistrationColumns(headers, rows),
    ...customMapping,
  };

  const getVal = (row: (string | number | null | undefined)[], colHeader?: string, fallbackIdx?: number): string => {
    if (!colHeader && fallbackIdx === undefined) return "";
    let colIdx = colHeader ? headers.indexOf(colHeader) : -1;
    if (colIdx === -1 && fallbackIdx !== undefined) {
      colIdx = fallbackIdx;
    }
    if (colIdx === -1 || colIdx >= row.length) return "";
    const v = row[colIdx];
    return v !== null && v !== undefined ? String(v).trim() : "";
  };

  const seenNames = new Map<string, number>(); // name (lowercase) -> first row
  const teamsDiscovered = new Set<string>();
  const records: RegistrationRecord[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const duplicates: string[] = [];
  const unmatchedPhotos: string[] = [];

  rows.forEach((row, i) => {
    const rowIndex = i + 2; // 1-based indexing assuming row 1 is header

    // Check if entire row is empty
    const hasAnyContent = row.some((c) => c !== null && c !== undefined && String(c).trim() !== "");
    if (!hasAnyContent) return;

    const rowErrors: string[] = [];
    const rowWarnings: string[] = [];

    // Extract raw fields
    const rawName = getVal(row, mapping.nameCol, 0);
    const rawPhoto = mapping.photoCol ? getVal(row, mapping.photoCol) : "";
    const rawType = mapping.typeCol ? getVal(row, mapping.typeCol) : "";
    const rawTeam = mapping.teamCol ? getVal(row, mapping.teamCol) : "";
    const rawCategory = mapping.categoryCol ? getVal(row, mapping.categoryCol) : "";
    const rawRole = mapping.roleCol ? getVal(row, mapping.roleCol) : "";
    const rawPrice = mapping.priceCol ? getVal(row, mapping.priceCol) : "";

    // 1. Validate Name
    if (!rawName) {
      rowErrors.push(`Row ${rowIndex}: Name is missing.`);
      errors.push(`Row ${rowIndex}: Name is missing.`);
    }

    // Duplicate Name Detection
    const nameKey = rawName.toLowerCase();
    if (nameKey) {
      if (seenNames.has(nameKey)) {
        const firstRow = seenNames.get(nameKey)!;
        rowWarnings.push(`Duplicate name "${rawName}" (already present at Row ${firstRow}).`);
        if (!duplicates.includes(rawName)) {
          duplicates.push(rawName);
          warnings.push(`Duplicate person name: "${rawName}" appears on Rows ${firstRow} and ${rowIndex}.`);
        }
      } else {
        seenNames.set(nameKey, rowIndex);
      }
    }

    // 2. Validate & Normalize Person Type
    let type: RegistrationPersonType = "PLAYER";
    const typeUpper = rawType.toUpperCase();

    if (typeUpper.includes("OWNER")) {
      type = "OWNER";
    } else if (typeUpper.includes("ICON")) {
      type = "ICON";
    } else if (typeUpper.includes("PLAYER") || typeUpper === "") {
      type = "PLAYER";
    } else {
      // Unrecognized type
      rowWarnings.push(`Row ${rowIndex}: Unrecognized type "${rawType}". Defaulting to "PLAYER".`);
      warnings.push(`Row ${rowIndex}: "${rawType}" for "${rawName}" is unrecognized. Treated as standard player.`);
      type = "PLAYER";
    }

    // 3. Validate Team Affiliation
    if (rawTeam) {
      teamsDiscovered.add(rawTeam);
    }

    if (type === "OWNER" && !rawTeam) {
      rowErrors.push(`Row ${rowIndex}: Team affiliation is required for Owner ("${rawName}").`);
      errors.push(`Row ${rowIndex}: Team affiliation is required for Owner ("${rawName}").`);
    } else if (type === "ICON" && !rawTeam) {
      rowErrors.push(`Row ${rowIndex}: Team affiliation is required for Icon Player ("${rawName}").`);
      errors.push(`Row ${rowIndex}: Team affiliation is required for Icon Player ("${rawName}").`);
    }

    // 4. Validate Photo Reference
    if (!rawPhoto) {
      rowWarnings.push(`Row ${rowIndex}: No photograph specified for "${rawName}".`);
      unmatchedPhotos.push(rawName);
    }

    // 5. Parse Price & Category
    const category = type === "ICON" ? "ICON" : normalizePlayerCategory(rawCategory);
    const role = normalizePlayerRole(rawRole);
    let basePrice: number = defaultBasePrice || 2000;
    if (type === "ICON") {
      basePrice = Math.max(defaultBasePrice || 2000, 50000);
    } else if (rawPrice) {
      const parsedNum = parseInt(rawPrice.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsedNum) && parsedNum > 0) basePrice = parsedNum;
    }

    const isValid = rowErrors.length === 0;

    records.push({
      rowIndex,
      name: rawName,
      type,
      photoRef: rawPhoto,
      teamAffiliation: rawTeam || undefined,
      category,
      role,
      basePrice,
      isValid,
      errors: rowErrors,
      warnings: rowWarnings,
    });
  });

  const validRows = records.filter((r) => r.isValid).length;
  const invalidRows = records.length - validRows;
  const playerCount = records.filter((r) => r.type === "PLAYER").length;
  const ownerCount = records.filter((r) => r.type === "OWNER").length;
  const iconCount = records.filter((r) => r.type === "ICON").length;

  return {
    totalRows: records.length,
    validRows,
    invalidRows,
    playerCount,
    ownerCount,
    iconCount,
    teamsDiscovered: Array.from(teamsDiscovered).sort(),
    duplicates,
    unmatchedPhotos,
    errors,
    warnings,
    records,
  };
}
