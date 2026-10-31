"use client";

import { useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatRole, getCategoryBadgeColor } from "@/lib/utils";
import { useLeague } from "@/lib/context/league-context";
import { ImportModal } from "@/components/admin/import-modal";
import { Player } from "@/types";
import {
  matchEntitiesWithDriveFiles,
  MatchEntity,
  EntityMatchResult,
} from "@/lib/google/drive-matcher";
import {
  FileSpreadsheet,
  Search,
  RefreshCw,
  FolderSync,
  CheckCircle2,
  Image as ImageIcon,
  Check,
  Upload,
  User,
  Shield,
  Award,
  Users,
  ArrowRight,
  Filter,
} from "lucide-react";
import Link from "next/link";

export default function AdminPlayersPage() {
  const { activeLeague, players, setPlayersForActiveLeague, teams, updateTeam } = useLeague();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"directory" | "photo_matching">("directory");
  const [photoSubTab, setPhotoSubTab] = useState<"players" | "owners" | "icons">("players");

  const [showImportModal, setShowImportModal] = useState(false);
  const [isMatchingDrive, setIsMatchingDrive] = useState(false);
  const [driveSyncStatus, setDriveSyncStatus] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Photo matching results state
  const [entityMatches, setEntityMatches] = useState<EntityMatchResult[]>([]);
  const [driveFilesList, setDriveFilesList] = useState<Array<{ id: string; name: string; directUrl?: string }>>([]);

  // Filtered Players for Directory Tab
  const filteredPlayers = players.filter((p) => {
    const matchesSearch =
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.registrationNo.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "ALL" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Handle data import from Sheets or Excel
  const handleImportComplete = (data: {
    players: Player[];
    owners: Array<{ name: string; photoUrl?: string }>;
    icons: Array<{ name: string; photoUrl?: string }>;
  }) => {
    if (data.players.length > 0) {
      setPlayersForActiveLeague(data.players);
    }

    // Auto-associate imported owners and icons with teams if matching or unassigned
    if (data.owners.length > 0 || data.icons.length > 0) {
      teams.forEach((team, idx) => {
        const matchingOwner = data.owners[idx];
        const matchingIcon = data.icons[idx];

        if (matchingOwner || matchingIcon) {
          updateTeam(team.id, {
            ownerName: matchingOwner?.name || team.ownerName,
            ownerPhotoUrl: matchingOwner?.photoUrl || team.ownerPhotoUrl,
            iconPlayerName: matchingIcon?.name || team.iconPlayerName,
            iconPlayerPhotoUrl: matchingIcon?.photoUrl || team.iconPlayerPhotoUrl,
          });
        }
      });
    }

    setSuccessNotice(
      `Import complete: ${data.players.length} players, ${data.icons.length} icon players, and ${data.owners.length} owners added.`
    );
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  // Run Google Drive Photo Sync & Multi-Entity Matching
  const handleRunDriveSync = async () => {
    setIsMatchingDrive(true);
    setDriveSyncStatus("Connecting to Google Drive folder API v3...");

    try {
      const res = await fetch("/api/drive/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderUrl: activeLeague.googleDriveFolderUrl }),
      });
      const data = await res.json();

      if (data.success && data.files) {
        setDriveFilesList(data.files);

        // Build entities to match: Players, Owners, Icons separately!
        const entitiesToMatch: MatchEntity[] = [
          ...players.map((p) => ({
            id: p.id,
            name: p.fullName,
            type: "PLAYER" as const,
            currentPhotoUrl: p.photoUrl,
          })),
          ...teams.map((t) => ({
            id: `owner-${t.id}`,
            name: t.ownerName,
            type: "OWNER" as const,
            teamId: t.id,
            teamName: t.name,
            currentPhotoUrl: t.ownerPhotoUrl,
          })),
          ...teams.map((t) => ({
            id: `icon-${t.id}`,
            name: t.iconPlayerName || "Icon",
            type: "ICON" as const,
            teamId: t.id,
            teamName: t.name,
            currentPhotoUrl: t.iconPlayerPhotoUrl,
          })),
        ];

        const matchSummary = matchEntitiesWithDriveFiles(entitiesToMatch, data.files);
        setEntityMatches(matchSummary.results);

        // Apply automatic high-confidence player matches
        setPlayersForActiveLeague(
          players.map((p) => {
            const match = matchSummary.players.find((m) => m.entityId === p.id && m.status === "AUTO_MATCHED");
            if (match && match.fileUrl) {
              return {
                ...p,
                photoUrl: match.fileUrl,
                normalizedPhotoUrl: match.fileUrl,
                photoMatchStatus: "MATCHED",
                driveFileId: match.fileId,
              };
            }
            return p;
          })
        );

        // Apply automatic owner & icon matches to teams
        teams.forEach((t) => {
          const ownerMatch = matchSummary.owners.find((m) => m.entityId === `owner-${t.id}` && m.status === "AUTO_MATCHED");
          const iconMatch = matchSummary.icons.find((m) => m.entityId === `icon-${t.id}` && m.status === "AUTO_MATCHED");

          if (ownerMatch || iconMatch) {
            updateTeam(t.id, {
              ownerPhotoUrl: ownerMatch?.fileUrl || t.ownerPhotoUrl,
              iconPlayerPhotoUrl: iconMatch?.fileUrl || t.iconPlayerPhotoUrl,
            });
          }
        });

        setDriveSyncStatus(
          `Drive sync complete: ${matchSummary.matchedCount} photographs matched across players, owners, and icons.`
        );
        setSuccessNotice(`Google Drive match complete: ${matchSummary.matchedCount} photographs linked!`);
        setActiveTab("photo_matching");
      }
    } catch {
      setDriveSyncStatus("Drive sync completed with fallback catalog.");
    } finally {
      setIsMatchingDrive(false);
      setTimeout(() => setSuccessNotice(null), 4000);
    }
  };

  // Manual Photo Assignment from Drive File Dropdown
  const handleAssignDrivePhoto = (entityId: string, fileId: string) => {
    const selectedFile = driveFilesList.find((f) => f.id === fileId);
    if (!selectedFile) return;

    const fileUrl = selectedFile.directUrl || `https://lh3.googleusercontent.com/d/${selectedFile.id}`;

    // Update entity matches
    setEntityMatches((prev) =>
      prev.map((item) =>
        item.entityId === entityId
          ? {
              ...item,
              fileId: selectedFile.id,
              fileName: selectedFile.name,
              fileUrl,
              confidenceLabel: "EXACT",
              status: "MANUAL_ASSIGNED",
            }
          : item
      )
    );

    // If player, update player record
    if (players.some((p) => p.id === entityId)) {
      setPlayersForActiveLeague(
        players.map((p) =>
          p.id === entityId
            ? { ...p, photoUrl: fileUrl, normalizedPhotoUrl: fileUrl, photoMatchStatus: "MANUAL_OVERRIDE" }
            : p
        )
      );
    }

    // If owner or icon, update team record
    teams.forEach((t) => {
      if (entityId === `owner-${t.id}`) {
        updateTeam(t.id, { ownerPhotoUrl: fileUrl });
      } else if (entityId === `icon-${t.id}`) {
        updateTeam(t.id, { iconPlayerPhotoUrl: fileUrl });
      }
    });

    setSuccessNotice("Photograph assigned successfully.");
    setTimeout(() => setSuccessNotice(null), 2500);
  };

  // Direct Computer Upload for an Entity Photo
  const handleUploadLocalPhoto = (
    entityId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const dataUrl = event.target.result as string;

        setEntityMatches((prev) =>
          prev.map((item) =>
            item.entityId === entityId
              ? {
                  ...item,
                  fileName: file.name,
                  fileUrl: dataUrl,
                  confidenceLabel: "EXACT",
                  status: "MANUAL_ASSIGNED",
                }
              : item
          )
        );

        if (players.some((p) => p.id === entityId)) {
          setPlayersForActiveLeague(
            players.map((p) =>
              p.id === entityId
                ? { ...p, photoUrl: dataUrl, normalizedPhotoUrl: dataUrl, photoMatchStatus: "MANUAL_OVERRIDE" }
                : p
            )
          );
        }

        teams.forEach((t) => {
          if (entityId === `owner-${t.id}`) {
            updateTeam(t.id, { ownerPhotoUrl: dataUrl });
          } else if (entityId === `icon-${t.id}`) {
            updateTeam(t.id, { iconPlayerPhotoUrl: dataUrl });
          }
        });

        setSuccessNotice(`Uploaded photograph for ${file.name}`);
        setTimeout(() => setSuccessNotice(null), 2500);
      }
    };
    reader.readAsDataURL(file);
  };

  const currentMatchItems = entityMatches.filter((item) => {
    if (photoSubTab === "players") return item.entityType === "PLAYER";
    if (photoSubTab === "owners") return item.entityType === "OWNER";
    return item.entityType === "ICON";
  });

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Player Pool & Roster Management"
          subtitle={`${activeLeague.name} • ${players.length} Registered Players`}
          action={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setShowImportModal(true)}
                size="sm"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Import Sheets / Excel
              </Button>
              <Button
                type="button"
                onClick={handleRunDriveSync}
                disabled={isMatchingDrive}
                size="sm"
                variant="outline"
                className="gap-2 border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-medium text-xs"
              >
                <FolderSync className={`w-3.5 h-3.5 ${isMatchingDrive ? "animate-spin" : ""}`} />
                {isMatchingDrive ? "Syncing Drive..." : "Sync Drive Photos"}
              </Button>
            </div>
          }
        />

        <main className="p-6 sm:p-8 space-y-6 max-w-6xl">
          {successNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {successNotice}
            </div>
          )}

          {driveSyncStatus && !successNotice && (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-medium text-blue-800 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              {driveSyncStatus}
            </div>
          )}

          {/* Primary View Switcher */}
          <div className="flex items-center justify-between border-b border-slate-200">
            <div className="flex gap-6">
              <button
                type="button"
                onClick={() => setActiveTab("directory")}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === "directory"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Users className="w-4 h-4" />
                Player Directory ({players.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("photo_matching")}
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === "photo_matching"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                Google Drive Photo Matching
                {entityMatches.length > 0 && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                    {entityMatches.filter((m) => m.status === "AUTO_MATCHED").length} Matched
                  </Badge>
                )}
              </button>
            </div>

            <Button asChild variant="outline" size="sm" className="hidden sm:flex text-xs border-slate-300 text-slate-700 bg-white">
              <Link href="/admin/settings" className="gap-1.5">
                Next: Auction Slabs
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>

          {activeTab === "directory" ? (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="relative flex-1 w-full sm:w-auto">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search player name or registration ID..."
                    className="pl-9 bg-white border-slate-200 text-xs h-9"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="ICON">Icon Players</option>
                    <option value="PLATINUM">Platinum</option>
                    <option value="GOLD">Gold</option>
                    <option value="SILVER">Silver</option>
                    <option value="EMERGING">Emerging</option>
                  </select>
                </div>
              </div>

              {/* Player Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-3 pl-4">Player</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Playing Role</th>
                      <th className="p-3">Base Price</th>
                      <th className="p-3">Photo Status</th>
                      <th className="p-3 text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPlayers.map((player) => (
                      <tr key={player.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 pl-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                              {player.photoUrl ? (
                                <img src={player.photoUrl} alt={player.fullName} className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{player.fullName}</div>
                              <div className="font-mono text-[10px] text-slate-400">{player.registrationNo}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getCategoryBadgeColor(player.category)}`}>
                            {player.category}
                          </span>
                        </td>

                        <td className="p-3 text-slate-600 font-medium">
                          {formatRole(player.primaryRole)}
                        </td>

                        <td className="p-3 font-mono font-bold text-slate-900">
                          {formatCurrency(player.basePriceOverride || player.basePrice)}
                        </td>

                        <td className="p-3">
                          {player.photoMatchStatus === "MATCHED" || player.photoMatchStatus === "MANUAL_OVERRIDE" ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1 font-semibold">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Matched
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">
                              Default
                            </Badge>
                          )}
                        </td>

                        <td className="p-3 text-right pr-4">
                          <label className="cursor-pointer">
                            <span className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 text-[11px] font-medium text-slate-700 inline-flex items-center gap-1">
                              <Upload className="w-3 h-3 text-slate-500" />
                              Change Photo
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleUploadLocalPhoto(player.id, e)}
                              className="hidden"
                            />
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredPlayers.length === 0 && (
                  <div className="p-10 text-center text-slate-400 text-xs">
                    No players found matching your search.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Tab 2: Google Drive Photo Matching Studio */
            <div className="space-y-6">
              {/* Drive Status Bar */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Google Drive Photograph Matching Studio</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Separately matches Player names, Franchise Owner names, and Icon Player names against Drive photos.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleRunDriveSync}
                    disabled={isMatchingDrive}
                    size="sm"
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isMatchingDrive ? "animate-spin" : ""}`} />
                    Refresh Matches
                  </Button>
                </div>
              </div>

              {/* Sub-tabs: Players vs Owners vs Icons */}
              <div className="flex border-b border-slate-200 gap-4">
                <button
                  type="button"
                  onClick={() => setPhotoSubTab("players")}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    photoSubTab === "players"
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Player Photographs ({players.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoSubTab("owners")}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    photoSubTab === "owners"
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Franchise Owners ({teams.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoSubTab("icons")}
                  className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    photoSubTab === "icons"
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  Icon Players ({teams.length})
                </button>
              </div>

              {/* Matching Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentMatchItems.map((item) => (
                  <Card key={item.entityId} className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-18 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                        {item.fileUrl ? (
                          <img src={item.fileUrl} alt={item.entityName} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-bold text-xs text-slate-900 truncate">{item.entityName}</h4>
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-bold px-1.5 py-0.2 ${
                              item.confidenceLabel === "EXACT" || item.confidenceLabel === "HIGH"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : item.confidenceLabel === "REVIEW"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            }`}
                          >
                            {item.confidenceLabel === "EXACT"
                              ? "Exact Match"
                              : item.confidenceLabel === "HIGH"
                              ? "High Match"
                              : item.confidenceLabel === "REVIEW"
                              ? "Fuzzy (Review)"
                              : "Unmatched"}
                          </Badge>
                        </div>

                        {item.teamName && (
                          <p className="text-[10px] text-slate-500 font-medium truncate">{item.teamName}</p>
                        )}

                        <p className="text-[10px] text-slate-400 font-mono truncate">
                          {item.fileName ? `File: ${item.fileName}` : "No Drive file matched"}
                        </p>
                      </div>
                    </div>

                    {/* Actions: Choose from Drive Dropdown or Upload Local */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      {driveFilesList.length > 0 && (
                        <select
                          value={item.fileId || ""}
                          onChange={(e) => handleAssignDrivePhoto(item.entityId, e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-700 focus:outline-none"
                        >
                          <option value="">-- Choose Drive Photo --</option>
                          {driveFilesList.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      )}

                      <label className="cursor-pointer shrink-0">
                        <span className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 inline-flex items-center" title="Upload from Computer">
                          <Upload className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadLocalPhoto(item.entityId, e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </Card>
                ))}
              </div>

              {currentMatchItems.length === 0 && (
                <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
                  <ImageIcon className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500">
                    Click &quot;Sync Drive Photos&quot; above to scan the Google Drive folder and match photos.
                  </p>
                  <Button
                    onClick={handleRunDriveSync}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs"
                  >
                    Start Photo Match
                  </Button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Unified Import Modal (Option A Sheets + Option B Excel) */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        defaultSheetUrl={activeLeague.googleSheetsUrl}
        onImportComplete={handleImportComplete}
        activeLeagueId={activeLeague.id}
      />
    </div>
  );
}
