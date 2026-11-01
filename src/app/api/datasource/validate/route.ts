// ==============================================================================
// NTL CRICKET AUCTION PLATFORM - DATA SOURCE VALIDATION API
// Validates Google Sheets and Google Drive URLs, detects columns, checks access
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { google } from "googleapis";
import {
  parseRegistrationRows,
  detectRegistrationColumns,
} from "@/lib/sheets/registration-parser";
import {
  listDriveFolderAssets,
  extractFolderId,
} from "@/lib/google/dynamic-image-resolver";

const GOOGLE_SHEETS_HOSTS = ["docs.google.com", "drive.google.com"];
const GOOGLE_DRIVE_HOSTS = ["drive.google.com"];

function isValidGoogleHost(urlString: string, allowedHosts: string[]): boolean {
  try {
    const parsed = new URL(urlString);
    return allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function extractSpreadsheetId(urlOrId: string): string {
  if (!urlOrId) return "";
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,60})/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{20,60}$/.test(trimmed)) return trimmed;
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { googleSheetsUrl, googleDriveFolderUrl } = body;

    if (!googleSheetsUrl || typeof googleSheetsUrl !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Player Registration Google Sheet URL is required.",
          code: "MISSING_SHEET_URL",
        },
        { status: 400 }
      );
    }

    // SSRF Protection: Validate Google Sheets Host
    if (!isValidGoogleHost(googleSheetsUrl, GOOGLE_SHEETS_HOSTS)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Google Sheets URL. URL must be on docs.google.com or drive.google.com.",
          code: "INVALID_SHEET_HOST",
        },
        { status: 400 }
      );
    }

    const spreadsheetId = extractSpreadsheetId(googleSheetsUrl);
    if (!spreadsheetId) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not extract a valid Google Spreadsheet ID from the provided URL.",
          code: "INVALID_SPREADSHEET_ID",
        },
        { status: 400 }
      );
    }

    // SSRF Protection: Validate Google Drive Folder Host (if provided)
    let folderId = "";
    if (googleDriveFolderUrl && typeof googleDriveFolderUrl === "string" && googleDriveFolderUrl.trim()) {
      if (!isValidGoogleHost(googleDriveFolderUrl, GOOGLE_DRIVE_HOSTS)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid Google Drive Folder URL. URL must be on drive.google.com.",
            code: "INVALID_DRIVE_HOST",
          },
          { status: 400 }
        );
      }
      folderId = extractFolderId(googleDriveFolderUrl);
      if (!folderId) {
        return NextResponse.json(
          {
            success: false,
            error: "Could not extract a valid Google Drive Folder ID from the provided URL.",
            code: "INVALID_FOLDER_ID",
          },
          { status: 400 }
        );
      }
    }

    // --------------------------------------------------------------------------
    // 1. Validate and Read Google Spreadsheet
    // --------------------------------------------------------------------------
    let sheetsList: string[] = [];
    let activeSheetTitle = "Sheet1";
    let rawRows: (string | number | null | undefined)[][] = [];
    let headers: string[] = [];
    let sheetSource = "public_endpoint";

    // Attempt official Google Sheets API v4 if credentials are set
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (clientEmail && privateKey && !clientEmail.includes("your-project")) {
      try {
        const auth = new google.auth.JWT({
          email: clientEmail,
          key: privateKey,
          scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });
        const sheetsApi = google.sheets({ version: "v4", auth });
        const meta = await sheetsApi.spreadsheets.get({ spreadsheetId });
        sheetsList = (meta.data.sheets || []).map((s) => s.properties?.title || "Sheet1");
        activeSheetTitle = sheetsList[0] || "Sheet1";

        const valuesRes = await sheetsApi.spreadsheets.values.get({
          spreadsheetId,
          range: `${activeSheetTitle}!A1:Z500`,
        });

        rawRows = (valuesRes.data.values || []) as (string | number | null | undefined)[][];
        sheetSource = "google_sheets_api_v4";
      } catch (err) {
        console.warn("[ValidateAPI] Service Account API read failed, testing public CSV export:", err);
      }
    }

    // Fallback: Public GVIZ / CSV export read
    if (rawRows.length === 0) {
      // 1. Try GVIZ JSON API
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`;
      const gvizRes = await fetch(gvizUrl, { redirect: "follow" }).catch(() => null);

      if (gvizRes && gvizRes.ok) {
        const text = await gvizRes.text();
        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            const tableRows = parsed.table?.rows || [];
            if (tableRows.length > 0) {
              rawRows = tableRows.map((r: { c?: Array<{ v?: string | number | null }> }) =>
                (r.c || []).map((cell) => (cell && cell.v !== null && cell.v !== undefined ? cell.v : ""))
              );
              sheetSource = "google_visualization_gviz";
            }
          } catch {}
        }
      }

      // 2. Try CSV export
      if (rawRows.length === 0) {
        const csvExportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
        const csvRes = await fetch(csvExportUrl, { redirect: "follow" }).catch(() => null);

        if (!csvRes || !csvRes.ok) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Unable to access Google Sheet. Please ensure the sheet is shared with 'Anyone with the link can view' or configure Google Service Account credentials.",
              code: "SHEET_ACCESS_DENIED",
            },
            { status: 403 }
          );
        }

        const csvText = await csvRes.text();
        if (csvText.includes("<!DOCTYPE html>") || csvText.includes("ServiceLogin")) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Google Sheet is private. Set sheet sharing permissions to 'Anyone with the link can view' or provide service account access.",
              code: "SHEET_RESTRICTED",
            },
            { status: 403 }
          );
        }

        const workbook = XLSX.read(csvText, { type: "string" });
        activeSheetTitle = workbook.SheetNames[0] || "Sheet1";
        sheetsList = workbook.SheetNames;
        const sheet = workbook.Sheets[activeSheetTitle];
        rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        sheetSource = "public_csv_export";
      }
    }

    if (!rawRows || rawRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "The Google Sheet was loaded successfully but contains no rows or data.",
          code: "SHEET_EMPTY",
        },
        { status: 400 }
      );
    }

    // Detect header row (first non-empty row)
    let headerRowIndex = 0;
    while (
      headerRowIndex < rawRows.length &&
      (!rawRows[headerRowIndex] || rawRows[headerRowIndex].filter(Boolean).length === 0)
    ) {
      headerRowIndex++;
    }

    headers = (rawRows[headerRowIndex] || []).map((h, i) =>
      h !== null && h !== undefined && String(h).trim() !== "" ? String(h).trim() : `Column ${i + 1}`
    );

    const dataRows = rawRows.slice(headerRowIndex + 1);
    const columnsDetected = detectRegistrationColumns(headers, dataRows);

    // Validate that at least Name and Type columns exist
    if (!columnsDetected.nameCol) {
      return NextResponse.json(
        {
          success: false,
          error: `Could not identify a "Name" column in the spreadsheet. Found columns: ${headers.join(", ")}`,
          code: "MISSING_NAME_COLUMN",
          headers,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------------------------------
    // 2. Validate Google Drive Folder (if provided)
    // --------------------------------------------------------------------------
    let driveResult = null;

    if (folderId) {
      const folderRes = await listDriveFolderAssets(folderId);
      driveResult = {
        folderId,
        accessible: folderRes.status === "AUTHENTICATED" || folderRes.status === "PUBLIC_ACCESSIBLE" || folderRes.status === "EMPTY",
        status: folderRes.status,
        filesCount: folderRes.totalFiles,
        sampleFiles: folderRes.files.slice(0, 5).map((f) => f.name),
        message: folderRes.message,
      };
    }

    // --------------------------------------------------------------------------
    // 3. Parse Registration Rows & Validate Records
    // --------------------------------------------------------------------------
    const validationSummary = parseRegistrationRows(headers, dataRows, columnsDetected);

    return NextResponse.json({
      success: true,
      spreadsheetId,
      sheetSource,
      sheets: sheetsList.length > 0 ? sheetsList : [activeSheetTitle],
      activeSheet: activeSheetTitle,
      headers,
      columnsDetected,
      totalRows: validationSummary.totalRows,
      validRows: validationSummary.validRows,
      invalidRows: validationSummary.invalidRows,
      playerCount: validationSummary.playerCount,
      ownerCount: validationSummary.ownerCount,
      iconCount: validationSummary.iconCount,
      teamsDiscovered: validationSummary.teamsDiscovered,
      duplicates: validationSummary.duplicates,
      errors: validationSummary.errors,
      warnings: validationSummary.warnings,
      driveResult,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Validation error occurred";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
