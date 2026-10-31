import { NextRequest, NextResponse } from "next/server";
import { processAuctionAction, AuctionActionPayload } from "@/lib/server/auction-store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as AuctionActionPayload;

    if (!payload.leagueId || !payload.type) {
      return NextResponse.json(
        { success: false, error: "leagueId and type are required" },
        { status: 400 }
      );
    }

    const result = processAuctionAction(payload);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Action validation failed",
          session: result.state.session,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      session: result.state.session,
      teams: result.state.teams,
      players: result.state.players,
      rules: result.state.rules,
      league: result.state.league,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error executing auction action:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Failed to execute action" },
      { status: 500 }
    );
  }
}
