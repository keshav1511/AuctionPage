"use client";

import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useLeague } from "@/lib/context/league-context";
import { MOCK_TEAMS } from "@/lib/mock-data/teams";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";
import {
  Gavel,
  Users,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Play,
  Shield,
  CheckCircle2,
  AlertCircle,
  Calendar,
  MapPin,
  Clock,
  FolderSync,
  Layers,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { activeLeague } = useLeague();

  const totalPurse = MOCK_TEAMS.reduce((acc, t) => acc + t.purse.totalBudget, 0);
  const spentPurse = MOCK_TEAMS.reduce((acc, t) => acc + t.purse.spentAmount, 0);
  const remainingPurse = totalPurse - spentPurse;
  const soldCount = MOCK_PLAYERS.filter((p) => p.status === "SOLD").length;
  const availableCount = MOCK_PLAYERS.filter((p) => p.status === "AVAILABLE").length;
  const matchedPhotosCount = MOCK_PLAYERS.filter(
    (p) => p.photoMatchStatus === "MATCHED" || p.photoMatchStatus === "MANUAL_OVERRIDE" || p.photoUrl
  ).length;
  const missingPhotosCount = Math.max(0, MOCK_PLAYERS.length - matchedPhotosCount);

  // Pre-Auction Readiness Checklist Rules
  const checklist = [
    { label: "Minimum 2 Franchises Configured", passed: MOCK_TEAMS.length >= 2, count: `${MOCK_TEAMS.length} Teams` },
    { label: "Player Registry Imported & Approved", passed: MOCK_PLAYERS.length >= 8, count: `${MOCK_PLAYERS.length} Players` },
    { label: "Player Photographs Normalized (3:4 WebP)", passed: matchedPhotosCount >= 6, count: `${matchedPhotosCount}/${MOCK_PLAYERS.length}` },
    { label: "Dynamic Bid Slabs & Extension Timers Set", passed: true, count: "Configured" },
    { label: "Match Venue & Schedule Published", passed: Boolean(activeLeague.matchVenue && activeLeague.auctionDate), count: activeLeague.matchVenue || "Pending" },
  ];

  const allChecklistPassed = checklist.every((c) => c.passed);

  return (
    <div className="min-h-screen bg-[#070A0D] flex text-slate-100">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Executive Operations Dashboard"
          subtitle={`${activeLeague.name} • Live Auction Telemetry & Readiness Control`}
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
          {/* Module 8: League Configuration Summary Card */}
          <div className="rounded-2xl border-2 border-slate-800 bg-charcoal-900 p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-xl border border-white/20"
                  style={{ backgroundColor: activeLeague.primaryColor }}
                >
                  {activeLeague.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-bold text-amber-400 tracking-wider">
                      TOURNAMENT PROFILE
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {activeLeague.slug}
                    </Badge>
                  </div>
                  <h2 className="text-2xl font-black text-white">{activeLeague.name}</h2>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      {activeLeague.matchVenue || "Falnir Turf"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      Match: {activeLeague.matchDate || "TBD"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      Auction: {activeLeague.auctionDate || "TBD"} @ {activeLeague.auctionTime || "18:00"} ({activeLeague.timezone || "IST"})
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild variant="outline" size="sm" className="gap-2 text-xs">
                  <Link href="/admin/leagues">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    Configure League
                  </Link>
                </Button>
                <Button asChild variant="gold" size="sm" className="gap-2 font-bold text-black text-xs">
                  <Link href="/admin/auction-control">
                    <Gavel className="w-3.5 h-3.5 fill-black" />
                    Open Live Desk
                  </Link>
                </Button>
              </div>
            </div>

            {/* Service Connection Status Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800 text-xs">
              <div className="p-3 rounded-xl bg-charcoal-950 border border-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-300">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Google Sheets
                </span>
                <span className="font-mono text-[11px] text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Ingestion Ready
                </span>
              </div>

              <div className="p-3 rounded-xl bg-charcoal-950 border border-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-300">
                  <FolderSync className="w-4 h-4 text-amber-400" /> Google Drive
                </span>
                <span className="font-mono text-[11px] text-amber-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Verified Snapshot
                </span>
              </div>

              <div className="p-3 rounded-xl bg-charcoal-950 border border-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-300">
                  <Shield className="w-4 h-4 text-cyan-400" /> Database & RLS
                </span>
                <span className="font-mono text-[11px] text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Schema Phase 2
                </span>
              </div>
            </div>
          </div>

          {/* Module 8: Pre-Auction Readiness Checklist */}
          <Card className="border-slate-800 bg-charcoal-900">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black uppercase text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    Pre-Auction Readiness Checklist
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Operational verification required before starting live stage broadcast
                  </p>
                </div>

                <Badge
                  variant={allChecklistPassed ? "default" : "outline"}
                  className={allChecklistPassed ? "bg-emerald-600 text-xs px-3 py-1 font-bold" : "text-amber-400 text-xs"}
                >
                  {allChecklistPassed ? "READY FOR LIVE AUCTION" : "CONFIGURATION PENDING"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {checklist.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-charcoal-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      {item.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span className="text-slate-200">{item.label}</span>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {item.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
                  <p className="text-[11px] text-slate-500 mt-1">Across 6 registered franchises</p>
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
                    3:4 Photos Matched
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-black font-mono text-white">
                    {matchedPhotosCount} / {MOCK_PLAYERS.length}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {missingPhotosCount === 0 ? "100% Photos Linked" : `${missingPhotosCount} missing photographs`}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
