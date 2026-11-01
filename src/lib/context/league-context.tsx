"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { League, BrandingPalette, Team, Player, AuctionRules } from "@/types";
import { generateSportsBrandingPalette } from "@/lib/branding/theme-generator";

import { INITIAL_LEAGUES, DEFAULT_LEAGUE_ID } from "@/lib/mock-data/leagues";
import { NTL_TEAMS, NTL_PLAYERS, NTL_DEFAULT_RULES, NTL_DEFAULT_LEAGUE } from "@/config/ntl-season-1";
export { INITIAL_LEAGUES, DEFAULT_LEAGUE_ID };

interface LeagueContextType {
  activeLeague: League;
  leagues: League[];
  teams: Team[];
  players: Player[];
  auctionRules: AuctionRules;
  switchLeague: (leagueId: string) => void;
  createLeague: (newLeague: Omit<League, "id">) => League;
  updateLeague: (leagueId: string, updates: Partial<League>) => void;
  updateLeaguePalette: (leagueId: string, palette: BrandingPalette) => void;
  addTeam: (team: Team) => void;
  updateTeam: (teamId: string, updates: Partial<Team>) => void;
  deleteTeam: (teamId: string) => void;
  setTeamsForActiveLeague: (teams: Team[]) => void;
  addPlayers: (newPlayers: Player[]) => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  setPlayersForActiveLeague: (players: Player[]) => void;
  updateAuctionRules: (rules: Partial<AuctionRules>) => void;
}

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

