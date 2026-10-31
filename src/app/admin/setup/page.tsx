"use client";

import { useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLeague } from "@/lib/context/league-context";
import { Trophy, CheckCircle2, Calendar, Upload, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function TournamentSetupPage() {
  const { activeLeague, leagues, switchLeague, createLeague, updateLeague } = useLeague();

  const [name, setName] = useState(activeLeague.name);
  const [slug, setSlug] = useState(activeLeague.slug);
  const [description, setDescription] = useState(activeLeague.description || "");
  const [logoUrl, setLogoUrl] = useState(activeLeague.logoUrl || "");
  const [matchDate, setMatchDate] = useState(activeLeague.matchDate || "2026-11-20");
  const [matchVenue, setMatchVenue] = useState(activeLeague.matchVenue || "Perfect Pass, Falnir");
  const [auctionDate, setAuctionDate] = useState(activeLeague.auctionDate || "2026-11-05");
  const [auctionTime, setAuctionTime] = useState(activeLeague.auctionTime || "18:00");
  const [timezone, setTimezone] = useState(activeLeague.timezone || "Asia/Kolkata");
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState(
    activeLeague.googleSheetsUrl || "https://docs.google.com/spreadsheets/d/1uC87Sn8KLbAHs9g1ZT63AIyIY85C7LVh-cZF8dvvgo0/edit?usp=sharing"
  );
  const [googleDriveFolderUrl, setGoogleDriveFolderUrl] = useState(
    activeLeague.googleDriveFolderUrl || "https://drive.google.com/drive/folders/1MtjUStUIqnlQic13-sfML_NbPygEkSwpUsgDe7b3hHJ1GGKbP7xvSHx3MI11kTS7CgVaT2hA"
  );
  const [primaryColor, setPrimaryColor] = useState(activeLeague.primaryColor || "#059669");

  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [showNewLeagueModal, setShowNewLeagueModal] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");

  // Handle local logo file upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateLeague(activeLeague.id, {
      name,
      slug,
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
    });
    setSavedNotice("Tournament details saved successfully.");
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleCreateNewTournament = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeagueName.trim()) return;

    const created = createLeague({
      name: newLeagueName,
      slug: newLeagueName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description: "Custom tournament championship",
      logoUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&auto=format&fit=crop&q=80",
      matchDate: "2026-12-01",
      matchVenue: "City Arena",
      auctionDate: "2026-11-20",
      auctionTime: "18:00",
      timezone: "Asia/Kolkata",
      googleSheetsUrl: "https://docs.google.com/spreadsheets/d/1uC87Sn8KLbAHs9g1ZT63AIyIY85C7LVh-cZF8dvvgo0/edit?usp=sharing",
      googleDriveFolderUrl: "https://drive.google.com/drive/folders/1MtjUStUIqnlQic13-sfML_NbPygEkSwpUsgDe7b3hHJ1GGKbP7xvSHx3MI11kTS7CgVaT2hA",
      primaryColor: "#2563EB",
      secondaryColor: "#F59E0B",
    });

    setName(created.name);
    setSlug(created.slug);
    setShowNewLeagueModal(false);
    setNewLeagueName("");
    setSavedNotice(`Created tournament "${created.name}" and switched to it.`);
    setTimeout(() => setSavedNotice(null), 3500);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Tournament Setup"
          subtitle="Configure tournament identity, dates, venue, and linked Google Drive/Sheets resources"
          action={
            <Button
              type="button"
              onClick={() => setShowNewLeagueModal(true)}
              size="sm"
              variant="outline"
              className="gap-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              New Tournament
            </Button>
          }
        />

        <main className="p-6 sm:p-8 space-y-6 max-w-5xl">
          {savedNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {savedNotice}
            </div>
          )}

          {/* Stepper Guide Banner */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Tournament Setup Workflow
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">1</span>
                  Details & Venue
                </div>
                <p className="text-[11px] text-emerald-700 mt-1">Configuring active tournament</p>
              </div>

              <Link href="/admin/teams" className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">2</span>
                  Add Teams
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Upload logos & owners</p>
              </Link>

              <Link href="/admin/players" className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">3</span>
                  Import Rosters
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Sheets / Excel mapping</p>
              </Link>

              <Link href="/admin/settings" className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">4</span>
                  Auction Slabs
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Set prices & timers</p>
              </Link>
            </div>
          </div>

          {/* Tournament Form */}
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
                      placeholder="e.g. Nalanda Turf League"
                      className="bg-white border-slate-300 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">URL Slug</label>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="e.g. nalanda-turf-league"
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

                {/* Tournament Logo Upload & Preview */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-semibold text-slate-700">Tournament Logo</label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <Trophy className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2 w-full">
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer">
                          <span className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 shadow-sm">
                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                            Upload from Computer
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                        </label>
                        <span className="text-xs text-slate-400">or enter image URL below</span>
                      </div>
                      <Input
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://... logo image url"
                        className="bg-white border-slate-300 font-mono text-xs"
                      />
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
                      placeholder="e.g. Perfect Pass, Falnir"
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
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  Linked External Resources
                </h3>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Google Sheets Registration URL</label>
                    <Input
                      value={googleSheetsUrl}
                      onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="bg-white border-slate-300 font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      The default reference spreadsheet contains players, icon players, and team owners.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Google Drive Photographs Folder URL</label>
                    <Input
                      value={googleDriveFolderUrl}
                      onChange={(e) => setGoogleDriveFolderUrl(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/..."
                      className="bg-white border-slate-300 font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      Folder containing player, owner, and icon player photos matched during data sync.
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
                Skip to Teams
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

          {/* Other Tournaments Switcher Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Registered Tournaments ({leagues.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {leagues.map((l) => (
                <div
                  key={l.id}
                  className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
                    l.id === activeLeague.id
                      ? "border-emerald-600 bg-emerald-50/50"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{l.name}</h4>
                    <p className="text-[11px] text-slate-500">{l.matchVenue || "Venue TBD"}</p>
                  </div>
                  {l.id === activeLeague.id ? (
                    <Badge variant="outline" className="bg-emerald-600 text-white font-bold text-[10px] border-emerald-600">
                      Active
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => switchLeague(l.id)}
                      className="text-xs font-medium border-slate-300 text-slate-700 bg-white"
                    >
                      Switch
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* New Tournament Modal */}
      {showNewLeagueModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Create New Tournament</h3>
            <form onSubmit={handleCreateNewTournament} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Tournament Name *</label>
                <Input
                  value={newLeagueName}
                  onChange={(e) => setNewLeagueName(e.target.value)}
                  placeholder="e.g. Mangalore Premier Turf"
                  required
                  className="bg-white border-slate-300 text-xs"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewLeagueModal(false)}
                  className="border-slate-300 text-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  Initialize
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
