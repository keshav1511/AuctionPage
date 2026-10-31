"use client";

import { useState } from "react";
import Image from "next/image";
import { PublicNav } from "@/components/public/public-nav";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatRole, getCategoryBadgeColor } from "@/lib/utils";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";
import { MOCK_TEAMS } from "@/lib/mock-data/teams";
import { Search, CheckCircle2, XCircle, Clock } from "lucide-react";

export default function ResultsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const filteredPlayers = MOCK_PLAYERS.filter((player) => {
    const matchesSearch =
      player.fullName.toLowerCase().includes(search.toLowerCase()) ||
      player.registrationNo.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || player.status === statusFilter;
    const matchesCategory = categoryFilter === "ALL" || player.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getTeamName = (teamId?: string) => {
    if (!teamId) return null;
    return MOCK_TEAMS.find((t) => t.id === teamId)?.name || "Franchise";
  };

  return (
    <div className="min-h-screen bg-[#090D10] text-slate-100 flex flex-col">
      <PublicNav />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <div className="mb-8">
          <Badge variant="gold" className="text-xs font-mono uppercase mb-2">
            Auction Ledger
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
            Player Results & Directory
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time catalog of all registered athletes, final prices, and acquiring franchises.
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mb-8">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by player name or registration no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-charcoal-900 border-slate-800"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-charcoal-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Lot Statuses</option>
              <option value="SOLD">Sold Only</option>
              <option value="UNSOLD">Unsold Only</option>
              <option value="AVAILABLE">Upcoming Lots</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-charcoal-900 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Categories</option>
              <option value="ICON">Icon Pool</option>
              <option value="PLATINUM">Platinum Pool</option>
              <option value="GOLD">Gold Pool</option>
              <option value="SILVER">Silver Pool</option>
              <option value="EMERGING">Emerging Pool</option>
            </select>
          </div>
        </div>

        {/* Catalog Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-charcoal-900/60 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-charcoal-950/80 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-4 px-6">Player</th>
                  <th className="py-4 px-4">Category & Role</th>
                  <th className="py-4 px-4">Base Price</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-6 text-right">Winning Price / Team</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                          <Image
                            src={player.photoUrl}
                            alt={player.fullName}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{player.fullName}</p>
                          <p className="font-mono text-xs text-slate-400">
                            {player.registrationNo}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="gold"
                          className={`text-[10px] ${getCategoryBadgeColor(player.category)}`}
                        >
                          {player.category}
                        </Badge>
                        <span className="text-xs text-slate-300">
                          {formatRole(player.primaryRole)}
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-4 font-mono text-slate-300">
                      {formatCurrency(player.basePrice)}
                    </td>

                    <td className="py-4 px-4">
                      {player.status === "SOLD" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" /> SOLD
                        </span>
                      )}
                      {player.status === "UNSOLD" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                          <XCircle className="w-3.5 h-3.5" /> UNSOLD
                        </span>
                      )}
                      {player.status === "ON_AUCTION" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                          <Clock className="w-3.5 h-3.5" /> ON STAGE
                        </span>
                      )}
                      {player.status === "AVAILABLE" && (
                        <span className="text-xs text-slate-500 font-medium">QUEUED</span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-right font-mono">
                      {player.soldPrice ? (
                        <div>
                          <p className="font-black text-emerald-400 text-sm">
                            {formatCurrency(player.soldPrice)}
                          </p>
                          <p className="text-[11px] font-sans text-amber-300">
                            {getTeamName(player.soldToTeamId)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
