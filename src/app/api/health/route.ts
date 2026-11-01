import { NextResponse } from "next/server";
import { isAppsScriptConfigured } from "@/lib/sheets/apps-script-client";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    app: "NTL Auction Platform",
    edition: "Season 1",
    timestamp: new Date().toISOString(),
    services: {
      dataStorage: "google_sheets_apps_script",
      persistence: isAppsScriptConfigured() ? "connected" : "authoritative_local_mirror",
    },
  });
}

