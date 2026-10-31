import { google } from "googleapis";
import { PlayerCategory, PlayerRole } from "@/types";

export interface ParsedPlayerRow {
  registrationNo: string;
  fullName: string;
  category: PlayerCategory;
  primaryRole: PlayerRole;
  battingStyle: string;
  bowlingStyle: string;
  basePrice: number;
  photoUrl: string;
  statsSummary: {
    matches?: number;
    runs?: number;
    wickets?: number;
    strikeRate?: number;
    notableAchievement?: string;
  };
}

/**
 * Normalizes category string to valid PlayerCategory enum
 */
export function normalizeCategory(val: string): PlayerCategory {
  const clean = (val || "").trim().toUpperCase();
  if (clean.includes("ICON")) return "ICON";
  if (clean.includes("PLATINUM")) return "PLATINUM";
  if (clean.includes("GOLD")) return "GOLD";
  if (clean.includes("EMERGING")) return "EMERGING";
  return "SILVER";
}

/**
 * Normalizes role string to valid PlayerRole enum
 */
export function normalizeRole(val: string): PlayerRole {
  const clean = (val || "").trim().toUpperCase();
  if (clean.includes("ALL") || clean.includes("AR")) return "ALL_ROUNDER";
  if (clean.includes("BOWL") || clean.includes("PACE") || clean.includes("SPIN")) return "BOWLER";
  if (clean.includes("KEEP") || clean.includes("WK")) return "WICKET_KEEPER";
  return "BATSMAN";
}

/**
 * Parses numeric price string into integer (handles ₹, commas, etc.)
 */
export function parseBasePrice(val: string, category: PlayerCategory): number {
  if (!val) {
    switch (category) {
      case "ICON": return 200000;
      case "PLATINUM": return 100000;
      case "GOLD": return 50000;
      case "SILVER": return 25000;
      case "EMERGING": return 15000;
      default: return 25000;
    }
  }
  const clean = val.replace(/[^0-9]/g, "");
  return parseInt(clean, 10) || 25000;
}

/**
 * Service to interact with Google Sheets API v4
 */
export class GoogleSheetsService {
  private auth: InstanceType<typeof google.auth.JWT> | null = null;

  constructor() {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (clientEmail && privateKey) {
      this.auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });
    }
  }

  public isConfigured(): boolean {
    return this.auth !== null;
  }

  /**
   * Fetches and parses rows from the specified spreadsheet range
   */
  async fetchPlayersFromSheet(spreadsheetId: string, range: string = "Players!A2:I"): Promise<ParsedPlayerRow[]> {
    if (!this.auth) {
      throw new Error("Google Sheets credentials are not configured in environment variables.");
    }

    const sheets = google.sheets({ version: "v4", auth: this.auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    return rows.map((row, index) => {
      const regNo = row[0] || `NTL-${String(index + 1).padStart(3, "0")}`;
      const name = row[1] || `Player ${index + 1}`;
      const category = normalizeCategory(row[2]);
      const role = normalizeRole(row[3]);
      const battingStyle = row[4] || "Right Hand Bat";
      const bowlingStyle = row[5] || "Right Arm Medium";
      const basePrice = parseBasePrice(row[6], category);
      const photoUrl = row[7] || "";
      const statsNote = row[8] || "";

      return {
        registrationNo: regNo,
        fullName: name,
        category,
        primaryRole: role,
        battingStyle,
        bowlingStyle,
        basePrice,
        photoUrl,
        statsSummary: {
          notableAchievement: statsNote,
        },
      };
    });
  }
}
