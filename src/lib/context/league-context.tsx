"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { League, BrandingPalette, Team, Player, AuctionRules, TournamentSummary } from "@/types";
import { generateSportsBrandingPalette } from "@/lib/branding/theme-generator";

import { INITIAL_LEAGUES, DEFAULT_LEAGUE_ID } from "@/lib/mock-data/leagues";
import { NTL_TEAMS, NTL_PLAYERS, NTL_DEFAULT_RULES, NTL_DEFAULT_LEAGUE } from "@/config/ntl-season-1";
export { INITIAL_LEAGUES, DEFAULT_LEAGUE_ID };

export interface LeagueContextType {
  activeLeague: League;
  leagues: League[];
  tournaments: TournamentSummary[];
  teams: Team[];
  players: Player[];
  auctionRules: AuctionRules;
  refreshTournaments: () => Promise<void>;
  switchLeague: (
    leagueId: string,
    force?: boolean
  ) => Promise<{ success: boolean; requiresConfirmation?: boolean; message?: string }>;
  createLeague: (newLeague: Omit<League, "id">) => League;
  createNewTournament: (data: {
    name: string;
    edition?: string | number;
    description?: string;
    logoUrl?: string;
    minSquadSize?: number;
    maxSquadSize?: number;
    totalPurse?: number;
    defaultBasePrice?: number;
    primaryColor?: string;
    secondaryColor?: string;
  }) => Promise<TournamentSummary>;
  deleteTournament: (leagueId: string) => Promise<void>;
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
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [activeLeagueId, setActiveLeagueId] = useState<string>(NTL_DEFAULT_LEAGUE.id);

  const [teams, setTeams] = useState<Team[]>(NTL_TEAMS);
  const [players, setPlayers] = useState<Player[]>(NTL_PLAYERS);
  const [auctionRules, setAuctionRules] = useState<AuctionRules>(NTL_DEFAULT_RULES);

