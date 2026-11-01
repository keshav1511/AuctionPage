"use client";

import { useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useLeague } from "@/lib/context/league-context";
import { Download, CheckCircle2, Shield } from "lucide-react";

export default function AdminReportsPage() {
  const { activeLeague, teams, players } = useLeague();
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const handleDownload = (teamName: string) => {
    const team = teams.find((t) => t.name === teamName);
    const squadPlayers = players.filter((p) => p.soldToTeamId === team?.id);

    let csv = "Registration No,Player Name,Role,Final Price (INR)\n";
    squadPlayers.forEach((p) => {
      csv += `${p.registrationNo},"${p.fullName}",${p.primaryRole},${p.soldPrice || p.basePrice}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${teamName.replace(/\s+/g, "_")}_Squad_Sheet.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadNotice(`Generated and downloaded official squad sheet for ${teamName}!`);
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Reports & Roster Exports"
          subtitle={`${activeLeague.name} • Export official squad sheets, financial ledgers, and audit reports`}
        />

        <main className="p-6 sm:p-8 space-y-6 max-w-6xl">
          {downloadNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {downloadNotice}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Franchise Squad Rosters</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate and download signed CSV squad sheets for each registered franchise.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {teams.map((team) => {
              const teamPlayers = players.filter((p) => p.soldToTeamId === team.id);
              const totalSpent = teamPlayers.reduce((acc, p) => acc + (p.soldPrice || 0), 0);
              const remaining = (team.purse?.totalBudget || 5000000) - totalSpent;

              return (
                <Card key={team.id} className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden hover:border-slate-300 transition-all flex flex-col justify-between">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                        {team.logoUrl ? (
                          <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
                        ) : (
                          <Shield className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-slate-900 truncate">{team.name}</h3>
                        <p className="text-[11px] text-slate-500">
                          {teamPlayers.length} / {team.purse?.maxPlayers || 18} Players Acquired
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Spent:</span>
                        <span className="font-mono font-bold text-slate-900">{formatCurrency(totalSpent)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Purse Left:</span>
                        <span className="font-mono font-bold text-emerald-700">{formatCurrency(remaining)}</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleDownload(team.name)}
                      size="sm"
                      variant="outline"
                      className="w-full gap-2 border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      Download Squad Sheet (CSV)
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