const STORAGE_KEY = "ntl_auction_active_league_id";

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [leagues, setLeagues] = useState<League[]>(INITIAL_LEAGUES);
  const [activeLeagueId, setActiveLeagueId] = useState<string>(NTL_DEFAULT_LEAGUE.id);

  const [teams, setTeams] = useState<Team[]>(NTL_TEAMS);
  const [players, setPlayers] = useState<Player[]>(NTL_PLAYERS);
  const [auctionRules, setAuctionRules] = useState<AuctionRules>(NTL_DEFAULT_RULES);

  // Load active league ID preference on mount
  useEffect(() => {
    try {
      const storedId = localStorage.getItem(STORAGE_KEY);
      if (storedId && INITIAL_LEAGUES.some((l) => l.id === storedId)) {
        setActiveLeagueId(storedId);
      }
    } catch {
      // Local storage unavailable
    }
  }, []);

  // Fetch authoritative state from server (backed by Google Sheets) whenever activeLeagueId changes
  useEffect(() => {
    let isCancelled = false;

    fetch(`/api/auction/state?leagueId=${encodeURIComponent(activeLeagueId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isCancelled && data) {
          if (data.teams && Array.isArray(data.teams)) setTeams(data.teams);
          if (data.players && Array.isArray(data.players)) setPlayers(data.players);
          if (data.rules) setAuctionRules(data.rules);
          if (data.league) {
            setLeagues((prev) => {
              const existingIdx = prev.findIndex((l) => l.id === data.league.id);
              if (existingIdx >= 0) {
                const next = [...prev];
                next[existingIdx] = { ...next[existingIdx], ...data.league };
                return next;
              }
              return [...prev, data.league];
            });
          }
        }
      })
      .catch((err) => {
        console.warn("[LeagueContext] Failed to load server state:", err);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeLeagueId]);

  const activeLeague = leagues.find((l) => l.id === activeLeagueId) || leagues[0];

  // Apply CSS variables to document root for real-time dynamic branding
  useEffect(() => {
    if (typeof document === "undefined") return;
    const p = activeLeague.brandingPalette || generateSportsBrandingPalette(activeLeague.primaryColor);
    const root = document.documentElement;

    root.style.setProperty("--league-primary", p.primary);
    root.style.setProperty("--league-secondary", p.secondary);
    root.style.setProperty("--league-accent", p.accent);
    root.style.setProperty("--league-bg", p.background);
    root.style.setProperty("--league-card", p.card);
    root.style.setProperty("--league-border", p.border);
    root.style.setProperty("--league-text", p.text);
  }, [activeLeague]);

  const switchLeague = (leagueId: string) => {
    const target = leagues.find((l) => l.id === leagueId);
    if (target) {
      setActiveLeagueId(leagueId);
      try {
        localStorage.setItem(STORAGE_KEY, leagueId);
      } catch {}
    }
  };

  const createLeague = (newLeagueData: Omit<League, "id">): League => {
    const id = `league-${Date.now()}`;
    const palette = newLeagueData.brandingPalette || generateSportsBrandingPalette(newLeagueData.primaryColor);
    const newLeague: League = {
      ...newLeagueData,
      id,
      brandingPalette: palette,
    };

    const updated = [...leagues, newLeague];
    setLeagues(updated);
    setActiveLeagueId(id);

    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}

    // Persist new league directly to Google Sheets
    syncServer({ type: "UPDATE_LEAGUE", league: newLeague });

    return newLeague;
  };

  const updateLeague = (leagueId: string, updates: Partial<League>) => {
    const updated = leagues.map((l) => {
      if (l.id === leagueId) {
        const merged = { ...l, ...updates };
        if (updates.primaryColor && !updates.brandingPalette) {
          merged.brandingPalette = generateSportsBrandingPalette(updates.primaryColor);
        }
        return merged;
      }
      return l;
    });

    setLeagues(updated);
    syncServer({ type: "UPDATE_LEAGUE", league: updates });
  };

  const syncServer = (payload: Record<string, unknown>) => {
    fetch("/api/auction/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leagueId: activeLeagueId, ...payload }),
    }).catch((err) => {
      console.error("[LeagueContext] Server sync failure:", err);
    });
  };

  const updateLeaguePalette = (leagueId: string, palette: BrandingPalette) => {
    updateLeague(leagueId, {
      brandingPalette: palette,
      primaryColor: palette.primary,
      secondaryColor: palette.secondary,
    });
  };

  // Team Management Methods
  const addTeam = (team: Team) => {
    const updated = [...teams, team];
    setTeams(updated);
    syncServer({ type: "UPDATE_TEAMS", teams: updated });
  };

  const updateTeam = (teamId: string, updates: Partial<Team>) => {
    const updated = teams.map((t) => (t.id === teamId ? { ...t, ...updates } : t));
    setTeams(updated);
    syncServer({ type: "UPDATE_TEAMS", teams: updated });
  };

  const deleteTeam = (teamId: string) => {
    const updated = teams.filter((t) => t.id !== teamId);
    setTeams(updated);
    syncServer({ type: "UPDATE_TEAMS", teams: updated });
  };

  const setTeamsForActiveLeague = (newTeams: Team[]) => {
    setTeams(newTeams);
    syncServer({ type: "UPDATE_TEAMS", teams: newTeams });
  };

  // Player Management Methods
  const addPlayers = (newPlayers: Player[]) => {
    const updated = [...players, ...newPlayers];
    setPlayers(updated);
    syncServer({ type: "UPDATE_PLAYERS", players: updated });
  };

  const updatePlayer = (playerId: string, updates: Partial<Player>) => {
    const updated = players.map((p) => (p.id === playerId ? { ...p, ...updates } : p));
    setPlayers(updated);
    syncServer({ type: "UPDATE_PLAYERS", players: updated });
  };

  const setPlayersForActiveLeague = (newPlayers: Player[]) => {
    setPlayers(newPlayers);
    syncServer({ type: "UPDATE_PLAYERS", players: newPlayers });
  };

  // Auction Rules Methods
  const updateAuctionRules = (rulesUpdates: Partial<AuctionRules>) => {
    const updated = { ...auctionRules, ...rulesUpdates };
    setAuctionRules(updated);
    syncServer({ type: "UPDATE_RULES", rules: rulesUpdates });
  };

  return (
    <LeagueContext.Provider
      value={{
        activeLeague,
        leagues,
        teams,
        players,
        auctionRules,
        switchLeague,
        createLeague,
        updateLeague,
        updateLeaguePalette,
        addTeam,
        updateTeam,
        deleteTeam,
        setTeamsForActiveLeague,
        addPlayers,
        updatePlayer,
        setPlayersForActiveLeague,
        updateAuctionRules,
      }}
    >
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  const context = useContext(LeagueContext);
  if (!context) {
    throw new Error("useLeague must be used within a LeagueProvider");
  }
  return context;
}

