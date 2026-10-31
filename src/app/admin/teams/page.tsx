"use client";

import { useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { useLeague } from "@/lib/context/league-context";
import { Team } from "@/types";
import { Plus, Edit2, Trash2, CheckCircle2, Upload, User, Shield, Users, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function AdminTeamsPage() {
  const { activeLeague, teams, addTeam, updateTeam, deleteTeam } = useLeague();

  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State for Add / Edit Team
  const [teamName, setTeamName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhotoUrl, setOwnerPhotoUrl] = useState("");
  const [iconPlayerName, setIconPlayerName] = useState("");
  const [iconPlayerPhotoUrl, setIconPlayerPhotoUrl] = useState("");
  const [totalPurse, setTotalPurse] = useState<number>(5000000);
  const [minSquad, setMinSquad] = useState<number>(15);
  const [maxSquad, setMaxSquad] = useState<number>(18);
  const [maxIcon, setMaxIcon] = useState<number>(2);
  const [maxPlatinum, setMaxPlatinum] = useState<number>(4);
  const [minEmerging, setMinEmerging] = useState<number>(3);
  const [primaryColor, setPrimaryColor] = useState("#059669");

  const openAddModal = () => {
    setEditingTeam(null);
    setTeamName("");
    setShortCode("");
    setLogoUrl("https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&auto=format&fit=crop&q=80");
    setOwnerName("");
    setOwnerPhotoUrl("https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80");
    setIconPlayerName("");
    setIconPlayerPhotoUrl("https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80");
    setTotalPurse(5000000);
    setMinSquad(15);
    setMaxSquad(18);
    setMaxIcon(2);
    setMaxPlatinum(4);
    setMinEmerging(3);
    setPrimaryColor("#059669");
    setShowAddModal(true);
  };

  const openEditModal = (t: Team) => {
    setEditingTeam(t);
    setTeamName(t.name);
    setShortCode(t.shortCode);
    setLogoUrl(t.logoUrl || "");
    setOwnerName(t.ownerName || "");
    setOwnerPhotoUrl(t.ownerPhotoUrl || "");
    setIconPlayerName(t.iconPlayerName || "");
    setIconPlayerPhotoUrl(t.iconPlayerPhotoUrl || "");
    setTotalPurse(t.purse?.totalBudget || 5000000);
    setMinSquad(t.purse?.minPlayers || 15);
    setMaxSquad(t.purse?.maxPlayers || 18);
    setMaxIcon(t.categoryLimits?.max_icon ?? 2);
    setMaxPlatinum(t.categoryLimits?.max_platinum ?? 4);
    setMinEmerging(t.categoryLimits?.min_emerging ?? 3);
    setPrimaryColor(t.primaryColor || "#059669");
    setShowAddModal(true);
  };

  // Direct Computer Image Upload Helper
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setter(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    if (editingTeam) {
      // Update existing team
      updateTeam(editingTeam.id, {
        name: teamName,
        shortCode: shortCode.toUpperCase() || teamName.substring(0, 3).toUpperCase(),
        logoUrl: logoUrl || editingTeam.logoUrl,
        ownerName,
        ownerPhotoUrl,
        iconPlayerName,
        iconPlayerPhotoUrl,
        primaryColor,
        categoryLimits: {
          max_icon: maxIcon,
          max_platinum: maxPlatinum,
          min_emerging: minEmerging,
        },
        purse: {
          ...editingTeam.purse,
          totalBudget: totalPurse,
          remainingAmount: totalPurse - (editingTeam.purse?.spentAmount || 0),
          minPlayers: minSquad,
          maxPlayers: maxSquad,
        },
      });
      setSuccessNotice(`Updated franchise "${teamName}" successfully.`);
    } else {
      // Create new team
      const newTeamId = `team-${Date.now()}`;
      const newTeam: Team = {
        id: newTeamId,
        seasonId: activeLeague.id,
        name: teamName,
        shortCode: shortCode.toUpperCase() || teamName.substring(0, 3).toUpperCase(),
        logoUrl: logoUrl || "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&auto=format&fit=crop&q=80",
        ownerName: ownerName || "Franchise Syndicate",
        ownerPhotoUrl,
        iconPlayerName: iconPlayerName || "Unassigned",
        iconPlayerPhotoUrl,
        primaryColor,
        secondaryColor: "#F59E0B",
        squadCount: 0,
        categoryLimits: {
          max_icon: maxIcon,
          max_platinum: maxPlatinum,
          min_emerging: minEmerging,
        },
        purse: {
          id: `purse-${newTeamId}`,
          teamId: newTeamId,
          totalBudget: totalPurse,
          spentAmount: 0,
          remainingAmount: totalPurse,
          minPlayers: minSquad,
          maxPlayers: maxSquad,
          reservedForSquad: 0,
        },
      };
      addTeam(newTeam);
      setSuccessNotice(`Registered franchise "${teamName}" successfully.`);
    }

    setShowAddModal(false);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  const handleDeleteTeam = (id: string) => {
    deleteTeam(id);
    setDeleteConfirmId(null);
    setSuccessNotice("Franchise removed from tournament.");
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Team & Franchise Management"
          subtitle={`${activeLeague.name} • ${teams.length} Registered Franchises`}
          action={
            <Button
              type="button"
              onClick={openAddModal}
              size="sm"
              className="gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Franchise
            </Button>
          }
        />

        <main className="p-6 sm:p-8 space-y-6 max-w-6xl">
          {successNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {successNotice}
            </div>
          )}

          {/* Teams Header Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Tournament Franchises</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload official team logos directly from your computer. These logos appear consistently across the live auction stage and admin desk.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="sm" className="text-xs border-slate-300 text-slate-700 bg-white hover:bg-slate-50">
                <Link href="/admin/players" className="gap-1.5">
                  Proceed to Players
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {teams.map((team) => (
              <Card key={team.id} className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden hover:border-slate-300 transition-all flex flex-col justify-between">
                <CardContent className="p-5 space-y-4">
                  {/* Team Top Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                        {team.logoUrl ? (
                          <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-bold text-xs text-slate-500">{team.shortCode}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-sm text-slate-900 truncate">{team.name}</h3>
                          <Badge variant="outline" className="font-mono text-[10px] font-bold bg-slate-50 text-slate-700 border-slate-200">
                            {team.shortCode}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          Owner: <span className="font-medium text-slate-700">{team.ownerName || "Unassigned"}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(team)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Edit Team"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(team.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete Team"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Owner & Icon Player Sub-Card */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-white border border-slate-200 overflow-hidden shrink-0">
                        {team.ownerPhotoUrl ? (
                          <img src={team.ownerPhotoUrl} alt="Owner" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-slate-400 m-1.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Owner</span>
                        <span className="font-semibold text-slate-800 truncate block">{team.ownerName || "TBD"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-white border border-slate-200 overflow-hidden shrink-0">
                        {team.iconPlayerPhotoUrl ? (
                          <img src={team.iconPlayerPhotoUrl} alt="Icon" className="w-full h-full object-cover" />
                        ) : (
                          <Shield className="w-3.5 h-3.5 text-slate-400 m-1.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Icon Player</span>
                        <span className="font-semibold text-slate-800 truncate block">{team.iconPlayerName || "TBD"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Purse & Squad Stats */}
                  <div className="space-y-2 pt-1 border-t border-slate-100 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Purse Budget:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(team.purse?.totalBudget || 5000000)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Spent / Remaining:</span>
                      <span className="font-mono text-emerald-700 font-semibold">
                        {formatCurrency(team.purse?.remainingAmount || 5000000, true)} Left
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Squad Target:</span>
                      <span className="font-mono text-slate-700">
                        {team.squadCount || 0} / {team.purse?.maxPlayers || 18} (Min: {team.purse?.minPlayers || 15})
                      </span>
                    </div>
                  </div>

                  {/* Category Limits */}
                  <div className="flex flex-wrap gap-1.5 pt-1 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                      Max Icon: {team.categoryLimits?.max_icon ?? 2}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-medium">
                      Max Plat: {team.categoryLimits?.max_platinum ?? 4}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                      Min Emerging: {team.categoryLimits?.min_emerging ?? 3}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {teams.length === 0 && (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Franchises Configured</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Add your tournament teams with logos, owner details, and purse allocations.
              </p>
              <Button onClick={openAddModal} size="sm" className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs">
                Add First Team
              </Button>
            </div>
          )}
        </main>
      </div>

      {/* Add / Edit Team Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-5 my-8">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              {editingTeam ? `Edit Franchise: ${editingTeam.name}` : "Register New Franchise"}
            </h3>

            <form onSubmit={handleSaveTeam} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Team Name *</label>
                  <Input
                    value={teamName}
                    onChange={(e) => {
                      setTeamName(e.target.value);
                      if (!shortCode) setShortCode(e.target.value.substring(0, 3).toUpperCase());
                    }}
                    required
                    placeholder="e.g. Nalanda Strikers"
                    className="bg-white border-slate-300 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Short Code *</label>
                  <Input
                    value={shortCode}
                    onChange={(e) => setShortCode(e.target.value.toUpperCase())}
                    required
                    placeholder="e.g. NST"
                    className="bg-white border-slate-300 font-mono text-xs uppercase"
                  />
                </div>
              </div>

              {/* Team Logo: File Upload & URL */}
              <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="text-xs font-semibold text-slate-700 block">Team Logo</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : <Shield className="w-5 h-5 text-slate-400" />}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="cursor-pointer inline-block">
                      <span className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 shadow-sm">
                        <Upload className="w-3 h-3 text-slate-500" />
                        Upload Logo from Computer
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, setLogoUrl)}
                        className="hidden"
                      />
                    </label>
                    <Input
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="or paste image URL"
                      className="bg-white border-slate-300 font-mono text-[11px] h-8"
                    />
                  </div>
                </div>
              </div>

              {/* Franchise Owner & Icon Player */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="text-xs font-semibold text-slate-700 block">Franchise Owner</label>
                  <Input
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Owner Full Name"
                    className="bg-white border-slate-300 text-xs"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <label className="cursor-pointer">
                      <span className="px-2 py-1 rounded border border-slate-300 bg-white text-[10px] font-medium text-slate-700 inline-flex items-center gap-1">
                        <Upload className="w-2.5 h-2.5" />
                        Photo File
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, setOwnerPhotoUrl)}
                        className="hidden"
                      />
                    </label>
                    <Input
                      value={ownerPhotoUrl}
                      onChange={(e) => setOwnerPhotoUrl(e.target.value)}
                      placeholder="Photo URL"
                      className="bg-white border-slate-300 font-mono text-[10px] h-7"
                    />
                  </div>
                </div>

                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="text-xs font-semibold text-slate-700 block">Icon Player</label>
                  <Input
                    value={iconPlayerName}
                    onChange={(e) => setIconPlayerName(e.target.value)}
                    placeholder="Icon Player Full Name"
                    className="bg-white border-slate-300 text-xs"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <label className="cursor-pointer">
                      <span className="px-2 py-1 rounded border border-slate-300 bg-white text-[10px] font-medium text-slate-700 inline-flex items-center gap-1">
                        <Upload className="w-2.5 h-2.5" />
                        Photo File
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, setIconPlayerPhotoUrl)}
                        className="hidden"
                      />
                    </label>
                    <Input
                      value={iconPlayerPhotoUrl}
                      onChange={(e) => setIconPlayerPhotoUrl(e.target.value)}
                      placeholder="Photo URL"
                      className="bg-white border-slate-300 font-mono text-[10px] h-7"
                    />
                  </div>
                </div>
              </div>

              {/* Purse & Squad Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Purse Budget (₹)</label>
                  <Input
                    type="number"
                    value={totalPurse}
                    onChange={(e) => setTotalPurse(parseInt(e.target.value, 10) || 5000000)}
                    className="bg-white border-slate-300 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Min Squad Size</label>
                  <Input
                    type="number"
                    value={minSquad}
                    onChange={(e) => setMinSquad(parseInt(e.target.value, 10) || 15)}
                    className="bg-white border-slate-300 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Max Squad Size</label>
                  <Input
                    type="number"
                    value={maxSquad}
                    onChange={(e) => setMaxSquad(parseInt(e.target.value, 10) || 18)}
                    className="bg-white border-slate-300 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Category Restrictions */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Max Icon Players</label>
                  <Input
                    type="number"
                    value={maxIcon}
                    onChange={(e) => setMaxIcon(parseInt(e.target.value, 10) || 2)}
                    className="bg-white border-slate-300 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Max Platinum</label>
                  <Input
                    type="number"
                    value={maxPlatinum}
                    onChange={(e) => setMaxPlatinum(parseInt(e.target.value, 10) || 4)}
                    className="bg-white border-slate-300 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Min Emerging</label>
                  <Input
                    type="number"
                    value={minEmerging}
                    onChange={(e) => setMinEmerging(parseInt(e.target.value, 10) || 3)}
                    className="bg-white border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                  className="border-slate-300 text-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-5"
                >
                  {editingTeam ? "Update Franchise" : "Register Franchise"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Remove Franchise?</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to remove this franchise from the tournament? This action will remove their purse allocation and squad roster.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmId(null)}
                className="border-slate-300 text-slate-700 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteTeam(deleteConfirmId)}
                className="text-xs font-semibold"
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
