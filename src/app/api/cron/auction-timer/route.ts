import { NextRequest, NextResponse } from "next/server";
import { getAuctionStateFromSheets } from "@/lib/sheets/google-sheets-repository";
import { processAuctionAction } from "@/lib/server/auction-store";
import { INITIAL_LEAGUES } from "@/lib/mock-data/leagues";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // 30s timeout for cron

/**
 * Validates Vercel Cron invocation authorization
 * Supports:
 * 1. Authorization: Bearer <CRON_SECRET> (Vercel standard)
 * 2. x-vercel-cron: "1" header (Vercel internal invocation)
 * 3. Local development override
 */
function isCronAuthorized(req: NextRequest): boolean {
  // Check Vercel Cron header
  const isVercelCronHeader = req.headers.get("x-vercel-cron") === "1";
  if (isVercelCronHeader) return true;

  // Check Bearer secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader && authHeader.trim() === `Bearer ${cronSecret.trim()}`) {
    return true;
  }

  // Development & staging testing convenience
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  const startTime = Date.now();

  // 1. Authorization verification
  if (!isCronAuthorized(req)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Invalid or missing Cron authorization" },
      { status: 401 }
    );
  }

  const results: Array<{
    leagueId: string;
    actionTaken: string;
    details?: Record<string, unknown>;
  }> = [];

  try {
    // 2. Iterate through all configured leagues
    const targetLeagues = INITIAL_LEAGUES.map((l) => l.id);

    for (const leagueId of targetLeagues) {
      try {
        const state = await getAuctionStateFromSheets(leagueId, true);

        // Check if an auction is active with an expired timer
        if (state.status === "IN_PROGRESS" && state.timerExpiresAt && state.currentPlayerId) {
          const expiryTimeMs = new Date(state.timerExpiresAt).getTime();
          const isExpired = Date.now() >= expiryTimeMs;

          if (isExpired) {
            // Case A: Expired with ZERO bids -> Authoritative UNSOLD hammer
            if (state.currentHighestBid === 0 || !state.currentLeadingTeamId) {
              const actionId = `cron-unsold-${leagueId}-${state.currentPlayerId}-v${state.version}`;
              const actionRes = await processAuctionAction({
                leagueId,
                type: "HAMMER_UNSOLD",
                playerId: state.currentPlayerId,
                reason: "Vercel Cron: Wall-clock timer expired with zero bids",
                actionId,
              });

              results.push({
                leagueId,
                actionTaken: "HAMMER_UNSOLD",
                details: {
                  playerId: state.currentPlayerId,
                  success: actionRes.success,
                  message: actionRes.message,
                },
              });
            } else {
              // Case B: Lot has active leading bid. Do not auto-close unless configured,
              // but record status in telemetry.
              results.push({
                leagueId,
                actionTaken: "AWAITING_COMMISSIONER_GAVEL",
                details: {
                  playerId: state.currentPlayerId,
                  leadingTeamId: state.currentLeadingTeamId,
                  highestBid: state.currentHighestBid,
                  expiredSecondsAgo: Math.floor((Date.now() - expiryTimeMs) / 1000),
                },
              });
            }
          } else {
            results.push({
              leagueId,
              actionTaken: "TIMER_ACTIVE",
              details: {
                remainingSeconds: Math.ceil((expiryTimeMs - Date.now()) / 1000),
              },
            });
          }
        } else {
          results.push({
            leagueId,
            actionTaken: `AUCTION_${state.status}`,
          });
        }
      } catch (leagueErr) {
        console.error(`[CronTimer] Error processing league ${leagueId}:`, leagueErr);
        results.push({
          leagueId,
          actionTaken: "ERROR",
          details: { error: (leagueErr as Error).message },
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      processedCount: results.length,
      results,
    });
  } catch (error) {
    console.error("[CronTimer] Top-level cron execution error:", error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || "Internal cron error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
