// ==============================================================================
// BLANK CRICKET AUCTION PLATFORM - INITIAL LEAGUES FIXTURE
// Pure data module: safe for Server Components / API Routes and Client Components.
// ==============================================================================

import { League } from "@/types";
import { DEFAULT_LEAGUE } from "@/config/default-config";

export const INITIAL_LEAGUES: League[] = [
  DEFAULT_LEAGUE,
];

export const DEFAULT_LEAGUE_ID = DEFAULT_LEAGUE.id;

export function getInitialLeagueById(leagueId: string): League | undefined {
  return INITIAL_LEAGUES.find((l) => l.id === leagueId);
}

export function getAllInitialLeagues(): League[] {
  return [...INITIAL_LEAGUES];
}
