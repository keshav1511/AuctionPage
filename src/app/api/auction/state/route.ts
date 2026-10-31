import { NextRequest, NextResponse } from "next/server";
import { getAuthoritativeLeagueState } from "@/lib/server/auction-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const leagueId = searchParams.get("leagueId") || "league-ntl";

    const state = getAuthoritativeLeagueState(leagueId);

    return NextResponse.json({
      success: true,
      leagueId,
      session: state.session,
      teams: state.teams,
      players: state.players,
      rules: state.rules,
      league: state.league,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error retrieving auction state:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Failed to retrieve state" },
      { status: 500 }
    );
  }
}
