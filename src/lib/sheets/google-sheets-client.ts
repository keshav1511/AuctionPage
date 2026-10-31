// ==============================================================================
// NTL AUCTION PLATFORM - GOOGLE SHEETS API CLIENT
// Server-side authenticated Google Sheets API v4 service
// Uses Service Account JWT credentials with read/write spreadsheet scopes
// ==============================================================================

import { google, sheets_v4 } from "googleapis";

let cachedSheetsClient: sheets_v4.Sheets | null = null;
let cachedAuthClient: InstanceType<typeof google.auth.JWT> | null = null;

/**
 * Checks whether valid Google Service Account credentials are configured
 */
export function isGoogleSheetsConfigured(): boolean {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) return false;
  if (clientEmail.includes("your-project") || clientEmail.includes("example.com")) return false;
  return true;
}

/**
 * Returns an authenticated Google Sheets API v4 client instance
 */
export function getGoogleSheetsClient(): sheets_v4.Sheets | null {
  if (cachedSheetsClient) {
    return cachedSheetsClient;
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    return null;
  }

  // Handle newline escapes in private key format
  privateKey = privateKey.replace(/\\n/g, "\n");

  try {
    cachedAuthClient = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
      ],
    });

    cachedSheetsClient = google.sheets({
      version: "v4",
      auth: cachedAuthClient,
    });

    return cachedSheetsClient;
  } catch (err) {
    console.error("Failed to initialize Google Sheets client:", err);
    return null;
  }
}

/**
 * Extracts a Google Spreadsheet ID from either a raw ID string or a full URL
 * e.g. "https://docs.google.com/spreadsheets/d/1uC87Sn8KLb.../edit" -> "1uC87Sn8KLb..."
 */
export function extractSpreadsheetId(urlOrId: string | undefined | null): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();

  // Match standard Google Sheets URL format
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // If already a raw ID (alphanumeric with dashes/underscores, usually 25-55 chars)
  if (/^[a-zA-Z0-9-_]{20,60}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}
