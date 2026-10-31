"use client";

import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { MOCK_TEAMS } from "@/lib/mock-data/teams";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";
import { MOCK_AUCTION_SESSION } from "@/lib/mock-data/auction";
import {
  Gavel,
  Users,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Play,
  ArrowRight,
  Shield,
} from "lucide-react";

export default function AdminDashboardPage() {
  const totalPurse = MOCK_TEAMS.reduce((acc, t) => acc + t.purse.totalBudget, 0);
  const spentPurse = MOCK_TEAMS.reduce((acc, t) => acc + t.purse.spentAmount, 0);
  const remainingPurse = totalPurse - spentPurse;
  const soldCount = MOCK_PLAYERS.filter((p) => p.status === "SOLD").length;
  const availableCount = MOCK_PLAYERS.filter((p) => p.status === "AVAILABLE").length;

  return (
    <div className="min-h-screen bg-[#070A0D] flex text-slate-100">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Executive Operations Dashboard"
          subtitle="Nalanda Turf League • Season 1 Real-Time Telemetry"
          action={
            <Button asChild variant="gold" size="sm" className="gap-2 font-bold text-black">
              <Link href="/admin/auction-control">
                <Play className="w-3.5 h-3.5 fill-black" />
                Launch Live Controls
              </Link>
            </Button>
          }
        />

        <main className="p-8 space-y-8 flex-1 overflow-y-auto max-w-7xl">
          {/* Active Lot Status Banner */}
          <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-charcoal-900 to-charcoal-950 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                <Gavel className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white">Live Lot In Progress</h3>
                  <Badge variant="live" className="text-[10px]">
                    SESSION ACTIVE
                  </Badge>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Spotlight: <strong className="text-white">{MOCK_AUCTION_SESSION.currentPlayer?.fullName}</strong> • Current High Bid:{" "}
                  <strong className="text-amber-400 font-mono">
                    {formatCurrency(MOCK_AUCTION_SESSION.currentHighestBid)}
                  </strong>
                </p>
              </div>
            </div>

            <Button asChild variant="stage" className="gap-2 border-emerald-500/40">
              <Link href="/admin/auction-control">
                Open Control Desk <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-slate-800 bg-charcoal-900/80">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase">
                    Spent Budget
                  </span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    {formatCurrency(spentPurse, true)}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {((spentPurse / totalPurse) * 100).toFixed(1)}% of total league purse
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-charcoal-900/80">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase">
                    Remaining Purse
                  </span>
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-amber-400">
                    {formatCurrency(remainingPurse, true)}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">Available across 6 franchises</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-charcoal-900/80">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase">
                    Players Sold
                  </span>
                  <Users className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-white">
                    {soldCount} / {MOCK_PLAYERS.length}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {availableCount} lots remaining in catalog
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-charcoal-900/80">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase">
                    Average Lot Price
                  </span>
                  <Shield className="w-4 h-4 text-purple-400" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-white">
                    {formatCurrency(soldCount > 0 ? spentPurse / soldCount : 0)}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">Across finalized transactions</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Shortcuts & Franchise Summaries */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Franchise Budget Health */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black uppercase text-white tracking-wide">
                  Franchise Budget Health
                </h3>
                <Link
                  href="/admin/teams"
                  className="text-xs font-semibold text-emerald-400 hover:underline"
                >
                  Manage Purses →
                </Link>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-charcoal-900">
                <table className="w-full text-left text-xs">
                  <thead className="bg-charcoal-950 border-b border-slate-800 text-slate-400 font-semibold uppercase">
                    <tr>
                      <th className="p-3.5">Franchise</th>
                      <th className="p-3.5">Squad</th>
                      <th className="p-3.5">Spent</th>
                      <th className="p-3.5">Remaining Purse</th>
                      <th className="p-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {MOCK_TEAMS.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="p-3.5 font-bold text-white flex items-center gap-2">
                          <span className="w-6 h-6 rounded bg-slate-800 text-amber-400 flex items-center justify-center font-black text-[10px]">
                            {t.shortCode}
                          </span>
                          {t.name}
                        </td>
                        <td className="p-3.5 font-mono text-slate-300">
                          {t.squadCount} / {t.purse.maxPlayers}
                        </td>
                        <td className="p-3.5 font-mono text-slate-300">
                          {formatCurrency(t.purse.spentAmount)}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-emerald-400">
                          {formatCurrency(t.purse.remainingAmount)}
                        </td>
                        <td className="p-3.5 text-right">
                          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                            Eligible to Bid
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Quick Admin Utilities */}
            <div className="lg:col-span-4 space-y-4">
              <h3 className="text-base font-black uppercase text-white tracking-wide">
                Quick Actions
              </h3>

              <div className="space-y-3">
                <Link
                  href="/admin/players"
                  className="p-4 rounded-xl border border-slate-800 bg-charcoal-900 hover:border-emerald-500/50 block transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="font-bold text-white text-sm">Google Sheets Ingestion</h4>
                      <p className="text-xs text-slate-400">
                        Synchronize player registrations & stats
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  href="/admin/settings"
                  className="p-4 rounded-xl border border-slate-800 bg-charcoal-900 hover:border-amber-500/50 block transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <h4 className="font-bold text-white text-sm">Configure Bid Slabs</h4>
                      <p className="text-xs text-slate-400">
                        Adjust tier base prices & minimum increments
                      </p>
                    </div>
                  </div>
                </Link>

                <Link
                  href="/admin/reports"
                  className="p-4 rounded-xl border border-slate-800 bg-charcoal-900 hover:border-purple-500/50 block transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-purple-400 shrink-0" />
                    <div>
                      <h4 className="font-bold text-white text-sm">Download Sheets</h4>
                      <p className="text-xs text-slate-400">
                        Export team-wise signed rosters & financials
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
