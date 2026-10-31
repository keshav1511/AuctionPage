// ==============================================================================
// NTL AUCTION PLATFORM - INITIAL LEAGUES DATA FIXTURE
// Pure data module: safe for both Server Components / API Routes and Client Components.
// Does NOT contain any "use client" directives or React hooks.
// ==============================================================================

import { League } from "@/types";

export const INITIAL_LEAGUES: League[] = [
  {
    id: "league-ntl",
    slug: "nalanda-turf-league",
    name: "Nalanda Turf League",
    description: "Premier cricket auction championship featuring elite franchises.",
    logoUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&auto=format&fit=crop&q=80",
    matchDate: "2026-11-20",
    matchVenue: "Perfect Pass, Falnir",
    auctionDate: "2026-11-05",
    auctionTime: "18:00",
    timezone: "Asia/Kolkata",
    googleSheetsUrl: "https://docs.google.com/spreadsheets/d/1uC87Sn8KLbAHs9g1ZT63AIyIY85C7LVh-cZF8dvvgo0/edit?usp=sharing",
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

export const DEFAULT_LEAGUE_ID = "league-ntl";

export function getInitialLeagueById(leagueId: string): League | undefined {
  return INITIAL_LEAGUES.find((l) => l.id === leagueId);
}

export function getAllInitialLeagues(): League[] {
  return [...INITIAL_LEAGUES];
}
