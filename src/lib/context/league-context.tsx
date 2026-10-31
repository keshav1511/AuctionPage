"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { League, BrandingPalette } from "@/types";
import { generateSportsBrandingPalette } from "@/lib/branding/theme-generator";

export const INITIAL_LEAGUES: League[] = [
  {
    id: "league-ntl",
    slug: "nalanda-turf-league",
    name: "Nalanda Turf League",
    description: "Premier cricket auction championship featuring 6 elite franchises in Nalanda District.",
    logoUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&auto=format&fit=crop&q=80",
    matchDate: "2026-11-20",
    matchVenue: "Perfect Pass, Falnir",
    auctionDate: "2026-11-05",
    auctionTime: "18:00",
    timezone: "Asia/Kolkata",
    googleSheetsUrl: "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
    googleDriveFolderUrl: "https://drive.google.com/drive/folders/1MtjUStUIqnlQic13-sfML_NbPygEkSwpUsgDe7b3hHJ1GGKbP7xvSHx3MI11kTS7CgVaT2hA",
    primaryColor: "#059669",
    secondaryColor: "#F59E0B",
    brandingPalette: {
      primary: "#059669",
      secondary: "#F59E0B",
      accent: "#10B981",
      background: "#090D10",
      card: "#11161B",
      border: "#1E293B",
      text: "#F8FAFC",
    },
  },
  {
    id: "league-mpl",
    slug: "mangalore-premier-turf",
    name: "Mangalore Premier Turf",
    description: "Coastal Karnataka's high-stakes night turf tournament.",
    logoUrl: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=200&auto=format&fit=crop&q=80",
    matchDate: "2026-12-10",
    matchVenue: "Falnir Arena, Mangalore",
    auctionDate: "2026-11-28",
    auctionTime: "19:30",
    timezone: "Asia/Kolkata",
    googleSheetsUrl: "",
    googleDriveFolderUrl: "https://drive.google.com/drive/folders/1MtjUStUIqnlQic13-sfML_NbPygEkSwpUsgDe7b3hHJ1GGKbP7xvSHx3MI11kTS7CgVaT2hA",
    primaryColor: "#2563EB",
    secondaryColor: "#F59E0B",
    brandingPalette: {
      primary: "#2563EB",
      secondary: "#F59E0B",
      accent: "#3B82F6",
      background: "#080C14",
      card: "#0E1522",
      border: "#1D2A40",
      text: "#F8FAFC",
    },
  },
];

interface LeagueContextType {
  activeLeague: League;
  leagues: League[];
  switchLeague: (leagueId: string) => void;
  createLeague: (newLeague: Omit<League, "id">) => League;
  updateLeague: (leagueId: string, updates: Partial<League>) => void;
  updateLeaguePalette: (leagueId: string, palette: BrandingPalette) => void;
}

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

const STORAGE_KEY = "ntl_auction_active_league_id";
const LEAGUES_STORAGE_KEY = "ntl_auction_leagues_list";

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [leagues, setLeagues] = useState<League[]>(INITIAL_LEAGUES);
  const [activeLeagueId, setActiveLeagueId] = useState<string>(INITIAL_LEAGUES[0].id);

  // Load from local storage on client mount
  useEffect(() => {
    try {
      const storedLeagues = localStorage.getItem(LEAGUES_STORAGE_KEY);
      if (storedLeagues) {
        setLeagues(JSON.parse(storedLeagues));
      }
      const storedId = localStorage.getItem(STORAGE_KEY);
      if (storedId) {
        setActiveLeagueId(storedId);
      }
    } catch {
      // Local storage unavailable
    }
  }, []);

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
      localStorage.setItem(LEAGUES_STORAGE_KEY, JSON.stringify(updated));
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}

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
    try {
      localStorage.setItem(LEAGUES_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const updateLeaguePalette = (leagueId: string, palette: BrandingPalette) => {
    updateLeague(leagueId, {
      brandingPalette: palette,
      primaryColor: palette.primary,
      secondaryColor: palette.secondary,
    });
  };

  return (
    <LeagueContext.Provider
      value={{
        activeLeague,
        leagues,
        switchLeague,
        createLeague,
        updateLeague,
        updateLeaguePalette,
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
