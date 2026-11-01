import { NextRequest, NextResponse } from "next/server";
import { GoogleSheetsService } from "@/lib/google/sheets";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { spreadsheetId, range } = body;

    const sheetsService = new GoogleSheetsService();

    if (!sheetsService.isConfigured()) {
      return NextResponse.json({
        status: "awaiting_credentials",
        mode: "unconfigured",
        message: "Google Service Account credentials not provided in .env.local. Configure credentials or use the Dynamic Data Source Import.",
        count: 0,
        players: [],
      });
    }

    const targetSheetId = spreadsheetId || process.env.GOOGLE_SHEET_ID;
    if (!targetSheetId) {
      return NextResponse.json(
        { error: "Missing spreadsheetId parameter or GOOGLE_SHEET_ID in environment." },
        { status: 400 }
      );
    }

    const parsedPlayers = await sheetsService.fetchPlayersFromSheet(targetSheetId, range);

    return NextResponse.json({
      status: "success",
      mode: "live_google_sheets",
      count: parsedPlayers.length,
      players: parsedPlayers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to synchronize with Google Sheets";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
