"use client";

import { useState, useEffect } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLeague } from "@/lib/context/league-context";
import { ImportModal } from "@/components/admin/import-modal";
import { uploadImageSafely } from "@/lib/media/image-upload-client";
import { TournamentSummary, AuctionStatus } from "@/types";
import {
  Trophy,
  CheckCircle2,
  Calendar,
  Upload,
  Plus,
  ArrowRight,
  FileSpreadsheet,
  FolderOpen,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Database,
  Users,
  Coins,
  ArrowLeft,
  Sparkles,
  Layers,
} from "lucide-react";
import Link from "next/link";

interface DataSourceValidationResult {
  valid: boolean;
  errorCode?: string;
  error?: string;
  sheet?: {
    spreadsheetId: string;
    accessible: boolean;
    activeSheetTitle?: string;
    availableSheets?: string[];
    rowCount?: number;
    columnCount?: number;
    headers?: string[];
  };
  drive?: {
    folderId: string;
    accessible: boolean;
    filesCount?: number;
    sampleFiles?: string[];
  };
  detectedColumns?: {
    nameCol: string;
    photoCol: string;
    typeCol: string;
    teamCol: string;
  };
  discoveredTeams?: string[];
  warnings?: string[];
}

export default function TournamentSetupPage() {
  const {
    activeLeague,
    tournaments,
    refreshTournaments,
    switchLeague,
    createNewTournament,
    updateLeague,
    teams: currentTeams,
    players: currentPlayers,
  } = useLeague();

  // Mode: "select" (tournament picker), "configure" (editing active tournament), "create" (new tournament form)
  const [viewMode, setViewMode] = useState<"select" | "configure" | "create">("select");

  // Active tournament form state
  const [name, setName] = useState(activeLeague.name);
  const [slug, setSlug] = useState(activeLeague.slug);
  const [description, setDescription] = useState(activeLeague.description || "");
  const [logoUrl, setLogoUrl] = useState(activeLeague.logoUrl || "");
  const [orgName, setOrgName] = useState(activeLeague.orgName || "");
  const [orgLogoUrl, setOrgLogoUrl] = useState(activeLeague.orgLogoUrl || "");
  const [matchDate, setMatchDate] = useState(activeLeague.matchDate || "");
  const [matchVenue, setMatchVenue] = useState(activeLeague.matchVenue || "");
  const [auctionDate, setAuctionDate] = useState(activeLeague.auctionDate || "");
  const [auctionTime, setAuctionTime] = useState(activeLeague.auctionTime || "18:00");
  const [timezone, setTimezone] = useState(activeLeague.timezone || "Asia/Kolkata");
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState(activeLeague.googleSheetsUrl || "");
  const [googleDriveFolderUrl, setGoogleDriveFolderUrl] = useState(activeLeague.googleDriveFolderUrl || "");
  const [primaryColor, setPrimaryColor] = useState(activeLeague.primaryColor || "#059669");

  // New Tournament Creation Form State (Option 2)
  const [newTourneyName, setNewTourneyName] = useState("");
  const [newTourneyEdition, setNewTourneyEdition] = useState("Season 2");
  const [newTourneyDesc, setNewTourneyDesc] = useState("");
  const [newTourneyLogoUrl, setNewTourneyLogoUrl] = useState("");
  const [newTourneyMinSquad, setNewTourneyMinSquad] = useState(8);
  const [newTourneyMaxSquad, setNewTourneyMaxSquad] = useState(8);
  const [newTourneyPurse, setNewTourneyPurse] = useState(100000);
  const [newTourneyBasePrice, setNewTourneyBasePrice] = useState(2000);
  const [newTourneyPrimaryColor, setNewTourneyPrimaryColor] = useState("#059669");
  const [newTourneySecondaryColor, setNewTourneySecondaryColor] = useState("#38bdf8");
  const [isCreatingTourney, setIsCreatingTourney] = useState(false);
  const [createTourneyError, setCreateTourneyError] = useState<string | null>(null);

  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingOrgLogo, setIsUploadingOrgLogo] = useState(false);
  const [isUploadingNewTourneyLogo, setIsUploadingNewTourneyLogo] = useState(false);

  // Data sources testing and sync states
  const [testingConnection, setTestingConnection] = useState(false);
  const [validationResult, setValidationResult] = useState<DataSourceValidationResult | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshingData, setRefreshingData] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Refresh tournaments list on mount
  useEffect(() => {
    refreshTournaments();
  }, [refreshTournaments]);

  // Sync state if active league changes
  useEffect(() => {
    setName(activeLeague.name);
    setSlug(activeLeague.slug);
    setDescription(activeLeague.description || "");
    setLogoUrl(activeLeague.logoUrl || "");
    setOrgName(activeLeague.orgName || "");
    setOrgLogoUrl(activeLeague.orgLogoUrl || "");
    setMatchDate(activeLeague.matchDate || "");
    setMatchVenue(activeLeague.matchVenue || "");
    setAuctionDate(activeLeague.auctionDate || "");
    setAuctionTime(activeLeague.auctionTime || "18:00");
    setTimezone(activeLeague.timezone || "Asia/Kolkata");
    setGoogleSheetsUrl(activeLeague.googleSheetsUrl || "");
    setGoogleDriveFolderUrl(activeLeague.googleDriveFolderUrl || "");
    setPrimaryColor(activeLeague.primaryColor || "#059669");
    setValidationResult(null);
    setConnectionError(null);
    setRefreshNotice(null);
    setRefreshError(null);
  }, [activeLeague]);

  // Handle local logo file upload via /api/media/upload -> Google Drive with compression
  const handleUploadDriveMedia = async (
    file: File,
    setter: (url: string) => void,
    setLoading: (l: boolean) => void
  ) => {
    setLoading(true);
    try {
      const result = await uploadImageSafely(file, "league");
      setter(result.url);
      setSavedNotice("Uploaded image to Google Drive.");
      setTimeout(() => setSavedNotice(null), 3000);
    } catch (err) {
      alert((err as Error).message || "Failed to upload image");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateLeague(activeLeague.id, {
      name,
      slug,
      description,
      logoUrl,
      orgName,
      orgLogoUrl,
      matchDate,
      matchVenue,
      auctionDate,
      auctionTime,
      timezone,
      googleSheetsUrl,
      googleDriveFolderUrl,
      primaryColor,
    });
    setSavedNotice("Tournament details saved successfully.");
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleContinueTournament = async (tId: string) => {
    const result = await switchLeague(tId, false);
    if (result.success) {
      setViewMode("configure");
    }
  };

  const handleCreateNewTournamentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTourneyName.trim()) {
      setCreateTourneyError("Tournament name is required.");
      return;
    }

    setIsCreatingTourney(true);
    setCreateTourneyError(null);

    try {
      await createNewTournament({
        name: newTourneyName.trim(),
        edition: newTourneyEdition.trim() || "Season 2",
        description: newTourneyDesc.trim(),
        logoUrl: newTourneyLogoUrl.trim(),
        minSquadSize: Number(newTourneyMinSquad) || 8,
        maxSquadSize: Number(newTourneyMaxSquad) || 8,
        totalPurse: Number(newTourneyPurse) || 100000,
        defaultBasePrice: Number(newTourneyBasePrice) || 2000,
        primaryColor: newTourneyPrimaryColor || "#059669",
        secondaryColor: newTourneySecondaryColor || "#38bdf8",
      });

      // Reset form
      setNewTourneyName("");
      setNewTourneyDesc("");
      setNewTourneyLogoUrl("");
      setSavedNotice(`Created tournament "${newTourneyName.trim()}" starting completely blank.`);
      setTimeout(() => setSavedNotice(null), 4000);
      setViewMode("configure");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCreateTourneyError(msg);
    } finally {
      setIsCreatingTourney(false);
    }
  };

  const handleTestConnection = async () => {
    if (!googleSheetsUrl.trim()) {
      setConnectionError("Please provide a Google Sheets URL before testing.");
      return;
    }
    setTestingConnection(true);
    setConnectionError(null);
    setValidationResult(null);

    try {
      const res = await fetch("/api/datasource/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleSheetsUrl: googleSheetsUrl.trim(),
          googleDriveFolderUrl: googleDriveFolderUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      setValidationResult(data);
      if (!data.valid) {
        setConnectionError(data.error || "Data source validation failed.");
      }
    } catch (err: unknown) {
      setConnectionError(err instanceof Error ? err.message : "Network error testing connection.");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRefreshRegistration = async () => {
    if (
      !confirm(
        "Are you sure you want to refresh registration data from Google Sheets? Existing un-auctioned rosters and team affiliations will be synchronized."
      )
    ) {
      return;
    }
    setRefreshingData(true);
    setRefreshNotice(null);
    setRefreshError(null);

    try {
      const res = await fetch("/api/datasource/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: activeLeague.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errorCode === "AUCTION_ACTIVE") {
          setRefreshError(
            "Active Auction Guard: Data refresh is disabled while an auction is IN_PROGRESS, PAUSED, or FINISHED to protect active bids and sold player history."
          );
        } else {
          setRefreshError(data.error || "Failed to refresh registration data.");
        }
        return;
      }
      setRefreshNotice(
        `Successfully refreshed: ${data.playersCount} players, ${data.teamsCount} teams synchronized from Google Sheets.`
      );
    } catch (err: unknown) {
      setRefreshError(err instanceof Error ? err.message : "Failed to communicate with refresh API.");
    } finally {
      setRefreshingData(false);
    }
  };

  const formatStatusBadge = (status: AuctionStatus = "IDLE") => {
    switch (status) {
      case "IN_PROGRESS":
        return (
          <Badge className="bg-amber-500 text-white font-bold text-[10px] uppercase animate-pulse">
            In Progress
          </Badge>
        );
      case "PAUSED":
        return (
          <Badge className="bg-yellow-500 text-white font-bold text-[10px] uppercase">
            Paused
          </Badge>
        );
      case "FINISHED":
        return (
          <Badge className="bg-emerald-600 text-white font-bold text-[10px] uppercase">
            Completed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-slate-300">
            Idle / Ready
          </Badge>
        );
    }
  };

  // Compile list of tournaments for selection screen
  const availableTournaments: TournamentSummary[] =
    tournaments.length > 0
      ? tournaments
      : [
          {
            id: activeLeague.id,
            name: activeLeague.name,
            season: activeLeague.edition || "Season 1",
            edition: activeLeague.edition || "Season 1",
            description: activeLeague.description,
            logoUrl: activeLeague.logoUrl,
            status: activeLeague.status || "IDLE",
            teamsCount: currentTeams.length,
            playersCount: currentPlayers.length,
            totalPurse: 100000,
            minSquadSize: 8,
            maxSquadSize: 8,
            defaultBasePrice: 2000,
            teams: currentTeams.map((t) => ({
              id: t.id,
              name: t.name,
              shortCode: t.shortCode,
              logoUrl: t.logoUrl,
              primaryColor: t.primaryColor,
            })),
          },
        ];

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title={
            viewMode === "select"
              ? "Tournament Selection Hub"
              : viewMode === "create"
              ? "Create Brand-New Tournament"
              : "Tournament Configuration"
          }
          subtitle={
            viewMode === "select"
              ? "Continue an existing tournament with its roster and bids, or launch a completely blank tournament"
              : viewMode === "create"
              ? "Starts 100% clean with 0 players, 0 teams, 0 bids, and zero inherited records"
              : `Configuring ${activeLeague.name} (${activeLeague.edition || "Season 1"})`
          }
          action={
            viewMode === "select" ? (
              <Button
                type="button"
                onClick={() => setViewMode("create")}
                size="sm"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Create New Tournament
              </Button>
            ) : viewMode === "create" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewMode("select")}
                className="gap-2 border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-medium text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Selection
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewMode("select")}
                className="gap-2 border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-medium text-xs shadow-sm"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                Switch Tournament
              </Button>
            )
          }
        />

        <main className="p-6 sm:p-8 space-y-6 max-w-6xl">
          {savedNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {savedNotice}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW MODE 1: TOURNAMENT SELECTION SCREEN (OPTION 1 & OPTION 2)           */}
          {/* ========================================================================= */}
          {viewMode === "select" && (
            <div className="space-y-8">
              {/* Option 2 Quick Callout Card */}
              <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-emerald-800/40">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Option 2: Blank Slate Tournament
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                    Want to start a new season or independent tournament?
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Create a completely new tournament starting with <strong className="text-white">0 players, 0 teams, 0 bids, and 0 purchases</strong>. Existing tournaments, bids, and sold records are strictly isolated and 100% preserved.
                  </p>
                </div>
                <Button
                  onClick={() => setViewMode("create")}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl shrink-0 shadow-lg gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Launch New Tournament
                </Button>
              </div>

              {/* Option 1: Continue Existing Tournament */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-emerald-600" />
                      Option 1: Continue an Existing Tournament
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select a tournament below to restore its full roster, team purses, bids, and live auction state.
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-white border-slate-300 text-slate-700 text-xs font-semibold">
                    {availableTournaments.length} {availableTournaments.length === 1 ? "Tournament" : "Tournaments"} Available
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {availableTournaments.map((t) => {
                    const isActive = t.id === activeLeague.id;

                    return (
                      <Card
                        key={t.id}
                        className={`rounded-2xl border transition-all overflow-hidden ${
                          isActive
                            ? "border-emerald-500 bg-white shadow-md ring-2 ring-emerald-500/20"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                        }`}
                      >
                        <CardContent className="p-6 space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3.5">
                              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                {t.logoUrl ? (
                                  <img
                                    src={t.logoUrl}
                                    alt={t.name}
                                    className="w-full h-full object-contain p-1"
                                  />
                                ) : (
                                  <Trophy className="w-6 h-6 text-emerald-600" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-slate-900">{t.name}</h4>
                                  {isActive && (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-semibold bg-slate-50 text-slate-600 border-slate-200 py-0"
                                  >
                                    {t.edition || t.season || "Season 1"}
                                  </Badge>
                                  {formatStatusBadge(t.status)}
                                </div>
                              </div>
                            </div>
                          </div>

                          {t.description && (
                            <p className="text-xs text-slate-600 line-clamp-2">{t.description}</p>
                          )}

                          {/* Core Metrics Grid */}
                          <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                            <div>
                              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1">
                                <Users className="w-3 h-3 text-slate-400" />
                                Teams
                              </div>
                              <div className="text-sm font-bold text-slate-900 mt-0.5">
                                {t.teamsCount || (isActive ? currentTeams.length : 0)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1">
                                <Users className="w-3 h-3 text-slate-400" />
                                Players
                              </div>
                              <div className="text-sm font-bold text-slate-900 mt-0.5">
                                {t.playersCount || (isActive ? currentPlayers.length : 0)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1">
                                <Coins className="w-3 h-3 text-slate-400" />
                                Purse
                              </div>
                              <div className="text-sm font-bold text-emerald-700 mt-0.5">
                                ₹{((t.totalPurse || 100000) / 1000).toFixed(0)}k
                              </div>
                            </div>
                          </div>

                          {/* Team Badges preview */}
                          {t.teams && t.teams.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                                Registered Franchises ({t.teams.length})
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {t.teams.map((tm) => (
                                  <span
                                    key={tm.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700"
                                  >
                                    {tm.logoUrl && (
                                      <img
                                        src={tm.logoUrl}
                                        alt=""
                                        className="w-3.5 h-3.5 rounded-full object-cover"
                                      />
                                    )}
                                    {tm.shortCode || tm.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <div className="text-[11px] text-slate-500">
                              Base: <strong className="text-slate-800">₹{(t.defaultBasePrice || 2000).toLocaleString("en-IN")}</strong> | Squad: <strong className="text-slate-800">{t.minSquadSize || 8}-{t.maxSquadSize || 8}</strong>
                            </div>

                            <Button
                              onClick={() => handleContinueTournament(t.id)}
                              size="sm"
                              className={`gap-1.5 text-xs font-bold rounded-lg shadow-sm ${
                                isActive
                                  ? "bg-slate-900 hover:bg-slate-800 text-white"
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
                              }`}
                            >
                              Continue Tournament
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW MODE 2: CREATE BRAND-NEW TOURNAMENT (OPTION 2)                       */}
          {/* ========================================================================= */}
          {viewMode === "create" && (
            <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    Option 2: Clean Slate Creator
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    Create Brand-New Tournament
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    This tournament starts completely blank. Zero players, zero teams, zero bids, zero preloaded records.
                  </p>
                </div>

                {createTourneyError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{createTourneyError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateNewTournamentSubmit} className="space-y-6">
                  {/* Basic Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        Tournament Name * <span className="text-red-500">(Required)</span>
                      </label>
                      <Input
                        value={newTourneyName}
                        onChange={(e) => setNewTourneyName(e.target.value)}
                        placeholder="e.g. Nalanda Turf League – Season 2"
                        required
                        className="bg-white border-slate-300 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        Season / Edition
                      </label>
                      <Input
                        value={newTourneyEdition}
                        onChange={(e) => setNewTourneyEdition(e.target.value)}
                        placeholder="e.g. Season 2 or 2026"
                        className="bg-white border-slate-300 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Description / Notes</label>
                    <Input
                      value={newTourneyDesc}
                      onChange={(e) => setNewTourneyDesc(e.target.value)}
                      placeholder="Brief notes or summary for this championship edition..."
                      className="bg-white border-slate-300 text-xs"
                    />
                  </div>

                  {/* Logo Upload / URL */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Tournament Logo (Optional)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                        {newTourneyLogoUrl ? (
                          <img
                            src={newTourneyLogoUrl}
                            alt="Logo"
                            className="w-full h-full object-contain p-0.5"
                          />
                        ) : (
                          <Trophy className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <label className="cursor-pointer inline-block">
                          <span className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 shadow-sm">
                            <Upload className="w-3 h-3 text-slate-500" />
                            {isUploadingNewTourneyLogo ? "Uploading..." : "Upload Logo to Drive"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploadingNewTourneyLogo}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleUploadDriveMedia(
                                  file,
                                  setNewTourneyLogoUrl,
                                  setIsUploadingNewTourneyLogo
                                );
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                        <Input
                          value={newTourneyLogoUrl}
                          onChange={(e) => setNewTourneyLogoUrl(e.target.value)}
                          placeholder="or paste direct image URL"
                          className="bg-white border-slate-300 font-mono text-[11px] h-7"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Squad Rules & Purse Configuration */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Total Team Purse (₹)</label>
                      <Input
                        type="number"
                        value={newTourneyPurse}
                        onChange={(e) => setNewTourneyPurse(Number(e.target.value))}
                        className="bg-white border-slate-300 text-xs font-mono"
                        min={1000}
                        step={1000}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Default Base Price (₹)</label>
                      <Input
                        type="number"
                        value={newTourneyBasePrice}
                        onChange={(e) => setNewTourneyBasePrice(Number(e.target.value))}
                        className="bg-white border-slate-300 text-xs font-mono"
                        min={100}
                        step={500}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Min Squad Size</label>
                      <Input
                        type="number"
                        value={newTourneyMinSquad}
                        onChange={(e) => setNewTourneyMinSquad(Number(e.target.value))}
                        className="bg-white border-slate-300 text-xs font-mono"
                        min={1}
                        max={30}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Max Squad Size</label>
                      <Input
                        type="number"
                        value={newTourneyMaxSquad}
                        onChange={(e) => setNewTourneyMaxSquad(Number(e.target.value))}
                        className="bg-white border-slate-300 text-xs font-mono"
                        min={1}
                        max={30}
                      />
                    </div>
                  </div>

                  {/* Branding Colors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Primary Brand Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={newTourneyPrimaryColor}
                          onChange={(e) => setNewTourneyPrimaryColor(e.target.value)}
                          className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                        />
                        <Input
                          value={newTourneyPrimaryColor}
                          onChange={(e) => setNewTourneyPrimaryColor(e.target.value)}
                          className="bg-white border-slate-300 font-mono text-xs uppercase"
                          maxLength={7}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Secondary Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={newTourneySecondaryColor}
                          onChange={(e) => setNewTourneySecondaryColor(e.target.value)}
                          className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                        />
                        <Input
                          value={newTourneySecondaryColor}
                          onChange={(e) => setNewTourneySecondaryColor(e.target.value)}
                          className="bg-white border-slate-300 font-mono text-xs uppercase"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clean Slate Assurance Notice */}
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Clean Slate Guarantee
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      This new tournament will be created with <strong>0 teams, 0 players, 0 bids, and an IDLE auction state</strong>. No teams or player photos will be copied over from any past tournaments.
                    </p>
                  </div>

                  {/* Submit Actions */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setViewMode("select")}
                      className="border-slate-300 text-slate-700 text-xs font-medium"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isCreatingTourney || !newTourneyName.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-2 shadow-sm gap-2"
                    >
                      {isCreatingTourney ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Initializing Blank Tournament...
                        </>
                      ) : (
                        <>
                          Create & Configure
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ========================================================================= */}
          {/* VIEW MODE 3: CONFIGURE ACTIVE TOURNAMENT                                  */}
          {/* ========================================================================= */}
          {viewMode === "configure" && (
            <div className="space-y-6">
              {/* Active Tournament Banner with Switch Option */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Active Tournament:
                      </span>
                      <h2 className="text-sm font-bold text-slate-900">{activeLeague.name}</h2>
                      {activeLeague.edition && (
                        <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200">
                          {activeLeague.edition}
                        </Badge>
                      )}
                      {formatStatusBadge(activeLeague.status)}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {currentTeams.length} teams · {currentPlayers.length} registered players
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode("select")}
                  className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  Switch Tournament
                </Button>
              </div>

              {/* Stepper Guide Banner */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Tournament Setup Workflow
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                        1
                      </span>
                      Details & Venue
                    </div>
                    <p className="text-[11px] text-emerald-700 mt-1">Configuring active tournament</p>
                  </div>

                  <Link
                    href="/admin/teams"
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">
                        2
                      </span>
                      Add Teams
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Upload logos & owners</p>
                  </Link>

                  <Link
                    href="/admin/players"
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">
                        3
                      </span>
                      Import Rosters
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Sheets / Excel mapping</p>
                  </Link>

                  <Link
                    href="/admin/settings"
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">
                        4
                      </span>
                      Auction Slabs
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Set prices & timers</p>
                  </Link>
                </div>
              </div>

              {/* Tournament Configuration Form */}
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                  <CardContent className="p-6 space-y-5">
                    <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-emerald-600" />
                      Tournament Identity
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Tournament Name *</label>
                        <Input
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                          }}
                          required
                          placeholder="e.g. Premier Cricket Championship"
                          className="bg-white border-slate-300 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">URL Slug</label>
                        <Input
                          value={slug}
                          onChange={(e) => setSlug(e.target.value)}
                          placeholder="e.g. premier-cricket-championship"
                          className="bg-slate-50 border-slate-300 font-mono text-xs text-slate-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Description</label>
                        <Input
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Short summary of tournament edition, rules, and background..."
                          className="bg-white border-slate-300 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Primary Brand Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                          />
                          <Input
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="bg-white border-slate-300 font-mono text-xs uppercase"
                            maxLength={7}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tournament Logo & Organization Logos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <label className="text-xs font-semibold text-slate-700 block">Tournament Logo</label>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt="Logo"
                                className="w-full h-full object-contain p-0.5"
                              />
                            ) : (
                              <Trophy className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <label className="cursor-pointer inline-block">
                              <span className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 shadow-sm">
                                <Upload className="w-3 h-3 text-slate-500" />
                                {isUploadingLogo ? "Uploading..." : "Upload Logo"}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                disabled={isUploadingLogo}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadDriveMedia(file, setLogoUrl, setIsUploadingLogo);
                                }}
                                className="hidden"
                              />
                            </label>
                            <Input
                              value={logoUrl}
                              onChange={(e) => setLogoUrl(e.target.value)}
                              placeholder="or paste image URL"
                              className="bg-white border-slate-300 font-mono text-[11px] h-7"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <label className="text-xs font-semibold text-slate-700 block">Organization / Club</label>
                        <Input
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          placeholder="e.g. Sports Club / Host Body"
                          className="bg-white border-slate-300 text-xs h-7 mb-1.5"
                        />
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                            {orgLogoUrl ? (
                              <img
                                src={orgLogoUrl}
                                alt="Org"
                                className="w-full h-full object-contain p-0.5"
                              />
                            ) : (
                              <ShieldCheck className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <label className="cursor-pointer inline-block">
                              <span className="px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[10px] font-semibold text-slate-700 inline-flex items-center gap-1">
                                <Upload className="w-2.5 h-2.5 text-slate-500" />
                                {isUploadingOrgLogo ? "Uploading..." : "Upload Org Logo"}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                disabled={isUploadingOrgLogo}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadDriveMedia(file, setOrgLogoUrl, setIsUploadingOrgLogo);
                                }}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                  <CardContent className="p-6 space-y-5">
                    <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      Schedule & Venue
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Match Venue *</label>
                        <Input
                          value={matchVenue}
                          onChange={(e) => setMatchVenue(e.target.value)}
                          required
                          placeholder="e.g. Sports Arena, Main Stadium"
                          className="bg-white border-slate-300 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Match Date</label>
                        <Input
                          type="date"
                          value={matchDate}
                          onChange={(e) => setMatchDate(e.target.value)}
                          className="bg-white border-slate-300 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Auction Date</label>
                        <Input
                          type="date"
                          value={auctionDate}
                          onChange={(e) => setAuctionDate(e.target.value)}
                          className="bg-white border-slate-300 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Auction Start Time</label>
                        <Input
                          type="time"
                          value={auctionTime}
                          onChange={(e) => setAuctionTime(e.target.value)}
                          className="bg-white border-slate-300 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Timezone</label>
                        <Input
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          placeholder="Asia/Kolkata"
                          className="bg-white border-slate-300 text-xs"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                  <CardContent className="p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Database className="w-4 h-4 text-emerald-600" />
                          Data Sources Configuration
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Configure dynamic Google Sheets and Google Drive resources for this tournament.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleTestConnection}
                          disabled={testingConnection || !googleSheetsUrl.trim()}
                          className="gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                        >
                          {testingConnection ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Test Connection
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowImportModal(true)}
                          className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          Import / Preview Data
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleRefreshRegistration}
                          disabled={refreshingData}
                          className="gap-1.5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold"
                        >
                          {refreshingData ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              Refreshing...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-3.5 h-3.5" />
                              Refresh Roster
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Connection Error or Notice */}
                    {connectionError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-bold">Connection Check Failed: </span>
                          {connectionError}
                        </div>
                      </div>
                    )}

                    {refreshNotice && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>{refreshNotice}</div>
                      </div>
                    )}

                    {refreshError && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>{refreshError}</div>
                      </div>
                    )}

                    {/* Validation Diagnostic Panel */}
                    {validationResult && validationResult.valid && (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          Data Source Diagnostic Results
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                            <div className="font-semibold text-slate-800 flex items-center justify-between">
                              <span>Google Sheets:</span>
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-[10px]"
                              >
                                Connected
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              Active Tab:{" "}
                              <span className="font-semibold text-slate-800">
                                {validationResult.sheet?.activeSheetTitle || "Sheet 1"}
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-600">
                              Rows:{" "}
                              <span className="font-mono font-semibold">
                                {validationResult.sheet?.rowCount ?? 0}
                              </span>{" "}
                              | Columns:{" "}
                              <span className="font-mono font-semibold">
                                {validationResult.sheet?.columnCount ?? 0}
                              </span>
                            </p>
                          </div>

                          <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                            <div className="font-semibold text-slate-800 flex items-center justify-between">
                              <span>Google Drive Folder:</span>
                              {validationResult.drive?.accessible ? (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-[10px]"
                                >
                                  Connected
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-slate-100 text-slate-600 border-slate-300 font-bold text-[10px]"
                                >
                                  Optional / None
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600">
                              Photos Found:{" "}
                              <span className="font-mono font-semibold">
                                {validationResult.drive?.filesCount ?? 0}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">
                          Google Sheets Registration URL * <span className="text-red-500">(Required)</span>
                        </label>
                        <Input
                          value={googleSheetsUrl}
                          onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className="bg-white border-slate-300 font-mono text-xs"
                          required
                        />
                        <p className="text-[11px] text-slate-500">
                          Google Sheet containing player registrations and team rosters for this tournament.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                          Google Drive Photographs Folder URL{" "}
                          <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <Input
                          value={googleDriveFolderUrl}
                          onChange={(e) => setGoogleDriveFolderUrl(e.target.value)}
                          placeholder="https://drive.google.com/drive/folders/..."
                          className="bg-white border-slate-300 font-mono text-xs"
                        />
                        <p className="text-[11px] text-slate-500">
                          Google Drive folder containing player/team photos matched by filename.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center justify-between pt-2">
                  <Link
                    href="/admin/teams"
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium inline-flex items-center gap-1.5"
                  >
                    Proceed to Teams
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <div className="flex items-center gap-3">
                    <Button
                      type="submit"
                      className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-6 py-2 shadow-sm"
                    >
                      Save Changes
                    </Button>
                    <Button
                      asChild
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-6 py-2 shadow-sm"
                    >
                      <Link href="/admin/teams">
                        Save & Proceed to Teams
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* Dynamic Import & Preview Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        defaultSheetUrl={googleSheetsUrl}
        defaultDriveUrl={googleDriveFolderUrl}
        defaultBasePrice={activeLeague.defaultBasePrice || 2000}
        activeLeagueId={activeLeague.id}
      />
    </div>
  );
}
