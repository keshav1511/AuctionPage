"use client";

import { useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { MOCK_TEAMS } from "@/lib/mock-data/teams";
import { Team } from "@/types";
import { Plus, Edit2, Check } from "lucide-react";

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>(MOCK_TEAMS);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editBudget, setEditBudget] = useState<string>("");

  const startEditing = (team: Team) => {
    setEditingTeamId(team.id);
    setEditBudget(team.purse.totalBudget.toString());
  };

  const saveBudget = (teamId: string) => {
    const newBudget = parseInt(editBudget, 10);
    if (!isNaN(newBudget) && newBudget > 0) {
      setTeams((prev) =>
        prev.map((t) => {
          if (t.id === teamId) {
            return {
              ...t,
              purse: {
                ...t.purse,
                totalBudget: newBudget,
                remainingAmount: newBudget - t.purse.spentAmount,
              },
            };
          }
          return t;
        })
      );
    }
    setEditingTeamId(null);
  };

  return (
    <div className="min-h-screen bg-[#070A0D] flex text-slate-100">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Franchise & Purse Management"
          subtitle="Configure team budgets, squad limits, owner details, and team crests"
          action={
            <Button variant="default" size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> Add New Franchise
            </Button>
          }
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <Card key={team.id} className="border-slate-800 bg-charcoal-900">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-amber-400 text-lg">
                        {team.shortCode}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">{team.name}</h3>
                        <p className="text-xs text-slate-400">{team.ownerName}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {team.squadCount}/18
                    </Badge>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-slate-800 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Total Purse Budget:</span>
                      {editingTeamId === team.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={editBudget}
                            onChange={(e) => setEditBudget(e.target.value)}
                            className="h-7 w-28 text-xs font-mono"
                          />
                          <button
                            onClick={() => saveBudget(team.id)}
                            className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white">
                            {formatCurrency(team.purse.totalBudget)}
                          </span>
                          <button
                            onClick={() => startEditing(team)}
                            className="text-slate-500 hover:text-slate-300"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Spent on Players:</span>
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
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