  // Fetch all tournament summaries
  const refreshTournaments = useCallback(async () => {
    try {
      const res = await fetch("/api/tournaments");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tournaments)) {
          setTournaments(data.tournaments);

          // Update leagues list with discovered tournaments
          setLeagues((prev) => {
            const next = [...prev];
            for (const t of data.tournaments) {
              const idx = next.findIndex((l) => l.id === t.id);
              const mappedLeague: League = {
                id: t.id,
                name: t.name,
                slug: t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                edition: t.edition || t.season,
                description: t.description || "",
                logoUrl: t.logoUrl || "",
                primaryColor: (idx >= 0 && next[idx].primaryColor) || "#059669",
                secondaryColor: (idx >= 0 && next[idx].secondaryColor) || "#38bdf8",
                status: t.status,
                created_at: t.updatedAt,
              };

              if (idx >= 0) {
                next[idx] = { ...next[idx], ...mappedLeague };
              } else {
                next.push(mappedLeague);
              }
            }
            return next;
          });
        }
      }
    } catch (err) {
      console.warn("[LeagueContext] Failed to load tournaments:", err);
    }
  }, []);

  // Load active league ID preference and tournament list on mount
  useEffect(() => {
    try {
      const storedId = localStorage.getItem(STORAGE_KEY);
      if (storedId) {
        setActiveLeagueId(storedId);
      }
    } catch {
      // Local storage unavailable
    }
    refreshTournaments();
  }, [refreshTournaments]);

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

  const activeLeague = leagues.find((l) => l.id === activeLeagueId) || leagues[0] || NTL_DEFAULT_LEAGUE;

  // Apply CSS variables to document root for real-time dynamic branding
  useEffect(() => {
    if (typeof document === "undefined" || !activeLeague) return;
    const p = activeLeague.brandingPalette || generateSportsBrandingPalette(activeLeague.primaryColor || "#059669");
    const root = document.documentElement;

    root.style.setProperty("--league-primary", p.primary);
    root.style.setProperty("--league-secondary", p.secondary);
    root.style.setProperty("--league-accent", p.accent);
    root.style.setProperty("--league-bg", p.background);
    root.style.setProperty("--league-card", p.card);
    root.style.setProperty("--league-border", p.border);
    root.style.setProperty("--league-text", p.text);

    // Dynamic browser tab favicon
    if (activeLeague.logoUrl) {
      let iconLink = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
      if (!iconLink) {
        iconLink = document.createElement("link");
        iconLink.rel = "shortcut icon";
        document.head.appendChild(iconLink);
      }
      iconLink.href = activeLeague.logoUrl;
    }

    // Dynamic browser tab title
    if (activeLeague.name) {
      const currentTitle = document.title;
      if (!currentTitle || currentTitle.includes("NTL") || currentTitle.includes("Auction") || currentTitle.includes("Premier")) {
        document.title = `${activeLeague.name} — Live Cricket Auction`;
      }
    }
  }, [activeLeague]);

  const switchLeague = async (
    leagueId: string,
    force: boolean = false
  ): Promise<{ success: boolean; requiresConfirmation?: boolean; message?: string }> => {
    try {
      const res = await fetch("/api/tournaments/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: leagueId,
          currentTournamentId: activeLeagueId,
          force,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.requiresConfirmation) {
          return {
            success: false,
            requiresConfirmation: true,
            message: data.message,
          };
        }
        return {
          success: false,
          message: data.error || "Failed to switch tournament.",
        };
      }

      setActiveLeagueId(leagueId);
      try {
        localStorage.setItem(STORAGE_KEY, leagueId);
      } catch {}

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Fallback local switch if network fails
      setActiveLeagueId(leagueId);
      try {
        localStorage.setItem(STORAGE_KEY, leagueId);
      } catch {}
      return { success: true, message };
    }
  };

  const createNewTournament = async (data: {
    name: string;
    edition?: string | number;
    description?: string;
    logoUrl?: string;
    minSquadSize?: number;
    maxSquadSize?: number;
    totalPurse?: number;
    defaultBasePrice?: number;
    primaryColor?: string;
    secondaryColor?: string;
  }): Promise<TournamentSummary> => {
    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || "Failed to create tournament.");
    }

    const newTourney: TournamentSummary = result.tournament;

    // Immediately update local state
    setTournaments((prev) => [...prev, newTourney]);

    const newLeague: League = {
      id: newTourney.id,
      name: newTourney.name,
      slug: newTourney.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      edition: newTourney.edition || newTourney.season,
      description: newTourney.description || "",
      logoUrl: newTourney.logoUrl || "",
      primaryColor: data.primaryColor || "#059669",
      secondaryColor: data.secondaryColor || "#38bdf8",
      status: "IDLE",
      created_at: newTourney.updatedAt,
    };

    setLeagues((prev) => [...prev, newLeague]);
    setActiveLeagueId(newTourney.id);
    setTeams([]);
    setPlayers([]);
    setAuctionRules({
      ...NTL_DEFAULT_RULES,
      totalPurse: newTourney.totalPurse || 100000,
      minimumSquadSize: newTourney.minSquadSize || 8,
      maximumSquadSize: newTourney.maxSquadSize || 8,
      basePrice: newTourney.defaultBasePrice || 2000,
      minimumBasePrice: newTourney.defaultBasePrice || 2000,
    });

    try {
      localStorage.setItem(STORAGE_KEY, newTourney.id);
    } catch {}

    return newTourney;
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

  const deleteTournament = async (leagueId: string) => {
    const res = await fetch(`/api/tournaments/${encodeURIComponent(leagueId)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || "Could not delete tournament.");
    setTournaments((current) => current.filter((t) => t.id !== leagueId));
    setLeagues((current) => current.filter((league) => league.id !== leagueId));
    if (activeLeagueId === leagueId) {
      const remaining = leagues.find((league) => league.id !== leagueId);
      if (remaining) await switchLeague(remaining.id);
    }
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
        tournaments,
        teams,
        players,
        auctionRules,
        refreshTournaments,
        switchLeague,
        createLeague,
        createNewTournament,
        deleteTournament,
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
