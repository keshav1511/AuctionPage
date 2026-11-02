// ==============================================================================
// NTL CRICKET AUCTION PLATFORM - DYNAMIC REGISTRATION SHEET & EXCEL PARSER
// Robust, schema-agnostic parser for player registrations with flexible column detection
// ==============================================================================

import {
  RegistrationRecord,
  RegistrationPersonType,
  RegistrationValidationSummary,
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
  ageCol?: string;
}

export interface FlexibleColumnMapping {
  nameCol: string; // ONLY mandatory field
  regNoCol?: string; // optional
  roleCol?: string; // optional
  priceCol?: string; // optional
  ageCol?: string; // optional
  photoCol?: string; // optional
  teamCol?: string; // optional
  typeCol?: string; // optional
}

export interface FlexiblePlayerRecord {
  rowIndex: number;
  name: string;
  registrationNo?: string;
  role?: PlayerRole;
  basePrice?: number;
  age?: number;
  photoUrl?: string;
  teamAffiliation?: string;
  type: RegistrationPersonType;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  rawFields: Record<string, string>;
}

export interface FlexibleImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  detectedColumns: Array<{ key: keyof FlexibleColumnMapping; label: string; header: string }>;
  duplicates: string[];
  records: FlexiblePlayerRecord[];
  errors: string[];
  warnings: string[];
  teamsDiscovered: string[];
}

/**
 * Normalizes a header string for tolerant comparison
 */
