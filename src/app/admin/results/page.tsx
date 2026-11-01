"use client";

import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatRole } from "@/lib/utils";
import { useLeague } from "@/lib/context/league-context";
import { CheckCircle2, XCircle, RotateCcw, Award, User } from "lucide-react";

export default function AdminResultsPage() {
  const { activeLeague, players, updatePlayer, teams } = useLeague();

  const getTeamName = (teamId?: string) => {
    if (!teamId) return "-";
    return teams.find((t) => t.id === teamId)?.name || "-";
  };

  const handleRequeue = (playerId: string) => {
    updatePlayer(playerId, {
      status: "AVAILABLE",
      soldToTeamId: undefined,
      soldPrice: undefined,
    });
  };

  const soldCount = players.filter((p) => p.status === "SOLD").length;
  const unsoldCount = players.filter((p) => p.status === "UNSOLD").length;
  const pendingCount = players.filter((p) => p.status === "AVAILABLE").length;

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Auction Results & Ledger"
          subtitle={`${activeLeague.name} • Reconcile sales, verify contracts, or requeue unsold lots`}
        />

        <main className="p-6 sm:p-8 space-y-6 max-w-6xl">
          {/* Summary Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium">Sold Lots</span>
                <div className="text-2xl font-bold text-slate-900 mt-1">{soldCount}</div>
              </div>
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium">Unsold Lots</span>
                <div className="text-2xl font-bold text-slate-900 mt-1">{unsoldCount}</div>
              </div>
              <XCircle className="w-6 h-6 text-amber-600" />
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium">Pending Lots</span>
                <div className="text-2xl font-bold text-slate-900 mt-1">{pendingCount}</div>
              </div>
              <Award className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="p-3 pl-4">Player</th>
                  <th className="p-3">Playing Role</th>
                  <th className="p-3">Base Price</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Winning Franchise</th>
                  <th className="p-3">Final Amount</th>
                  <th className="p-3 text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {players.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 pl-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt={p.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{p.fullName}</div>
                          <div className="font-mono text-[10px] text-slate-400">{p.registrationNo}</div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 text-slate-600 font-medium">
                      {formatRole(p.primaryRole)}
                    </td>

                    <td className="p-3 font-mono text-slate-600">
                      {formatCurrency(p.basePriceOverride || p.basePrice)}
                    </td>

                    <td className="p-3">
                      {p.status === "SOLD" ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                          SOLD
                        </Badge>
                      ) : p.status === "UNSOLD" ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
                          UNSOLD
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">
                          AVAILABLE
                        </Badge>
                      )}
                    </td>

                    <td className="p-3 font-semibold text-slate-800">
                      {getTeamName(p.soldToTeamId)}
                    </td>

                    <td className="p-3 font-mono font-bold text-slate-900">
                      {p.soldPrice ? formatCurrency(p.soldPrice) : "-"}
                    </td>

                    <td className="p-3 text-right pr-4">
                      {p.status === "UNSOLD" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequeue(p.id)}
                          className="text-[11px] h-7 border-slate-200 text-slate-700 hover:bg-slate-100 gap-1 font-medium"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Requeue
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {players.length === 0 && (
              <div className="p-12 text-center text-slate-400 text-xs">
                No players in roster. Import players in Player Pool Management to track auction results.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
