import { publicSnapshot } from "@/lib/realtime/snapshot";
import { NextRequest, NextResponse } from "next/server";
import { getAuthoritativeLeagueState } from "@/lib/server/auction-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const leagueId = searchParams.get("leagueId") || "league-main";

    const authoritative = await getAuthoritativeLeagueState(leagueId);
    const state = authoritative ? publicSnapshot({ ...authoritative, revision: authoritative.session.revision || authoritative.session.version || 1 }) : null;
    if (!state) {
      return NextResponse.json(
        { success: false, error: `League with ID "${leagueId}" not found` },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
          },
        }
      );
    }

    const revision = state.session.revision || state.session.version || 1;

    return NextResponse.json(
      {
        success: true,
        leagueId,
        revision,
        version: state.session.version || revision,
        session: state.session,
        teams: state.teams,
        players: state.players,
        rules: state.rules,
        league: state.league,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
          "Pragma": "no-cache",
          "Expires": "0",
          "Surrogate-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Error retrieving auction state:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Failed to retrieve state" },
      { status: 500 }
    );
  }
}
