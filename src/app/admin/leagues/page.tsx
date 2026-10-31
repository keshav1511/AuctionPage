"use client";

import { useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLeague } from "@/lib/context/league-context";
import { BrandingPalette } from "@/types";
import {
  Trophy,
  Plus,
  CheckCircle2,
  Calendar,
  MapPin,
  Sparkles,
  Layers,
  Palette,
} from "lucide-react";

export default function AdminLeaguesPage() {
  const { activeLeague, leagues, switchLeague, createLeague, updateLeaguePalette } =
    useLeague();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [extractingPalette, setExtractingPalette] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form state for creating a new league
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState(
    "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&auto=format&fit=crop&q=80"
  );
  const [matchDate, setMatchDate] = useState("2026-11-25");
  const [matchVenue, setMatchVenue] = useState("Perfect Pass, Falnir");
  const [auctionDate, setAuctionDate] = useState("2026-11-10");
  const [auctionTime, setAuctionTime] = useState("18:30");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState(
    "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
  );
  const [googleDriveFolderUrl, setGoogleDriveFolderUrl] = useState(
    "https://drive.google.com/drive/folders/1MtjUStUIqnlQic13-sfML_NbPygEkSwpUsgDe7b3hHJ1GGKbP7xvSHx3MI11kTS7CgVaT2hA"
  );
  const [primaryColor, setPrimaryColor] = useState("#059669");

  // Manual Palette Override state for active league
  const [customPalette, setCustomPalette] = useState<BrandingPalette>(
    activeLeague.brandingPalette || {
      primary: activeLeague.primaryColor,
      secondary: activeLeague.secondaryColor,
      accent: "#10B981",
      background: "#090D10",
      card: "#11161B",
      border: "#1E293B",
      text: "#F8FAFC",
    }
  );

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    );
  };

  const handleExtractPaletteFromLogo = async () => {
    setExtractingPalette(true);
    try {
      const res = await fetch("/api/branding/extract-palette", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl, primaryColor }),
      });
      const data = await res.json();
      if (data.success && data.palette) {
        setPrimaryColor(data.dominantHex);
        setCustomPalette(data.palette);
        setSuccessNotice("Extracted dominant logo color and generated sports palette!");
      }
    } catch {
      setSuccessNotice("Generated sports palette from primary brand color.");
    } finally {
      setExtractingPalette(false);
      setTimeout(() => setSuccessNotice(null), 3500);
    }
  };

  const handleCreateLeague = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createLeague({
      name,
      slug: slug || "custom-league",
      description,
      logoUrl,
      matchDate,
      matchVenue,
      auctionDate,
      auctionTime,
      timezone,
      googleSheetsUrl,
      googleDriveFolderUrl,
      primaryColor,
      secondaryColor: customPalette.secondary,
      brandingPalette: customPalette,
    });

    setShowCreateModal(false);
    setSuccessNotice(`League "${name}" created successfully and set to active!`);
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  const handleApplyPaletteOverride = () => {
    updateLeaguePalette(activeLeague.id, customPalette);
    setSuccessNotice(`Branding overrides applied to "${activeLeague.name}"!`);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#070A0D] flex text-slate-100">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Multi-League & Branding Desk"
          subtitle="Configure multiple tournament editions, venues, Google Drive folders, and dynamic colors"
          action={
            <Button
              onClick={() => setShowCreateModal(true)}
              variant="gold"
              size="sm"
              className="gap-2 font-bold text-black"
            >
              <Plus className="w-4 h-4 fill-black" /> Create New League
            </Button>
          }
        />

        <main className="p-8 space-y-8 flex-1 overflow-y-auto max-w-7xl">
          {successNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {successNotice}
            </div>
          )}

          {/* Active League Highlight Banner */}
          <div className="rounded-2xl border-2 border-slate-800 bg-charcoal-900 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-4 z-10">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-xl border border-white/20"
                style={{ backgroundColor: activeLeague.primaryColor }}
              >
                {activeLeague.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-bold text-amber-400 tracking-wider">
                    ACTIVE TOURNAMENT
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {activeLeague.slug}
                  </Badge>
                </div>
                <h2 className="text-2xl font-black text-white">{activeLeague.name}</h2>
                <p className="text-xs text-slate-400 flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" /> {activeLeague.matchVenue}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" /> Auction: {activeLeague.auctionDate} ({activeLeague.auctionTime})
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 z-10">
              <span className="text-xs text-slate-400">Branding Palette:</span>
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-charcoal-950 border border-slate-800">
                <span
                  className="w-5 h-5 rounded-md border border-white/20"
                  style={{ backgroundColor: activeLeague.brandingPalette?.primary || activeLeague.primaryColor }}
                  title="Primary"
                />
                <span
                  className="w-5 h-5 rounded-md border border-white/20"
                  style={{ backgroundColor: activeLeague.brandingPalette?.secondary || "#F59E0B" }}
                  title="Secondary Gold"
                />
                <span
                  className="w-5 h-5 rounded-md border border-white/20"
                  style={{ backgroundColor: activeLeague.brandingPalette?.accent || "#10B981" }}
                  title="Accent"
                />
                <span
                  className="w-5 h-5 rounded-md border border-white/20"
                  style={{ backgroundColor: activeLeague.brandingPalette?.card || "#11161B" }}
                  title="Card Canvas"
                />
              </div>
            </div>
          </div>

          {/* Configured Leagues Catalog Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black uppercase text-white tracking-wide flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" /> Configured Leagues & Tournaments ({leagues.length})
              </h3>
              <span className="text-xs text-slate-400">Click any card to switch active tournament</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {leagues.map((league) => {
                const isActive = league.id === activeLeague.id;

                return (
                  <Card
                    key={league.id}
                    className={`border-2 transition-all cursor-pointer ${
                      isActive
                        ? "border-emerald-500 bg-charcoal-900 shadow-xl shadow-emerald-950/40"
                        : "border-slate-800 bg-charcoal-900/60 hover:border-slate-700"
                    }`}
                    onClick={() => switchLeague(league.id)}
                  >
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg"
                            style={{ backgroundColor: league.primaryColor }}
                          >
                            {league.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-base">{league.name}</h4>
                            <p className="text-xs text-slate-400">{league.description}</p>
                          </div>
                        </div>

                        {isActive ? (
                          <Badge variant="default" className="text-xs bg-emerald-600">
                            Active
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              switchLeague(league.id);
                            }}
                          >
                            Switch to This
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-800">
                        <div>
                          <span className="text-slate-500 uppercase text-[10px] block">Venue</span>
                          <span className="text-slate-300 font-medium">{league.matchVenue || "TBD"}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 uppercase text-[10px] block">Auction Date</span>
                          <span className="text-slate-300 font-medium font-mono">
                            {league.auctionDate || "TBD"} @ {league.auctionTime || "TBD"}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 text-[11px] text-slate-500 truncate flex items-center gap-2">
                        <span>Drive Folder:</span>
                        <span className="font-mono text-slate-400 truncate">
                          {league.googleDriveFolderUrl || "None"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Dynamic Branding & Color Override Studio */}
          <Card className="border-slate-800 bg-charcoal-900">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Palette className="w-5 h-5 text-amber-400" />
                    Tournament Branding Studio ({activeLeague.name})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Fine-tune the sports palette or extract dominant colors from the tournament logo
                  </p>
                </div>

                <Button
                  onClick={handleExtractPaletteFromLogo}
                  disabled={extractingPalette}
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  {extractingPalette ? "Extracting..." : "Auto-Extract from Logo"}
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Primary Brand</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customPalette.primary}
                      onChange={(e) =>
                        setCustomPalette({ ...customPalette, primary: e.target.value })
                      }
                      className="w-9 h-9 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <Input
                      value={customPalette.primary}
                      onChange={(e) =>
                        setCustomPalette({ ...customPalette, primary: e.target.value })
                      }
                      className="h-9 font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Secondary Gold</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customPalette.secondary}
                      onChange={(e) =>
                        setCustomPalette({ ...customPalette, secondary: e.target.value })
                      }
                      className="w-9 h-9 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <Input
                      value={customPalette.secondary}
                      onChange={(e) =>
                        setCustomPalette({ ...customPalette, secondary: e.target.value })
                      }
                      className="h-9 font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Accent Tone</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customPalette.accent}
                      onChange={(e) =>
                        setCustomPalette({ ...customPalette, accent: e.target.value })
                      }
                      className="w-9 h-9 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <Input
                      value={customPalette.accent}
                      onChange={(e) =>
                        setCustomPalette({ ...customPalette, accent: e.target.value })
                      }
                      className="h-9 font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Stadium Canvas</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customPalette.background}
                      onChange={(e) =>
                        setCustomPalette({ ...customPalette, background: e.target.value })
                      }
                      className="w-9 h-9 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <Input
                      value={customPalette.background}
                      onChange={(e) =>
                        setCustomPalette({ ...customPalette, background: e.target.value })
                      }
                      className="h-9 font-mono text-xs uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleApplyPaletteOverride} variant="gold" size="sm" className="font-bold text-black">
                  Save & Apply Branding
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Creation Modal */}
          {showCreateModal && (
            <div className="p-6 rounded-2xl border-2 border-emerald-500/50 bg-charcoal-900 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Create New Tournament League
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateLeague} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">League Name *</label>
                    <Input
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g. Mangalore Turf Premier League"
                      required
                      className="bg-charcoal-950 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Slug</label>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="e.g. mangalore-turf-premier-league"
                      required
                      className="bg-charcoal-950 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Description</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short summary of tournament format and location..."
                    className="bg-charcoal-950 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Logo Image URL</label>
                    <Input
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://... logo image url"
                      className="bg-charcoal-950 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Timezone</label>
                    <Input
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="Asia/Kolkata"
                      className="bg-charcoal-950 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Match Venue *</label>
                    <Input
                      value={matchVenue}
                      onChange={(e) => setMatchVenue(e.target.value)}
                      placeholder="e.g. Perfect Pass, Falnir"
                      required
                      className="bg-charcoal-950 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Match Date</label>
                    <Input
                      type="date"
                      value={matchDate}
                      onChange={(e) => setMatchDate(e.target.value)}
                      className="bg-charcoal-950 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Auction Date & Time</label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={auctionDate}
                        onChange={(e) => setAuctionDate(e.target.value)}
                        className="bg-charcoal-950 text-xs"
                      />
                      <Input
                        type="time"
                        value={auctionTime}
                        onChange={(e) => setAuctionTime(e.target.value)}
                        className="bg-charcoal-950 text-xs w-24"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Google Sheets URL</label>
                    <Input
                      value={googleSheetsUrl}
                      onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="bg-charcoal-950 font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Google Drive Photographs Folder URL</label>
                    <Input
                      value={googleDriveFolderUrl}
                      onChange={(e) => setGoogleDriveFolderUrl(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/..."
                      className="bg-charcoal-950 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="gold" size="sm" className="font-bold text-black">
                    Save and Initialize Tournament
                  </Button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
