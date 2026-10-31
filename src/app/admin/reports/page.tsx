"use client";

import { useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { MOCK_TEAMS } from "@/lib/mock-data/teams";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";
import { Download, CheckCircle2 } from "lucide-react";

export default function AdminReportsPage() {
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const handleDownload = (teamName: string) => {
    // Generate simple CSV payload for download
    const team = MOCK_TEAMS.find((t) => t.name === teamName);
    const players = MOCK_PLAYERS.filter((p) => p.soldToTeamId === team?.id);

    let csv = "Registration No,Player Name,Category,Role,Final Price (INR)\n";
    players.forEach((p) => {
      csv += `${p.registrationNo},"${p.fullName}",${p.category},${p.primaryRole},${p.soldPrice || p.basePrice}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${teamName.replace(/\s+/g, "_")}_Squad_Sheet.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadNotice(`Generated and downloaded ${teamName} squad sheet!`);
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#070A0D] flex text-slate-100">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Reports & Team-Wise Sheets"
          subtitle="Export official signed rosters, financial ledgers, and auction audit sheets"
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto max-w-7xl">
          {downloadNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {downloadNotice}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MOCK_TEAMS.map((team) => {
              const teamPlayers = MOCK_PLAYERS.filter((p) => p.soldToTeamId === team.id);

              return (
                <Card key={team.id} className="border-slate-800 bg-charcoal-900">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-amber-400">
                          {team.shortCode}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">{team.name}</h3>
                          <p className="text-xs text-slate-400">Owner: {team.ownerName}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Acquired Squad:</span>
                        <span className="font-bold text-white font-mono">
                          {teamPlayers.length} Players
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Spent:</span>
                        <span className="font-bold text-amber-400 font-mono">
                          {formatCurrency(team.purse.spentAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Purse Surplus:</span>
                        <span className="font-bold text-emerald-400 font-mono">
                          {formatCurrency(team.purse.remainingAmount)}
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleDownload(team.name)}
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 border-slate-700 hover:border-emerald-500 text-xs"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      Download Squad CSV Sheet
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
