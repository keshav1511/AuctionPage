"use client";

import { useState } from "react";
import Image from "next/image";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { useLeague } from "@/lib/context/league-context";
import { MOCK_TEAMS } from "@/lib/mock-data/teams";
import { Team } from "@/types";
import { Plus, Edit2, Trophy, CheckCircle2, User } from "lucide-react";

export default function AdminTeamsPage() {
  const { activeLeague } = useLeague();
  const [teams, setTeams] = useState<Team[]>(MOCK_TEAMS);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // New Team Form state
  const [newTeamName, setNewTeamName] = useState("");
  const [newShortCode, setNewShortCode] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerPhoto, setNewOwnerPhoto] = useState("https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80");
  const [newIconName, setNewIconName] = useState("");
  const [newIconPhoto, setNewIconPhoto] = useState("https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80");
  const [newPurse, setNewPurse] = useState<number>(5000000);
  const [newMinSquad, setNewMinSquad] = useState<number>(15);
  const [newMaxSquad, setNewMaxSquad] = useState<number>(18);
  const [newPrimaryColor, setNewPrimaryColor] = useState("#059669");

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const newTeam: Team = {
      id: `team-${Date.now()}`,
      seasonId: activeLeague.id,
      name: newTeamName,
      shortCode: newShortCode.toUpperCase() || newTeamName.substring(0, 3).toUpperCase(),
      logoUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&auto=format&fit=crop&q=80",
      ownerName: newOwnerName || "Franchise Syndicate",
      ownerPhotoUrl: newOwnerPhoto,
      iconPlayerName: newIconName || "Unassigned",
      iconPlayerPhotoUrl: newIconPhoto,
      primaryColor: newPrimaryColor,
      secondaryColor: "#F59E0B",
      squadCount: 0,
      categoryLimits: { max_icon: 2, max_platinum: 4, min_emerging: 3 },
      purse: {
        id: `purse-${Date.now()}`,
        teamId: `team-${Date.now()}`,
        totalBudget: newPurse,
        spentAmount: 0,
        remainingAmount: newPurse,
        minPlayers: newMinSquad,
        maxPlayers: newMaxSquad,
        reservedForSquad: 0,
      },
    };

    setTeams([...teams, newTeam]);
    setShowAddModal(false);
    setSuccessNotice(`Franchise "${newTeamName}" added to ${activeLeague.name}!`);
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  const handleUpdateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;

    setTeams(teams.map((t) => (t.id === editingTeam.id ? editingTeam : t)));
    setEditingTeam(null);
    setSuccessNotice(`Franchise "${editingTeam.name}" updated successfully!`);
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#070A0D] flex text-slate-100">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Franchise & Purse Management"
          subtitle={`Configure team budgets, squad limits, owner details, and icon players for ${activeLeague.name}`}
          action={
            <Button
              onClick={() => setShowAddModal(true)}
              variant="gold"
              size="sm"
              className="gap-2 font-bold text-black"
            >
              <Plus className="w-4 h-4 fill-black" /> Add Franchise
            </Button>
          }
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto max-w-7xl">
          {successNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {successNotice}
            </div>
          )}

          {/* Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <Card key={team.id} className="border-slate-800 bg-charcoal-900">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl border border-white/20 flex items-center justify-center font-black text-white text-lg shadow-md"
                        style={{ backgroundColor: team.primaryColor }}
                      >
                        {team.shortCode}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">{team.name}</h3>
                        <p className="text-xs text-slate-400">Owner: {team.ownerName}</p>
                        {team.iconPlayerName && (
                          <p className="text-[11px] text-amber-300">
                            Icon: {team.iconPlayerName}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {team.squadCount}/{team.purse.maxPlayers}
                    </Badge>
                  </div>

                  {/* Owner & Icon Photographs */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-charcoal-950 border border-slate-800/80">
                      <div className="relative w-7 h-7 rounded-full overflow-hidden bg-slate-800 shrink-0">
                        {team.ownerPhotoUrl ? (
                          <Image src={team.ownerPhotoUrl} alt={team.ownerName} fill className="object-cover" />
                        ) : (
                          <User className="w-4 h-4 m-1.5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-slate-500 block text-[9px] uppercase">Owner</span>
                        <span className="text-slate-200 truncate block font-medium">{team.ownerName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded-lg bg-charcoal-950 border border-slate-800/80">
                      <div className="relative w-7 h-7 rounded-full overflow-hidden bg-slate-800 shrink-0">
                        {team.iconPlayerPhotoUrl || team.ownerPhotoUrl ? (
                          <Image src={team.iconPlayerPhotoUrl || team.ownerPhotoUrl!} alt="Icon" fill className="object-cover" />
                        ) : (
                          <Trophy className="w-4 h-4 m-1.5 text-amber-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-slate-500 block text-[9px] uppercase">Icon Player</span>
                        <span className="text-amber-300 truncate block font-medium">
                          {team.iconPlayerName || "Unassigned"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financials Breakdown */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Purse Allotted:</span>
                      <span className="font-mono font-bold text-white">
                        {formatCurrency(team.purse.totalBudget)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Spent on Squad:</span>
                      <span className="font-mono text-amber-400">
                        {formatCurrency(team.purse.spentAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Remaining Balance:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatCurrency(team.purse.remainingAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between pt-1 text-[11px] text-slate-500">
                      <span>Squad Limits:</span>
                      <span>Min {team.purse.minPlayers} • Max {team.purse.maxPlayers}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTeam(team)}
                      className="w-full text-xs gap-1.5 border-slate-700"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-400" /> Edit Franchise Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Edit Team Modal */}
          {editingTeam && (
            <div className="p-6 rounded-2xl border-2 border-amber-500/50 bg-charcoal-900 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-amber-400" />
                  Edit Franchise: {editingTeam.name}
                </h3>
                <button onClick={() => setEditingTeam(null)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateTeam} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Franchise Name</label>
                    <Input
                      value={editingTeam.name}
                      onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                      className="bg-charcoal-950 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Short Code (2-4 letters)</label>
                    <Input
                      value={editingTeam.shortCode}
                      onChange={(e) => setEditingTeam({ ...editingTeam, shortCode: e.target.value.toUpperCase() })}
                      className="bg-charcoal-950 font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Owner Name</label>
                    <Input
                      value={editingTeam.ownerName}
                      onChange={(e) => setEditingTeam({ ...editingTeam, ownerName: e.target.value })}
                      className="bg-charcoal-950 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Icon Player Name</label>
                    <Input
                      value={editingTeam.iconPlayerName || ""}
                      onChange={(e) => setEditingTeam({ ...editingTeam, iconPlayerName: e.target.value })}
                      className="bg-charcoal-950 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Total Purse Budget (₹)</label>
                    <Input
                      type="number"
                      value={editingTeam.purse.totalBudget}
                      onChange={(e) => {
                        const newBudget = parseInt(e.target.value, 10) || 0;
                        setEditingTeam({
                          ...editingTeam,
                          purse: {
                            ...editingTeam.purse,
                            totalBudget: newBudget,
                            remainingAmount: newBudget - editingTeam.purse.spentAmount,
                          },
                        });
                      }}
                      className="bg-charcoal-950 font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Min Squad Size</label>
                    <Input
                      type="number"
                      value={editingTeam.purse.minPlayers}
                      onChange={(e) =>
                        setEditingTeam({
                          ...editingTeam,
                          purse: { ...editingTeam.purse, minPlayers: parseInt(e.target.value, 10) || 15 },
                        })
                      }
                      className="bg-charcoal-950 font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Max Squad Size</label>
                    <Input
                      type="number"
                      value={editingTeam.purse.maxPlayers}
                      onChange={(e) =>
                        setEditingTeam({
                          ...editingTeam,
                          purse: { ...editingTeam.purse, maxPlayers: parseInt(e.target.value, 10) || 18 },
                        })
                      }
                      className="bg-charcoal-950 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingTeam(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="gold" size="sm" className="font-bold text-black">
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Add Team Modal */}
          {showAddModal && (
            <div className="p-6 rounded-2xl border-2 border-emerald-500/50 bg-charcoal-900 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-400" />
                  Register New Franchise for {activeLeague.name}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Franchise Name *</label>
                    <Input
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="e.g. Falnir Strikers"
                      required
                      className="bg-charcoal-950 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Short Code *</label>
                    <Input
                      value={newShortCode}
                      onChange={(e) => setNewShortCode(e.target.value.toUpperCase())}
                      placeholder="e.g. FST"
                      required
                      className="bg-charcoal-950 font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Franchise Owner</label>
                    <Input
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                      placeholder="e.g. Rajesh Shetty"
                      className="bg-charcoal-950 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Icon Player Name</label>
                    <Input
                      value={newIconName}
                      onChange={(e) => setNewIconName(e.target.value)}
                      placeholder="e.g. Ashwin Pai"
                      className="bg-charcoal-950 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Owner Photo URL</label>
                    <Input
                      value={newOwnerPhoto}
                      onChange={(e) => setNewOwnerPhoto(e.target.value)}
                      placeholder="https://... photo url"
                      className="bg-charcoal-950 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Icon Photo URL</label>
                    <Input
                      value={newIconPhoto}
                      onChange={(e) => setNewIconPhoto(e.target.value)}
                      placeholder="https://... photo url"
                      className="bg-charcoal-950 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Brand Color (Hex)</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={newPrimaryColor}
                        onChange={(e) => setNewPrimaryColor(e.target.value)}
                        className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
                      />
                      <Input
                        value={newPrimaryColor}
                        onChange={(e) => setNewPrimaryColor(e.target.value)}
                        className="bg-charcoal-950 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Initial Purse Budget</label>
                    <Input
                      type="number"
                      value={newPurse}
                      onChange={(e) => setNewPurse(parseInt(e.target.value, 10) || 5000000)}
                      className="bg-charcoal-950 font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Min Squad Size</label>
                    <Input
                      type="number"
                      value={newMinSquad}
                      onChange={(e) => setNewMinSquad(parseInt(e.target.value, 10) || 15)}
                      className="bg-charcoal-950 font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Max Squad Size</label>
                    <Input
                      type="number"
                      value={newMaxSquad}
                      onChange={(e) => setNewMaxSquad(parseInt(e.target.value, 10) || 18)}
                      className="bg-charcoal-950 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="gold" size="sm" className="font-bold text-black">
                    Register Franchise
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
