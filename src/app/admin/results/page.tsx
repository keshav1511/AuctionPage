"use client";

import { useState } from "react";
import Image from "next/image";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, getCategoryBadgeColor } from "@/lib/utils";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";
import { MOCK_TEAMS } from "@/lib/mock-data/teams";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";

export default function AdminResultsPage() {
  const [players, setPlayers] = useState(MOCK_PLAYERS);

  const getTeamName = (teamId?: string) => {
    if (!teamId) return "-";
    return MOCK_TEAMS.find((t) => t.id === teamId)?.name || "-";
  };

  const handleRequeue = (playerId: string) => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === playerId) {
          return { ...p, status: "AVAILABLE", soldToTeamId: undefined, soldPrice: undefined };
        }
        return p;
      })
    );
  };

  return (
    <div className="min-h-screen bg-[#070A0D] flex text-slate-100">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Auction Results & Reconciliation"
          subtitle="Review completed lots, finalize sales, or requeue unsold players for Round 2"
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto max-w-7xl">
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-charcoal-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-charcoal-950 border-b border-slate-800 text-slate-400 font-semibold uppercase">
                <tr>
                  <th className="p-3.5">Athlete</th>
                  <th className="p-3.5">Pool Tier</th>
                  <th className="p-3.5">Base Price</th>
                  <th className="p-3.5">Outcome</th>
                  <th className="p-3.5">Winning Team</th>
                  <th className="p-3.5">Sold Amount</th>
                  <th className="p-3.5 text-right">Reconciliation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {players.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                          <Image src={p.photoUrl} alt={p.fullName} fill className="object-cover" />
                        </div>
                        <span className="font-bold text-white">{p.fullName}</span>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <Badge
                        variant="gold"
                        className={`text-[10px] ${getCategoryBadgeColor(p.category)}`}
                      >
                        {p.category}
                      </Badge>
                    </td>

                    <td className="p-3.5 font-mono text-slate-400">
                      {formatCurrency(p.basePrice)}
                    </td>

                    <td className="p-3.5">
                      {p.status === "SOLD" && (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> SOLD
                        </span>
                      )}
                      {p.status === "UNSOLD" && (
                        <span className="inline-flex items-center gap-1 text-red-400 font-bold text-xs">
                          <XCircle className="w-3.5 h-3.5" /> UNSOLD
                        </span>
                      )}
                      {p.status === "AVAILABLE" && (
                        <span className="text-slate-500 font-medium">QUEUED</span>
                      )}
                      {p.status === "ON_AUCTION" && (
                        <span className="text-amber-400 font-bold">ON STAGE</span>
                      )}
                    </td>

                    <td className="p-3.5 font-bold text-white">
                      {getTeamName(p.soldToTeamId)}
                    </td>

                    <td className="p-3.5 font-mono font-bold text-emerald-400">
                      {p.soldPrice ? formatCurrency(p.soldPrice) : "-"}
                    </td>

                    <td className="p-3.5 text-right">
                      {p.status === "UNSOLD" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRequeue(p.id)}
                          className="h-7 text-[10px] gap-1 text-amber-300 border-amber-500/30"
                        >
                          <RotateCcw className="w-3 h-3" /> Requeue Round 2
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
