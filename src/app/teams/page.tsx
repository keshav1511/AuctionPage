"use client";

import { useState } from "react";
import Image from "next/image";
import { PublicNav } from "@/components/public/public-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { MOCK_TEAMS } from "@/lib/mock-data/teams";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";
import { useLeague } from "@/lib/context/league-context";
import { Users } from "lucide-react";

export default function TeamsPage() {
  const { activeLeague } = useLeague();
  const [selectedTeamId, setSelectedTeamId] = useState<string>(MOCK_TEAMS[0].id);

  const selectedTeam = MOCK_TEAMS.find((t) => t.id === selectedTeamId) || MOCK_TEAMS[0];
  const acquiredPlayers = MOCK_PLAYERS.filter((p) => p.soldToTeamId === selectedTeam.id);

  return (
    <div className="min-h-screen bg-[#090D10] text-slate-100 flex flex-col">
      <PublicNav />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Header */}
        <div className="mb-8">
          <Badge variant="gold" className="text-xs font-mono uppercase mb-2">
            {activeLeague.name} Franchises
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
            Teams & Purse Allocation
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Official franchises registered for {activeLeague.name} at {activeLeague.matchVenue}.
          </p>
        </div>

        {/* Team Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {MOCK_TEAMS.map((team) => {
            const isSelected = team.id === selectedTeamId;
            return (
              <button
                key={team.id}
                onClick={() => setSelectedTeamId(team.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "bg-emerald-950/60 border-emerald-500 shadow-lg shadow-emerald-950/50"
                    : "bg-charcoal-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-black text-xs text-amber-400">
                    {team.shortCode}
                  </div>
                  <span className="font-bold text-xs text-white truncate">
                    {team.shortCode}
                  </span>
                </div>
                <div className="font-mono text-xs font-bold text-emerald-400">
                  {formatCurrency(team.purse.remainingAmount, true)}
                </div>
                <div className="text-[10px] text-slate-400">
                  {team.squadCount}/18 Players
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Team Detail View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Team Profile & Financials */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-slate-800 bg-charcoal-900">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-amber-500/40 flex items-center justify-center font-black text-2xl text-amber-400">
                    {selectedTeam.shortCode}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white">{selectedTeam.name}</h2>
                    <p className="text-xs text-slate-400">Owner: {selectedTeam.ownerName}</p>
                    <p className="text-xs text-emerald-400 mt-0.5">
                      Icon Player: {selectedTeam.iconPlayerName}
                    </p>
                  </div>
                </div>

                {/* Purse Utilization Breakdown */}
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Purse Ledger
                  </h3>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Total Allotted Budget</span>
                      <span className="font-mono font-bold text-white">
                        {formatCurrency(selectedTeam.purse.totalBudget)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Spent on Squad</span>
                      <span className="font-mono font-bold text-amber-400">
                        {formatCurrency(selectedTeam.purse.spentAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Reserved for Squad Minimum</span>
                      <span className="font-mono text-slate-400">
                        {formatCurrency(selectedTeam.purse.reservedForSquad)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-slate-800">
                      <span className="font-bold text-white">Remaining Active Purse</span>
                      <span className="font-mono font-black text-emerald-400">
                        {formatCurrency(selectedTeam.purse.remainingAmount)}
                      </span>
                    </div>
                  </div>

                  <Progress
                    value={
                      (selectedTeam.purse.spentAmount / selectedTeam.purse.totalBudget) * 100
                    }
                    className="h-2 bg-slate-800"
                    indicatorClassName="bg-gradient-to-r from-emerald-500 to-amber-400"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Acquired Players Roster */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-white uppercase tracking-wide">
                Signed Squad Roster ({acquiredPlayers.length})
              </h3>
              <Badge variant="outline" className="font-mono text-xs">
                Minimum Required: 15
              </Badge>
            </div>

            {acquiredPlayers.length === 0 ? (
              <Card className="border-slate-800 bg-charcoal-900/40 p-8 text-center text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                <p className="text-sm">No players acquired yet in active lot.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {acquiredPlayers.map((p) => (
                  <Card
                    key={p.id}
                    className="border-slate-800 bg-charcoal-900 hover:border-slate-700 transition-colors"
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-800 shrink-0">
                          <Image
                            src={p.photoUrl}
                            alt={p.fullName}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{p.fullName}</h4>
                          <p className="text-xs text-slate-400">
                            {p.category} • {p.primaryRole}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase">Winning Bid</span>
                        <p className="font-mono font-bold text-emerald-400 text-sm">
                          {formatCurrency(p.soldPrice || p.basePrice)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
