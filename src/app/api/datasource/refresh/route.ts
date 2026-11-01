// ==============================================================================
// NTL CRICKET AUCTION PLATFORM - DATA SOURCE REFRESH API
// Refreshes registration data with active auction safety protection
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import {
  getAuctionStateFromSheets,
  getLeagueConfigFromSheets,
} from "@/lib/sheets/google-sheets-repository";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { leagueId } = body;

    if (!leagueId) {
      return NextResponse.json({ success: false, error: "leagueId is required" }, { status: 400 });
    }

    // 1. Check Active Auction Guard
    const auctionState = await getAuctionStateFromSheets(leagueId);
    if (
      auctionState &&
      (auctionState.status === "IN_PROGRESS" ||
        auctionState.status === "PAUSED" ||
        auctionState.status === "FINISHED")
    ) {
      return NextResponse.json(
        {
          success: false,
          blockedByActiveAuction: true,
          error: `Cannot refresh registration data while auction is in state "${auctionState.status}". Active player lots, winning bids, and sold purchases are protected against destructive changes.`,
          code: "AUCTION_ACTIVE_PROTECTED",
        },
        { status: 400 }
      );
    }

    // 2. Retrieve League's Configured Data Source URLs
    const config = await getLeagueConfigFromSheets(leagueId);
    const { googleSheetsUrl, googleDriveFolderUrl } = config.league;

    if (!googleSheetsUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "No Google Sheets Registration URL configured for this tournament. Please set up the URL in Tournament Setup.",
          code: "MISSING_SHEET_URL",
        },
        { status: 400 }
      );
    }

    // 3. Delegate to Import Handler using the current request origin
    const url = new URL("/api/datasource/import", req.url);
    const importRes = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leagueId,
        googleSheetsUrl,
        googleDriveFolderUrl,
      }),
    });

    const data = await importRes.json();
    if (!importRes.ok) {
      return NextResponse.json(data, { status: importRes.status });
    }

    return NextResponse.json({
      success: true,
      message: `Registration data successfully refreshed: ${data.message}`,
      summary: data.summary,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Refresh failed";
    console.error("[RefreshAPI] Error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
