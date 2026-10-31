import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    app: "NTL Auction Platform",
    edition: "Season 1",
    timestamp: new Date().toISOString(),
    services: {
      supabase: process.env.NEXT_PUBLIC_SUPABASE_URL ? "configured" : "unconfigured_mock_fallback",
      googleSheets: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? "configured" : "unconfigured_mock_fallback",
    },
  });
}
