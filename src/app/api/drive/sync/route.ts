import { NextRequest, NextResponse } from "next/server";
import { Player } from "@/types";
import { GoogleDriveService } from "@/lib/google/drive-service";
import { matchPlayersWithDriveFiles } from "@/lib/google/drive-matcher";
import {
  getPlayersFromSheets,
  getLeagueConfigFromSheets,
} from "@/lib/sheets/google-sheets-repository";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { leagueId } = body;
    let folderUrl = body.folderUrl;

    let targetPlayers: Player[] = [];
    if (leagueId) {
      targetPlayers = await getPlayersFromSheets(leagueId);
      if (!folderUrl) {
        const config = await getLeagueConfigFromSheets(leagueId);
        folderUrl = config.league.googleDriveFolderUrl;
      }
    }

    if (!folderUrl) {
      return NextResponse.json(
        { success: false, error: "No Google Drive folder URL provided or configured for this tournament." },
        { status: 400 }
      );
    }

    const driveService = new GoogleDriveService();
    const driveResult = await driveService.listFolderFiles(folderUrl);

    // Match retrieved drive files with current registered players
    const matchSummary = matchPlayersWithDriveFiles(targetPlayers, driveResult.files);

    return NextResponse.json({
      success: true,
      serviceStatus: driveResult.status,
      message: driveResult.message,
      folderId: driveResult.folderId,
      matchSummary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to sync Google Drive files";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
