import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { google } from "googleapis";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, error: "Please provide a valid Google Sheets URL." },
        { status: 400 }
      );
    }

    // Extract Google Sheets ID
    const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const spreadsheetId = match ? match[1] : url.trim();

    if (!spreadsheetId) {
      return NextResponse.json(
        { success: false, error: "Could not extract a valid Google Spreadsheet ID from the URL." },
        { status: 400 }
      );
    }

    // 1. Try Google Sheets API v4 if service account is configured
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
        const sheetsList = (meta.data.sheets || []).map((s) => s.properties?.title || "Sheet1");
        const activeSheetTitle = sheetsList[0] || "Sheet1";

        const valuesRes = await sheetsApi.spreadsheets.values.get({
          spreadsheetId,
          range: `${activeSheetTitle}!A1:Z500`,
        });

        const rawRows = valuesRes.data.values || [];
        if (rawRows.length > 0) {
          // Find first non-empty header row
          let headerIndex = 0;
          while (headerIndex < rawRows.length && (!rawRows[headerIndex] || rawRows[headerIndex].filter(Boolean).length === 0)) {
            headerIndex++;
          }

          const headers = (rawRows[headerIndex] || []).map((h: unknown, i: number) => String(h || `Column ${i + 1}`).trim());
          const dataRows = rawRows.slice(headerIndex + 1).filter((r: unknown[]) => r && r.some((c) => c !== undefined && c !== null && String(c).trim() !== ""));

          return NextResponse.json({
            success: true,
            source: "google_sheets_api_v4",
            spreadsheetId,
            sheets: sheetsList,
            activeSheet: activeSheetTitle,
            headers,
            rows: dataRows,
            totalRows: dataRows.length,
          });
        }
      } catch (err: unknown) {
        console.warn("Google Sheets API error, falling back to public CSV export:", err);
      }
    }

    // 2. Fetch via Google Sheets export CSV (works for all sheets shared as 'Anyone with link can view')
    const csvExportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    const res = await fetch(csvExportUrl, { redirect: "follow" });

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Could not load spreadsheet (Status ${res.status}). Ensure the Google Sheet is shared as 'Anyone with the link can view' or provide service account credentials.`,
        },
        { status: 400 }
      );
    }

    const csvText = await res.text();
    const workbook = XLSX.read(csvText, { type: "string" });
    const sheetName = workbook.SheetNames[0] || "Sheet1";
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    if (!rawData || rawData.length === 0) {
      return NextResponse.json(
        { success: false, error: "The spreadsheet appears to be empty." },
        { status: 400 }
      );
    }

    // Identify header row (first non-empty row)
    let headerRowIdx = 0;
    while (headerRowIdx < rawData.length && (!rawData[headerRowIdx] || rawData[headerRowIdx].filter(Boolean).length === 0)) {
      headerRowIdx++;
    }

    const headers = (rawData[headerRowIdx] || []).map((h: unknown, i: number) => String(h || `Column ${i + 1}`).trim());
    const dataRows = rawData
      .slice(headerRowIdx + 1)
      .filter((r: unknown[]) => r && r.some((c) => c !== undefined && c !== null && String(c).trim() !== ""));

    return NextResponse.json({
      success: true,
      source: "google_sheets_export",
      spreadsheetId,
      sheets: [sheetName],
      activeSheet: sheetName,
      headers,
      rows: dataRows,
      totalRows: dataRows.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to parse Google Spreadsheet";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
