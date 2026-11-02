import { NextRequest, NextResponse } from "next/server";
import {
  getAllTournamentsFromSheets,
  saveLeagueConfigToSheets,
  saveTeamsToSheets,
  savePlayersToSheets,
  saveAuctionStateToSheets,
  invalidateLeagueCache,
} from "@/lib/sheets/google-sheets-repository";
import { League, AuctionRules, TournamentSummary } from "@/types";
import { AuctionStateRow } from "@/lib/sheets/tab-definitions";
import { DEFAULT_AUCTION_RULES } from "@/config/default-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/tournaments
 * Lists all available tournaments with their summaries
 */
export async function GET() {
  try {
    const tournaments = await getAllTournamentsFromSheets();
    return NextResponse.json({ success: true, tournaments });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Tournaments API] GET error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tournaments
 * Creates a brand-new tournament starting completely blank (0 players, 0 teams, 0 bids, 0 purchases)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      edition,
      description,
      logoUrl,
      minSquadSize,
      maxSquadSize,
      totalPurse,
      defaultBasePrice,
      primaryColor,
      secondaryColor,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Tournament name is required." },
        { status: 400 }
      );
    }

    const cleanName = name.trim();
    const cleanEdition = (edition && String(edition).trim()) || "Season 1";
    // Generate clean unique ID
    const tournamentId = `tournament-${Date.now()}`;

    const newLeague: League = {
      id: tournamentId,
      name: cleanName,
      slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      edition: cleanEdition,
      description: (description && String(description).trim()) || "",
      logoUrl: (logoUrl && String(logoUrl).trim()) || "",
      primaryColor: primaryColor || "#059669",
      secondaryColor: secondaryColor || "#38bdf8",
      status: "IDLE",
      created_at: new Date().toISOString(),
    };

    const newRules: AuctionRules = {
      ...DEFAULT_AUCTION_RULES,
      totalPurse: Number(totalPurse) || 100000,
      minimumSquadSize: Number(minSquadSize) || 8,
      maximumSquadSize: Number(maxSquadSize) || 8,
      basePrice: Number(defaultBasePrice) || 2000,
    };

    const blankAuctionState: AuctionStateRow = {
      id: `auction-${tournamentId}`,
      seasonId: tournamentId,
      status: "IDLE",
      currentPlayerId: null,
      currentHighestBid: 0,
      currentLeadingTeamId: null,
      bidCount: 0,
      timerSeconds: 30,
      timerExpiresAt: "",
      round: 1,
      bidExtensionSeconds: 15,
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    // 1. Save League Config & Rules
    await saveLeagueConfigToSheets(newLeague, newRules);

    // 2. Initialize blank teams (0 teams)
    await saveTeamsToSheets(tournamentId, []);

    // 3. Initialize blank players (0 players)
    await savePlayersToSheets(tournamentId, []);

    // 4. Initialize clean IDLE auction state
    await saveAuctionStateToSheets(tournamentId, blankAuctionState);

    // 5. Invalidate cache
    invalidateLeagueCache(tournamentId);

    const tournamentSummary: TournamentSummary = {
      id: tournamentId,
      name: newLeague.name,
      season: newLeague.edition,
      edition: newLeague.edition,
      description: newLeague.description,
      logoUrl: newLeague.logoUrl,
      status: "IDLE",
      teamsCount: 0,
      playersCount: 0,
      totalPurse: newRules.totalPurse,
      minSquadSize: newRules.minimumSquadSize,
      maxSquadSize: newRules.maximumSquadSize,
      defaultBasePrice: newRules.basePrice,
      teams: [],
      updatedAt: newLeague.created_at,
    };

    return NextResponse.json({
      success: true,
      tournament: tournamentSummary,
      message: `Tournament "${cleanName}" created successfully with blank roster.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Tournaments API] POST error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
