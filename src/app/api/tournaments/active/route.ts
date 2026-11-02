import { NextRequest, NextResponse } from "next/server";
import {
  getAllTournamentsFromSheets,
  getDesignatedActiveTournamentId,
  setDesignatedActiveTournamentId,
} from "@/lib/sheets/google-sheets-repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/tournaments/active
 * Authoritative endpoint for public spectators on /live to discover the currently active tournament.
 * Priority:
 * 1. Multiple IN_PROGRESS tournaments: If one is explicitly designated, return it; otherwise return 409 Conflict.
 * 2. Exactly one tournament with status === "IN_PROGRESS": Return it.
 * 3. Explicitly designated active tournament (even if IDLE/PAUSED): Return it.
 * 4. Fallback: Prefer "league-main" or first available tournament.
 */
export async function GET() {
  try {
    const tournaments = await getAllTournamentsFromSheets();

    if (!tournaments || tournaments.length === 0) {
      return NextResponse.json({
        success: true,
        activeTournamentId: "league-main",
        tournament: null,
      });
    }

    const designatedId = getDesignatedActiveTournamentId();
    const inProgressTournaments = tournaments.filter((t) => t.status === "IN_PROGRESS");

    // Case 1: Multiple tournaments are currently IN_PROGRESS
    if (inProgressTournaments.length > 1) {
      // If one of the in-progress tournaments is explicitly designated, resolve to it
      if (designatedId) {
        const designatedInProgress = inProgressTournaments.find((t) => t.id === designatedId);
        if (designatedInProgress) {
          return NextResponse.json({
            success: true,
            activeTournamentId: designatedInProgress.id,
            tournament: designatedInProgress,
            isDesignated: true,
          });
        }
      }

      // Ambiguity Conflict: Multiple live tournaments without explicit designation
      return NextResponse.json(
        {
          success: false,
          conflict: true,
          error: "Multiple tournaments have an auction currently IN_PROGRESS without an explicit designation. Spectators must specify ?tournamentId=<id> in the URL to select the intended tournament.",
          activeTournamentId: null,
          inProgressTournaments: inProgressTournaments.map((t) => ({
            id: t.id,
            name: t.name,
            edition: t.edition,
            status: t.status,
          })),
        },
        { status: 409 }
      );
    }

    // Case 2: Exactly one tournament is IN_PROGRESS
    if (inProgressTournaments.length === 1) {
      return NextResponse.json({
        success: true,
        activeTournamentId: inProgressTournaments[0].id,
        tournament: inProgressTournaments[0],
      });
    }

    // Case 3: Explicitly designated tournament exists (even if IDLE or PAUSED)
    if (designatedId) {
      const designatedTournament = tournaments.find((t) => t.id === designatedId);
      if (designatedTournament) {
        return NextResponse.json({
          success: true,
          activeTournamentId: designatedTournament.id,
          tournament: designatedTournament,
          isDesignated: true,
        });
      }
    }

    // Case 4: Default fallback to "league-main" or first tournament
    const defaultTournament =
      tournaments.find((t) => t.id === "league-main") || tournaments[0];

    return NextResponse.json({
      success: true,
      activeTournamentId: defaultTournament.id,
      tournament: defaultTournament,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Active Tournament API] GET error:", message);
    return NextResponse.json(
      { success: false, error: message, activeTournamentId: "league-main" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tournaments/active
 * Allows administrator to explicitly designate a tournament as the public active tournament.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tournamentId } = body;

    if (!tournamentId || typeof tournamentId !== "string") {
      return NextResponse.json(
        { success: false, error: "Valid tournamentId string is required." },
        { status: 400 }
      );
    }

    setDesignatedActiveTournamentId(tournamentId.trim());

    return NextResponse.json({
      success: true,
      designatedActiveTournamentId: tournamentId.trim(),
      message: `Tournament "${tournamentId.trim()}" designated as authoritative active tournament.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