export function normalizeHeader(h: string): string {
  return (h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Flexible column detector:
 * Matches column names flexibly (case-insensitive, whitespace-trimmed, tolerant of common aliases).
 * Name is the ONLY mandatory field.
 * If an optional column is not present in the headers, it is left empty without guessing from irrelevant columns.
 */
export function detectFlexiblePlayerColumns(
  headers: string[],
  _sampleRows: (string | number | null | undefined)[][] = []
): FlexibleColumnMapping {
  const normHeaders = headers.map(normalizeHeader);

  const findHeaderMatch = (aliases: string[]): string => {
    for (const alias of aliases) {
      const cleanAlias = normalizeHeader(alias);
      const matchIdx = normHeaders.findIndex(
        (nh) => nh === cleanAlias || nh.includes(cleanAlias)
      );
      if (matchIdx !== -1) return headers[matchIdx];
    }
    return "";
  };

  // 1. Name: "Name", "Player Name", "Full Name", "Player", "Student Name" (MANDATORY)
  let nameCol = findHeaderMatch([
    "playername",
    "fullname",
    "name",
    "studentname",
    "athlete",
    "player",
  ]);

  // If there's only 1 column, or no header matched, fallback to column 0 if headers exist
  if (!nameCol && headers.length > 0) {
    nameCol = headers[0];
  }

  // 2. Registration Number: "Reg No", "Registration No", "Bib No", "Chest No", "Enrollment No", "Roll No", "ID", "Player ID"
  const regNoCol = findHeaderMatch([
    "regno",
    "registrationno",
    "reg",
    "bibno",
    "bib",
    "chestno",
    "enrollmentno",
    "rollno",
    "playerid",
    "token",
    "id",
  ]);

  // 3. Playing Role: "Role", "Playing Role", "Specialization", "Category", "Type", "Player Type", "Skill"
  const roleCol = findHeaderMatch([
    "playingrole",
    "primaryrole",
    "specialization",
    "skill",
    "playertype",
    "role",
    "roleorowner",
  ]);

  // 4. Base Price: "Base Price", "Price", "Base", "Starting Bid", "Points"
  const priceCol = findHeaderMatch([
    "baseprice",
    "startingbid",
    "base",
    "price",
    "points",
  ]);

  // 5. Age: "Age", "Player Age"
  const ageCol = findHeaderMatch(["playerage", "age"]);

  // 6. Photo URL: "Photo", "Image", "Picture", "Photo Link"
  const photoCol = findHeaderMatch([
    "photolink",
    "photourl",
    "photo",
    "image",
    "picture",
    "imagelink",
  ]);

  // 7. Team Affiliation: "Team", "Franchise", "Club"
  const teamCol = findHeaderMatch([
    "teamaffiliation",
    "teamname",
    "franchise",
    "club",
    "team",
  ]);

  // 8. Entity Type: "Type", "Designation", "Player / Icon / Owner"
  const typeCol = findHeaderMatch([
    "playericonowner",
    "categoryortype",
    "designation",
    "type",
  ]);

  return {
    nameCol,
    regNoCol: regNoCol || undefined,
    roleCol: roleCol || undefined,
    priceCol: priceCol || undefined,
    ageCol: ageCol || undefined,
    photoCol: photoCol || undefined,
    teamCol: teamCol || undefined,
    typeCol: typeCol || undefined,
  };
}

/**
 * Backward compatibility wrapper for existing callers
 */
export function detectRegistrationColumns(
  headers: string[],
  sampleRows: (string | number | null | undefined)[][] = []
): ColumnMappingConfig {
  const flex = detectFlexiblePlayerColumns(headers, sampleRows);
  return {
    nameCol: flex.nameCol,
    photoCol: flex.photoCol || "",
    typeCol: flex.typeCol || "",
    teamCol: flex.teamCol || "",
    regNoCol: flex.regNoCol,
    roleCol: flex.roleCol,
    priceCol: flex.priceCol,
    ageCol: flex.ageCol,
  };
}

/**
 * Normalizes raw cricket role string into standard PlayerRole
 */
export function normalizePlayerRole(val?: string): PlayerRole | undefined {
  if (!val || !val.trim()) return undefined;
  const clean = val.toUpperCase();
  if (clean.includes("BOWL") || clean.includes("PACE") || clean.includes("SPIN")) return "BOWLER";
  if (clean.includes("ALL") || clean.includes("AR")) return "ALL_ROUNDER";
  if (clean.includes("KEEP") || clean.includes("WK")) return "WICKET_KEEPER";
  if (clean.includes("BAT")) return "BATSMAN";
  return undefined;
}

/**
 * Parses flexible player rows from uploaded Excel or Google Sheets.
 * Player Name is the ONLY mandatory field.
 * Missing registration numbers are auto-generated.
 * Unspecified roles default to "ALL_ROUNDER".
 * Unspecified base prices default to defaultBasePrice (2000).
 * Arbitrary categories (Silver/Gold/Emerging/Platinum/Icon) are completely ignored.
 */
export function parseFlexiblePlayerRows(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  customMapping?: Partial<FlexibleColumnMapping>,
  _defaultBasePrice: number = 2000
): FlexibleImportSummary {
  const mapping: FlexibleColumnMapping = {
    ...detectFlexiblePlayerColumns(headers, rows),
    ...customMapping,
  };

  const getVal = (row: (string | number | null | undefined)[], colHeader?: string): string => {
    if (!colHeader) return "";
    const colIdx = headers.indexOf(colHeader);
    if (colIdx === -1 || colIdx >= row.length) return "";
    const v = row[colIdx];
    return v !== null && v !== undefined ? String(v).trim() : "";
  };

  // Compile list of detected columns for dynamic preview table
  const detectedColumns: Array<{ key: keyof FlexibleColumnMapping; label: string; header: string }> = [];

  if (mapping.nameCol) {
    detectedColumns.push({ key: "nameCol", label: "Player Name", header: mapping.nameCol });
  }
  if (mapping.regNoCol) {
    detectedColumns.push({ key: "regNoCol", label: "Registration No", header: mapping.regNoCol });
  }
  if (mapping.roleCol) {
    detectedColumns.push({ key: "roleCol", label: "Playing Role", header: mapping.roleCol });
  }
  if (mapping.priceCol) {
    detectedColumns.push({ key: "priceCol", label: "Base Price", header: mapping.priceCol });
  }
  if (mapping.ageCol) {
    detectedColumns.push({ key: "ageCol", label: "Age", header: mapping.ageCol });
  }
  if (mapping.photoCol) {
    detectedColumns.push({ key: "photoCol", label: "Photo", header: mapping.photoCol });
  }
  if (mapping.teamCol) {
    detectedColumns.push({ key: "teamCol", label: "Team", header: mapping.teamCol });
  }

  const seenNames = new Map<string, number>(); // name lowercase -> first row
  const seenRegNos = new Map<string, number>();
  const teamsDiscovered = new Set<string>();
  const records: FlexiblePlayerRecord[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const duplicates: string[] = [];

  rows.forEach((row, i) => {
    const rowIndex = i + 2; // 1-based indexing assuming row 1 is header

    // Skip completely empty rows
    const hasAnyContent = row.some((c) => c !== null && c !== undefined && String(c).trim() !== "");
    if (!hasAnyContent) return;

    const rowErrors: string[] = [];
    const rowWarnings: string[] = [];
    const rawFields: Record<string, string> = {};

    headers.forEach((h, idx) => {
      if (idx < row.length && row[idx] !== null && row[idx] !== undefined) {
        rawFields[h] = String(row[idx]).trim();
      }
    });

    // Extract fields
    const rawName = getVal(row, mapping.nameCol);
    const rawRegNo = mapping.regNoCol ? getVal(row, mapping.regNoCol) : "";
    const rawRole = mapping.roleCol ? getVal(row, mapping.roleCol) : "";
    const rawPrice = mapping.priceCol ? getVal(row, mapping.priceCol) : "";
    const rawAge = mapping.ageCol ? getVal(row, mapping.ageCol) : "";
    const rawPhoto = mapping.photoCol ? getVal(row, mapping.photoCol) : "";
    const rawTeam = mapping.teamCol ? getVal(row, mapping.teamCol) : "";
    const rawType = mapping.typeCol ? getVal(row, mapping.typeCol) : "";

    // 1. Mandatory Name Validation
    if (!rawName) {
      rowErrors.push(`Row ${rowIndex}: Player name is missing.`);
      errors.push(`Row ${rowIndex}: Player name is missing.`);
    }

    // Duplicate Name Detection
    const nameKey = rawName.toLowerCase();
    if (nameKey) {
      if (seenNames.has(nameKey)) {
        const firstRow = seenNames.get(nameKey)!;
        rowWarnings.push(`Duplicate player name "${rawName}" (already on Row ${firstRow}).`);
        if (!duplicates.includes(rawName)) {
          duplicates.push(rawName);
          warnings.push(`Duplicate player name "${rawName}" on Rows ${firstRow} and ${rowIndex}.`);
        }
      } else {
        seenNames.set(nameKey, rowIndex);
      }
    }

    // 2. Registration Number (Leave unset if missing in Excel)
    let registrationNo: string | undefined = undefined;
    if (mapping.regNoCol && rawRegNo) {
      registrationNo = rawRegNo;
      const regKey = registrationNo.toLowerCase();
      if (seenRegNos.has(regKey)) {
        const firstRow = seenRegNos.get(regKey)!;
        rowWarnings.push(`Duplicate registration number "${registrationNo}" (already on Row ${firstRow}).`);
        warnings.push(`Duplicate registration number "${registrationNo}" on Rows ${firstRow} and ${rowIndex}.`);
      } else {
        seenRegNos.set(regKey, rowIndex);
      }
    }

    // 3. Playing Role (Leave unset/undefined if missing in Excel)
    const role: PlayerRole | undefined = mapping.roleCol && rawRole ? normalizePlayerRole(rawRole) : undefined;

    // 4. Base Price (Leave unset/undefined if missing in Excel)
    let basePrice: number | undefined = undefined;
    if (mapping.priceCol && rawPrice) {
      const parsedNum = parseInt(rawPrice.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        basePrice = parsedNum;
      }
    }

    // 5. Age
    let age: number | undefined = undefined;
    if (rawAge) {
      const parsedAge = parseInt(rawAge.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsedAge) && parsedAge >= 10 && parsedAge <= 99) {
        age = parsedAge;
      }
    }

    // 6. Person Type (Owner, Icon, or Player)
    let type: RegistrationPersonType = "PLAYER";
    const typeUpper = rawType.toUpperCase();
    if (typeUpper.includes("OWNER")) {
      type = "OWNER";
    } else if (typeUpper.includes("ICON")) {
      type = "ICON";
    } else {
      type = "PLAYER";
    }

    if (rawTeam) {
      teamsDiscovered.add(rawTeam);
    }

    const isValid = rowErrors.length === 0;

    records.push({
      rowIndex,
      name: rawName,
      registrationNo,
      role,
      basePrice,
      age,
      photoUrl: rawPhoto || undefined,
      teamAffiliation: rawTeam || undefined,
      type,
      isValid,
      errors: rowErrors,
      warnings: rowWarnings,
      rawFields,
    });
  });

  const validRows = records.filter((r) => r.isValid).length;
  const invalidRows = records.length - validRows;

  return {
    totalRows: records.length,
    validRows,
    invalidRows,
    detectedColumns,
    duplicates,
    records,
    errors,
    warnings,
    teamsDiscovered: Array.from(teamsDiscovered).sort(),
  };
}

/**
 * Backward-compatible parseRegistrationRows implementation using flexible logic
 */
export function parseRegistrationRows(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  customMapping?: Partial<ColumnMappingConfig>,
  defaultBasePrice?: number
): RegistrationValidationSummary {
  const flexSummary = parseFlexiblePlayerRows(
    headers,
    rows,
    customMapping,
    defaultBasePrice || 2000
  );

  const records: RegistrationRecord[] = flexSummary.records.map((r) => ({
    rowIndex: r.rowIndex,
    name: r.name,
    type: r.type,
    photoRef: r.photoUrl || "",
    teamAffiliation: r.teamAffiliation,
    role: r.role,
    basePrice: r.basePrice,
    isValid: r.isValid,
    errors: r.errors,
    warnings: r.warnings,
  }));

  return {
    totalRows: flexSummary.totalRows,
    validRows: flexSummary.validRows,
    invalidRows: flexSummary.invalidRows,
    playerCount: flexSummary.records.filter((r) => r.type === "PLAYER").length,
    ownerCount: flexSummary.records.filter((r) => r.type === "OWNER").length,
    iconCount: flexSummary.records.filter((r) => r.type === "ICON").length,
    teamsDiscovered: flexSummary.teamsDiscovered,
    duplicates: flexSummary.duplicates,
    unmatchedPhotos: flexSummary.records.filter((r) => !r.photoUrl).map((r) => r.name),
    errors: flexSummary.errors,
    warnings: flexSummary.warnings,
    records,
  };
}
