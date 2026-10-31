import { NextRequest, NextResponse } from "next/server";
import { GoogleDriveService } from "@/lib/google/drive-service";
import { matchPlayersWithDriveFiles } from "@/lib/google/drive-matcher";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const folderUrl =
      body.folderUrl ||
      "https://drive.google.com/drive/folders/1MtjUStUIqnlQic13-sfML_NbPygEkSwpUsgDe7b3hHJ1GGKbP7xvSHx3MI11kTS7CgVaT2hA";

    const driveService = new GoogleDriveService();
    const driveResult = await driveService.listFolderFiles(folderUrl);

    // Match retrieved drive files with current registered players
    const matchSummary = matchPlayersWithDriveFiles(MOCK_PLAYERS, driveResult.files);

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
