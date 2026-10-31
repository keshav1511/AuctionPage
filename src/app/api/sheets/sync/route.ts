import { NextRequest, NextResponse } from "next/server";
import { GoogleSheetsService } from "@/lib/google/sheets";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { spreadsheetId, range } = body;

    const sheetsService = new GoogleSheetsService();

    if (!sheetsService.isConfigured()) {
      // Graceful fallback for local evaluation
      return NextResponse.json({
        status: "success",
        mode: "mock_fallback",
        message: "Google Service Account credentials not provided in .env.local. Returned local sample players.",
        count: MOCK_PLAYERS.length,
        players: MOCK_PLAYERS,
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
