import { NextRequest, NextResponse } from "next/server";
import {
  getAuctionStateFromSheets,
  setDesignatedActiveTournamentId,
} from "@/lib/database/postgres-repository";
import { authenticateAdminActionRequest } from "@/lib/auth/admin-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/tournaments/switch
 * Safely verifies if tournament switching is allowed.
 * If the current tournament has an auction status of IN_PROGRESS, blocks switching unless force: true.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tournamentId, currentTournamentId, force } = body;

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: "Target tournamentId is required." },
        { status: 400 }
      );
    }
    const auth = authenticateAdminActionRequest(req, tournamentId);
    if (!auth.authorized) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    // Check if the current tournament is active and currently IN_PROGRESS
    if (currentTournamentId && currentTournamentId !== tournamentId && !force) {
      try {
        const currentState = await getAuctionStateFromSheets(currentTournamentId);
        if (currentState && currentState.status === "IN_PROGRESS") {
          return NextResponse.json(
            {
              success: false,
              requiresConfirmation: true,
              currentStatus: "IN_PROGRESS",
              message:
                "An auction is currently IN_PROGRESS for this tournament. Switching tournaments during an active auction will disconnect the live session. Are you sure you want to proceed?",
            },
            { status: 409 }
          );
        }
      } catch (err) {
        console.warn("[Tournaments Switch] Failed to check current auction state:", err);
      }
    }

    // Explicitly designate the switched tournament as active
    setDesignatedActiveTournamentId(tournamentId);

    return NextResponse.json({
      success: true,
      tournamentId,
      message: `Switched active tournament to "${tournamentId}".`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Tournaments Switch API] error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
