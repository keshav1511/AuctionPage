import { NextRequest, NextResponse } from "next/server";

/** @deprecated Images are now stored in UploadThing and indexed in PostgreSQL. */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      code: "MEDIA_LIBRARY_REPLACED_DRIVE",
      error: "Google Drive synchronization has been removed. Upload or import images into the tournament media library instead.",
    },
    { status: 410 }
  );
}
