import { NextRequest, NextResponse } from "next/server";
import { checkAndProcessAuctionTimer } from "@/lib/server/auction-store";
import { INITIAL_LEAGUES } from "@/lib/mock-data/leagues";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * Optional maintenance endpoint to inspect or trigger timer evaluation.
 * Note: Auction timer operation is fully request-driven and does not require Vercel Cron.
 */
export async function GET(req: NextRequest) {
  return handleTimerEndpoint(req);
}

export async function POST(req: NextRequest) {
  return handleTimerEndpoint(req);
}

async function handleTimerEndpoint(req: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(req.url);
  const requestedLeagueId = searchParams.get("leagueId");

  const targetLeagues = requestedLeagueId
    ? [requestedLeagueId]
    : INITIAL_LEAGUES.map((l) => l.id);

  const results: Array<{
    leagueId: string;
    actionTaken: string;
    details?: Record<string, unknown>;
  }> = [];

  for (const leagueId of targetLeagues) {
    try {
      const res = await checkAndProcessAuctionTimer(leagueId);
      results.push({
        leagueId,
        actionTaken: res.actionTaken,
        details: res.details,
      });
    } catch (err) {
      results.push({
        leagueId,
        actionTaken: "ERROR",
        details: { error: (err as Error).message },
      });
    }
  }

  return NextResponse.json({
    success: true,
    mode: "request-driven-timer",
    durationMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    results,
  });
}
