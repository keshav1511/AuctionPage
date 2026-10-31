import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    app: "NTL Auction Platform",
    edition: "Season 1",
    timestamp: new Date().toISOString(),
    services: {
      dataStorage: "google_sheets_v4",
      googleSheets: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? "configured" : "unconfigured_mock_fallback",
      googleDrive: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? "configured" : "unconfigured_mock_fallback",
    },
  });
}
