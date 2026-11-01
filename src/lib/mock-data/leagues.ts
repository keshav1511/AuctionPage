// ==============================================================================
// NTL AUCTION PLATFORM - INITIAL LEAGUES DATA FIXTURE
// Pure data module: safe for both Server Components / API Routes and Client Components.
// Does NOT contain any "use client" directives or React hooks.
// ==============================================================================

import { League } from "@/types";
import { NTL_DEFAULT_LEAGUE } from "@/config/ntl-season-1";

export const INITIAL_LEAGUES: League[] = [
  NTL_DEFAULT_LEAGUE,
];

export const DEFAULT_LEAGUE_ID = "league-ntl";

export function getInitialLeagueById(leagueId: string): League | undefined {
  return INITIAL_LEAGUES.find((l) => l.id === leagueId);
}

export function getAllInitialLeagues(): League[] {
  return [...INITIAL_LEAGUES];
}
