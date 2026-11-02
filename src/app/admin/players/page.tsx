"use client";

import { useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatRole } from "@/lib/utils";
import { useLeague } from "@/lib/context/league-context";
import { ImportModal } from "@/components/admin/import-modal";
import { Player, PlayerRole } from "@/types";
import { uploadImageSafely } from "@/lib/media/image-upload-client";
import type { EntityMatchResult } from "@/lib/google/drive-matcher";
import {
  FileSpreadsheet,
  Search,
  RefreshCw,
  CheckCircle2,
  Image as ImageIcon,
  Check,
  Upload,
  User,
  Shield,
  Award,
  Users,
  ArrowRight,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
} from "lucide-react";
import Link from "next/link";

// Upload helper communicating with the protected UploadThing-backed media endpoint.
async function uploadImage(file: File, folder: "players" | "teams" | "league" = "players"): Promise<string> {
  const result = await uploadImageSafely(file, folder);
  return result.url;
}

function getPlayerInitials(name: string): string {
  if (!name) return "P";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AdminPlayersPage() {
  const { activeLeague, players, addPlayers, setPlayersForActiveLeague, updatePlayer, teams, updateTeam } = useLeague();

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"directory" | "photo_matching">("directory");
  const [photoSubTab, setPhotoSubTab] = useState<"players" | "owners" | "icons">("players");

  const [showImportModal, setShowImportModal] = useState(false);
  const [isMatchingAssets, setIsMatchingAssets] = useState(false);
  const [assetStatus, setAssetStatus] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Photo matching results state
  const [entityMatches, setEntityMatches] = useState<EntityMatchResult[]>([]);
  const [assetFilesList] = useState<Array<{ id: string; name: string; directUrl?: string }>>([]);

  // Inline edited base prices state
  const [editedBasePrices, setEditedBasePrices] = useState<Record<string, number>>({});
  const [uploadingPlayerId, setUploadingPlayerId] = useState<string | null>(null);

  // Edit Player Modal state
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editRegNo, setEditRegNo] = useState("");
  const [editRole, setEditRole] = useState<PlayerRole>("ALL_ROUNDER");
  const [editBasePrice, setEditBasePrice] = useState<number>(2000);
  const [editPhotoUrl, setEditPhotoUrl] = useState<string>("");
  const [isModalUploading, setIsModalUploading] = useState(false);

  // Filtered Players for Directory Tab
  const filteredPlayers = players.filter((p) => {
    return (
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      Boolean(p.registrationNo && p.registrationNo.toLowerCase().includes(search.toLowerCase()))
    );
  });

  // Handle data import from Sheets or Excel (append or replace)
  const handleImportComplete = (data: {
    players: Player[];
    owners: Array<{ name: string; photoUrl?: string; teamName?: string }>;
    icons: Array<{ name: string; photoUrl?: string; teamName?: string }>;
    mode: "append" | "replace";
  }) => {
    let nextPlayers: Player[];
    if (data.mode === "replace") {
      nextPlayers = data.players;
    } else {
      nextPlayers = [...players, ...data.players];
    }
    setPlayersForActiveLeague(nextPlayers);

    // Auto-associate imported owners and icons with teams by team name affiliation
    if (data.owners.length > 0 || data.icons.length > 0) {
      teams.forEach((team, idx) => {
        const matchingOwner =
          data.owners.find(
            (o) => o.teamName && o.teamName.trim().toLowerCase() === team.name.trim().toLowerCase()
          ) || data.owners[idx];

        const matchingIcon =
          data.icons.find(
            (i) => i.teamName && i.teamName.trim().toLowerCase() === team.name.trim().toLowerCase()
          ) || data.icons[idx];

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
      `Import complete (${data.mode === "replace" ? "replaced" : "appended"}): ${data.players.length} players imported successfully.`
    );
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  // Inline Base Price Save Handlers
  const handleSaveInlineBasePrice = (playerId: string) => {
    const price = editedBasePrices[playerId];
    if (price && price > 0) {
      updatePlayer(playerId, { basePrice: price, basePriceOverride: price });
      setEditedBasePrices((prev) => {
        const copy = { ...prev };
        delete copy[playerId];
        return copy;
      });
      setSuccessNotice("Base price updated.");
      setTimeout(() => setSuccessNotice(null), 2000);
    }
  };

  const handleSaveAllBasePrices = () => {
    const updated = players.map((p) => {
      const newPrice = editedBasePrices[p.id];
      if (newPrice !== undefined && newPrice > 0) {
        return { ...p, basePrice: newPrice, basePriceOverride: newPrice };
      }
      return p;
    });
    setPlayersForActiveLeague(updated);
    setEditedBasePrices({});
    setSuccessNotice(`Saved base prices for ${Object.keys(editedBasePrices).length} players.`);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  // Direct Computer Upload for an Entity Photo via /api/media/upload
  const handleUploadLocalPhoto = async (
    entityId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const folder = entityId.startsWith("owner-") || entityId.startsWith("icon-") ? "teams" : "players";
      const uploadedUrl = await uploadImage(file, folder);

      setEntityMatches((prev) =>
        prev.map((item) =>
          item.entityId === entityId
            ? {
                ...item,
                fileName: file.name,
                fileUrl: uploadedUrl,
                confidenceLabel: "EXACT",
                status: "MANUAL_ASSIGNED",
              }
            : item
        )
      );

      if (players.some((p) => p.id === entityId)) {
        updatePlayer(entityId, {
          photoUrl: uploadedUrl,
          normalizedPhotoUrl: uploadedUrl,
          photoMatchStatus: "MANUAL_OVERRIDE",
        });
      }

      teams.forEach((t) => {
        if (entityId === `owner-${t.id}`) {
          updateTeam(t.id, { ownerPhotoUrl: uploadedUrl });
        } else if (entityId === `icon-${t.id}`) {
          updateTeam(t.id, { iconPlayerPhotoUrl: uploadedUrl });
        }
      });

      setSuccessNotice(`Uploaded photograph for ${file.name}`);
      setTimeout(() => setSuccessNotice(null), 2500);
    } catch (err) {
      alert((err as Error).message || "Failed to upload photo");
    }
  };

  const handlePhotoUploadForPlayer = async (playerId: string, file: File) => {
    setUploadingPlayerId(playerId);
    try {
      const url = await uploadImage(file, "players");
      updatePlayer(playerId, {
        photoUrl: url,
        normalizedPhotoUrl: url,
        photoMatchStatus: "MANUAL_OVERRIDE",
      });
      setSuccessNotice("Player photograph uploaded and linked.");
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err) {
      alert((err as Error).message || "Failed to upload photo");
    } finally {
      setUploadingPlayerId(null);
    }
  };

  // Edit Player Modal Handlers
  const openEditModal = (player: Player) => {
    setEditingPlayer(player);
    setEditFullName(player.fullName);
    setEditRegNo(player.registrationNo || "");
    setEditRole((player.primaryRole as PlayerRole) || "ALL_ROUNDER");
    setEditBasePrice(player.basePriceOverride || player.basePrice || 2000);
    setEditPhotoUrl(player.photoUrl || "");
  };

  const openAddPlayerModal = () => {
    setEditingPlayer(null);
    setEditFullName("");
    setEditRegNo("");
    setEditRole("ALL_ROUNDER");
    setEditBasePrice(activeLeague.defaultBasePrice || 2000);
    setEditPhotoUrl("");
    setIsAddingPlayer(true);
  };

  const handleModalPhotoUpload = async (file: File) => {
    setIsModalUploading(true);
    try {
      const url = await uploadImage(file, "players");
      setEditPhotoUrl(url);
      setSuccessNotice("Photograph uploaded.");
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err) {
      alert((err as Error).message || "Failed to upload photo");
    } finally {
      setIsModalUploading(false);
    }
  };

  const handleSaveEditedPlayer = () => {
    if (!editingPlayer || !editFullName.trim()) return;

    updatePlayer(editingPlayer.id, {
      fullName: editFullName.trim(),
      registrationNo: editRegNo.trim(),
      primaryRole: editRole,
      basePrice: editBasePrice,
      basePriceOverride: editBasePrice,
      photoUrl: editPhotoUrl,
      normalizedPhotoUrl: editPhotoUrl,
      photoMatchStatus: editPhotoUrl ? "MANUAL_OVERRIDE" : undefined,
    });

    setEditingPlayer(null);
    setSuccessNotice(`Updated player details for ${editFullName.trim()}`);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const handleAddPlayer = () => {
    if (!editFullName.trim()) return;
    addPlayers([{ id: `player-${Date.now()}`, seasonId: activeLeague.id, fullName: editFullName.trim(), registrationNo: editRegNo.trim(), primaryRole: editRole, basePrice: editBasePrice, basePriceOverride: editBasePrice, photoUrl: editPhotoUrl, normalizedPhotoUrl: editPhotoUrl, photoMatchStatus: editPhotoUrl ? "MANUAL_OVERRIDE" : "UNMATCHED", status: "AVAILABLE", sortOrder: players.length + 1 }]);
    setIsAddingPlayer(false);
    setSuccessNotice(`Added ${editFullName.trim()} to the player pool.`);
  };

  const handleDeletePlayer = (playerId: string, playerName: string) => {
    if (confirm(`Are you sure you want to delete ${playerName} from the player pool?`)) {
      setPlayersForActiveLeague(players.filter((p) => p.id !== playerId));
      if (editingPlayer?.id === playerId) setEditingPlayer(null);
      setSuccessNotice(`Removed player ${playerName}.`);
      setTimeout(() => setSuccessNotice(null), 3000);
    }
  };

  // Shows the local assignment screen. ZIP assets are linked by the server importer;
  // administrators can upload a replacement where an asset is unassigned.
  const handleOpenAssetMatching = () => {
    setIsMatchingAssets(true);
    setEntityMatches([
      ...players.map((p) => ({ entityId: p.id, entityName: p.fullName, entityType: "PLAYER" as const, fileUrl: p.photoUrl, confidence: 0, confidenceLabel: p.photoUrl ? "EXACT" as const : "UNMATCHED" as const, status: p.photoUrl ? "MANUAL_ASSIGNED" as const : "UNMATCHED" as const })),
      ...teams.flatMap((t) => [
        { entityId: `owner-${t.id}`, entityName: t.ownerName, entityType: "OWNER" as const, teamName: t.name, fileUrl: t.ownerPhotoUrl, confidence: 0, confidenceLabel: t.ownerPhotoUrl ? "EXACT" as const : "UNMATCHED" as const, status: t.ownerPhotoUrl ? "MANUAL_ASSIGNED" as const : "UNMATCHED" as const },
        { entityId: `icon-${t.id}`, entityName: t.iconPlayerName || "Icon", entityType: "ICON" as const, teamName: t.name, fileUrl: t.iconPlayerPhotoUrl, confidence: 0, confidenceLabel: t.iconPlayerPhotoUrl ? "EXACT" as const : "UNMATCHED" as const, status: t.iconPlayerPhotoUrl ? "MANUAL_ASSIGNED" as const : "UNMATCHED" as const },
      ]),
    ]);
    setAssetStatus("Upload a replacement image for any unassigned person.");
    setActiveTab("photo_matching");
    setIsMatchingAssets(false);
  };

  // Manual Photo Assignment from the imported asset picker.
  const handleAssignAssetPhoto = (entityId: string, fileId: string) => {
    const selectedFile = assetFilesList.find((f) => f.id === fileId);
    if (!selectedFile) return;

    const fileUrl = selectedFile.directUrl || `https://lh3.googleusercontent.com/d/${selectedFile.id}`;

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

    if (players.some((p) => p.id === entityId)) {
      setPlayersForActiveLeague(
        players.map((p) =>
          p.id === entityId
            ? { ...p, photoUrl: fileUrl, normalizedPhotoUrl: fileUrl, photoMatchStatus: "MANUAL_OVERRIDE" }
            : p
        )
      );
    }

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

  const currentMatchItems = entityMatches.filter((item) => {
    if (photoSubTab === "players") return item.entityType === "PLAYER";
    if (photoSubTab === "owners") return item.entityType === "OWNER";
    return item.entityType === "ICON";
  });

  const unsavedCount = Object.keys(editedBasePrices).length;

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Player Pool & Roster Management"
          subtitle={`${activeLeague.name} • ${players.length} Registered Players`}
          action={
            <div className="flex items-center gap-2">
              <Button type="button" onClick={openAddPlayerModal} size="sm" variant="outline" className="gap-2 border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-medium text-xs"><User className="w-3.5 h-3.5" />Add Player</Button>
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
                onClick={handleOpenAssetMatching}
                disabled={isMatchingAssets}
                size="sm"
                variant="outline"
                className="gap-2 border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-medium text-xs"
              >
                <ImageIcon className={`w-3.5 h-3.5 ${isMatchingAssets ? "animate-spin" : ""}`} />
                {isMatchingAssets ? "Opening assets..." : "Assign Photos"}
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

          {assetStatus && !successNotice && (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-medium text-blue-800 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              {assetStatus}
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
                Photo Assignment
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
            players.length === 0 ? (
              <div className="p-16 text-center bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                  <Users className="w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h3 className="text-base font-bold text-slate-900">No Players in Auction Pool</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Upload an Excel file (.xlsx / .xls) containing player names to populate your tournament roster. Single-column files with only &quot;Player Name&quot; are fully supported.
                  </p>
                </div>
                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={() => setShowImportModal(true)}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Import Players from Excel / Sheets
                  </Button>
                </div>
              </div>
            ) : (
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

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {unsavedCount > 0 && (
                      <Button
                        size="sm"
                        onClick={handleSaveAllBasePrices}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-sm"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save All Prices ({unsavedCount})
                      </Button>
                    )}
                  </div>
                </div>

                {/* Player Table */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="p-3 pl-4">Player</th>
                        <th className="p-3">Playing Role</th>
                        <th className="p-3">Base Price (₹)</th>
                        <th className="p-3">Photo Status</th>
                        <th className="p-3 text-right pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPlayers.map((player) => {
                        const currentBasePrice =
                          editedBasePrices[player.id] !== undefined
                            ? editedBasePrices[player.id]
                            : player.basePriceOverride || player.basePrice || 2000;
                        const isEdited = editedBasePrices[player.id] !== undefined;

                        return (
                          <tr key={player.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 pl-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                                  {player.photoUrl ? (
                                    <img src={player.photoUrl} alt={player.fullName} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-emerald-50 flex items-center justify-center text-emerald-800 font-bold text-[11px]">
                                      {getPlayerInitials(player.fullName)}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{player.fullName}</div>
                                  <div className="font-mono text-[10px] text-slate-400">{player.registrationNo}</div>
                                </div>
                              </div>
                            </td>

                            <td className="p-3 text-slate-600 font-medium">
                              {formatRole(player.primaryRole)}
                            </td>

                            {/* Manually Editable Base Price Input */}
                            <td className="p-3">
                              <div className="flex items-center gap-1.5 max-w-[150px]">
                                <Input
                                  type="number"
                                  min={1}
                                  step={500}
                                  value={currentBasePrice}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setEditedBasePrices((prev) => ({ ...prev, [player.id]: val }));
                                  }}
                                  onBlur={() => handleSaveInlineBasePrice(player.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveInlineBasePrice(player.id);
                                  }}
                                  className={`h-7 text-xs font-mono font-bold px-2 py-0 ${
                                    isEdited
                                      ? "bg-amber-50 border-amber-300 text-amber-900"
                                      : "bg-slate-50 border-slate-200 text-slate-900"
                                  }`}
                                />
                                {isEdited && (
                                  <button
                                    onClick={() => handleSaveInlineBasePrice(player.id)}
                                    title="Save Base Price"
                                    className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 shrink-0"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>

                            <td className="p-3">
                              {player.photoUrl ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] gap-1 font-semibold">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  Photo Added
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">
                                  No Photo
                                </Badge>
                              )}
                            </td>

                            <td className="p-3 text-right pr-4">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditModal(player)}
                                  className="h-7 px-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-[11px] gap-1"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  Edit
                                </Button>

                                <label className="cursor-pointer">
                                  <span className="h-7 px-2 rounded border border-slate-200 hover:bg-slate-100 text-[11px] font-medium text-slate-700 inline-flex items-center gap-1">
                                    {uploadingPlayerId === player.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                                    ) : (
                                      <Upload className="w-3 h-3 text-slate-500" />
                                    )}
                                    Photo
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    disabled={uploadingPlayerId === player.id}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handlePhotoUploadForPlayer(player.id, file);
                                    }}
                                    className="hidden"
                                  />
                                </label>

                                <button
                                  type="button"
                                  onClick={() => handleDeletePlayer(player.id, player.fullName)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                  title="Delete Player"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {filteredPlayers.length === 0 && (
                    <div className="p-10 text-center text-slate-400 text-xs">
                      No players found matching your search.
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            /* Tab 2: asset assignment studio */
            <div className="space-y-6">
              {/* Asset status */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Photograph Assignment</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Assign uploaded images to players, franchise owners, and icon players.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleOpenAssetMatching}
                    disabled={isMatchingAssets}
                    size="sm"
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isMatchingAssets ? "animate-spin" : ""}`} />
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
                          {item.fileName ? `File: ${item.fileName}` : "No uploaded file assigned"}
                        </p>
                      </div>
                    </div>

                    {/* Actions: Choose an imported asset or upload a replacement */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      {assetFilesList.length > 0 && (
                        <select
                          value={item.fileId || ""}
                          onChange={(e) => handleAssignAssetPhoto(item.entityId, e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-700 focus:outline-none"
                        >
                          <option value="">-- Choose Uploaded Photo --</option>
                          {assetFilesList.map((f) => (
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
                    Open photo assignment above to upload and link a photograph.
                  </p>
                  <Button
                    onClick={handleOpenAssetMatching}
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

      {/* Individual Edit Player Modal */}
      {(editingPlayer || isAddingPlayer) && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{isAddingPlayer ? "Add Player" : "Edit Player Details"}</h3>
                {!isAddingPlayer && <p className="text-xs text-slate-500">ID: {editingPlayer?.id}</p>}
              </div>
              <button
                onClick={() => { setEditingPlayer(null); setIsAddingPlayer(false); }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Photo Preview & Upload */}
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="w-16 h-20 rounded-lg overflow-hidden bg-white border border-slate-300 shrink-0 flex items-center justify-center">
                  {editPhotoUrl ? (
                    <img src={editPhotoUrl} alt="Player" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-emerald-800 font-bold text-sm">
                      {getPlayerInitials(editFullName)}
                    </div>
                  )}
                </div>
                <div className="space-y-2 flex-1">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold text-slate-700">
                    {isModalUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" /> : <Upload className="w-3.5 h-3.5" />}
                    {isModalUploading ? "Uploading..." : "Upload Photo"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isModalUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleModalPhotoUpload(file);
                      }}
                      className="hidden"
                    />
                  </label>
                  {editPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setEditPhotoUrl("")}
                      className="block text-[11px] text-red-600 hover:underline"
                    >
                      Remove Photo
                    </button>
                  )}
                  <p className="text-[10px] text-slate-400">
                    Images are stored in the tournament media library.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Full Name *</label>
                  <Input
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="bg-white border-slate-300 text-xs h-8"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Registration No</label>
                  <Input
                    value={editRegNo}
                    onChange={(e) => setEditRegNo(e.target.value)}
                    className="bg-white border-slate-300 text-xs h-8 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Playing Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as PlayerRole)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none"
                >
                  <option value="BATSMAN">BATSMAN</option>
                  <option value="BOWLER">BOWLER</option>
                  <option value="ALL_ROUNDER">ALL_ROUNDER</option>
                  <option value="WICKET_KEEPER">WICKET_KEEPER</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Base Price (₹) *</label>
                <Input
                  type="number"
                  min={1}
                  step={500}
                  value={editBasePrice}
                  onChange={(e) => setEditBasePrice(Number(e.target.value))}
                  className="bg-white border-slate-300 text-xs h-8 font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => editingPlayer && handleDeletePlayer(editingPlayer.id, editingPlayer.fullName)}
                disabled={isAddingPlayer}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-8"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete Player
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setEditingPlayer(null); setIsAddingPlayer(false); }}
                  className="text-xs h-8 border-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={isAddingPlayer ? handleAddPlayer : handleSaveEditedPlayer}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-semibold"
                >
                  {isAddingPlayer ? "Add Player" : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Import Modal (Option A Sheets + Option B Excel) */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        defaultSheetUrl={activeLeague.googleSheetsUrl}
        defaultDriveUrl={activeLeague.googleDriveFolderUrl}
        defaultBasePrice={activeLeague.defaultBasePrice || 2000}
        existingPlayerCount={players.length}
        onImportComplete={handleImportComplete}
        activeLeagueId={activeLeague.id}
      />
    </div>
  );
}
