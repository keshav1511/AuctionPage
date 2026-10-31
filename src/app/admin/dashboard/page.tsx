"use client";

import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useLeague } from "@/lib/context/league-context";
import {
  Gavel,
  Users,
  DollarSign,
  FileSpreadsheet,
  Play,
  CheckCircle2,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  Trophy,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { activeLeague, teams, players } = useLeague();

  const totalPurse = teams.reduce((acc, t) => acc + (t.purse?.totalBudget || 5000000), 0);
  const spentPurse = teams.reduce((acc, t) => acc + (t.purse?.spentAmount || 0), 0);
  const remainingPurse = totalPurse - spentPurse;

  const soldCount = players.filter((p) => p.status === "SOLD").length;
  const availableCount = players.filter((p) => p.status === "AVAILABLE").length;
  const matchedPhotosCount = players.filter(
    (p) => p.photoMatchStatus === "MATCHED" || p.photoMatchStatus === "MANUAL_OVERRIDE" || p.photoUrl
  ).length;

  // 5-Point Setup Checklist
  const checklist = [
    {
      title: "Tournament Profile & Schedule",
      subtitle: `${activeLeague.matchVenue || "Venue TBD"} • ${activeLeague.auctionDate || "Date TBD"}`,
      passed: Boolean(activeLeague.matchVenue && activeLeague.auctionDate),
      href: "/admin/setup",
      actionLabel: "Configure",
    },
    {
      title: "Franchise Teams Registered",
      subtitle: `${teams.length} teams registered with logos & purse`,
      passed: teams.length >= 2,
      href: "/admin/teams",
      actionLabel: "Manage Teams",
    },
    {
      title: "Player Registry & Categories",
      subtitle: `${players.length} players imported via Sheets / Excel`,
      passed: players.length >= 10,
      href: "/admin/players",
      actionLabel: "Import Roster",
    },
    {
      title: "Player & Owner Photographs",
      subtitle: `${matchedPhotosCount}/${players.length} photos verified from Drive`,
      passed: matchedPhotosCount >= 6,
      href: "/admin/players",
      actionLabel: "Match Photos",
    },
    {
      title: "Bid Slabs & Timer Settings",
      subtitle: "Authoritative slabs, base prices, and countdowns active",
      passed: true,
      href: "/admin/settings",
      actionLabel: "Review Rules",
    },
  ];

  const allPassed = checklist.every((c) => c.passed);

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Overview & Tournament Setup"
          subtitle={`${activeLeague.name} • Executive Dashboard`}
          action={
            <Button asChild size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm">
              <Link href="/admin/auction-control">
                <Play className="w-3.5 h-3.5 fill-white" />
                Live Auction Desk
              </Link>
            </Button>
          }
        />

        <main className="p-6 sm:p-8 space-y-6 max-w-6xl">
          {/* Tournament Identity Banner */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-sm overflow-hidden"
                style={{ backgroundColor: activeLeague.primaryColor || "#059669" }}
              >
                {activeLeague.logoUrl ? (
                  <img src={activeLeague.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  activeLeague.name.charAt(0)
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-600 bg-slate-50 border-slate-200">
                    Active Tournament
                  </Badge>
                  <span className="text-xs text-slate-400 font-mono">ID: {activeLeague.slug}</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">{activeLeague.name}</h2>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {activeLeague.matchVenue || "Venue TBD"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Auction Date: {activeLeague.auctionDate || "TBD"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Time: {activeLeague.auctionTime || "18:00"} ({activeLeague.timezone || "IST"})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="sm" className="border-slate-300 text-slate-700 hover:bg-slate-50 text-xs">
                <Link href="/admin/setup">Edit Setup</Link>
              </Button>
              <Button asChild size="sm" className="bg-slate-900 hover:bg-slate-800 text-white text-xs">
                <Link href="/admin/auction-control">Start Auction</Link>
              </Button>
            </div>
          </div>

          {/* Metric Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Registered Teams</span>
                  <Users className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{teams.length}</div>
                <p className="text-[11px] text-slate-500">Official Franchises</p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Player Registry</span>
                  <Trophy className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{players.length}</div>
                <div className="text-[11px] text-slate-500 flex gap-2">
                  <span className="text-emerald-700 font-semibold">{soldCount} Sold</span>
                  <span>•</span>
                  <span>{availableCount} Available</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Photographs Matched</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {matchedPhotosCount} <span className="text-xs text-slate-400 font-normal">/ {players.length}</span>
                </div>
                <p className="text-[11px] text-slate-500">Verified from Google Drive</p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-slate-200 shadow-sm rounded-xl">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Total Purse Budget</span>
                  <DollarSign className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900 font-mono">
                  {formatCurrency(totalPurse, true)}
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  {formatCurrency(remainingPurse, true)} Remaining
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Pre-Auction Readiness Checklist */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Pre-Auction Readiness Checklist</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete these steps to ensure smooth real-time bidding on auction day.
                </p>
              </div>
              <Badge
                variant="outline"
                className={`text-xs font-semibold px-2.5 py-1 ${
                  allPassed
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {allPassed ? "Auction Ready" : "Setup In Progress"}
              </Badge>
            </div>

            <div className="divide-y divide-slate-100">
              {checklist.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${
                        item.passed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {item.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">{item.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                    </div>
                  </div>

                  <Button asChild size="sm" variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs shrink-0">
                    <Link href={item.href} className="gap-1.5">
                      {item.actionLabel}
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Fast Navigation Shortcuts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/admin/teams"
              className="p-5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between"
            >
              <div className="space-y-1">
                <Users className="w-5 h-5 text-slate-600" />
                <h4 className="text-xs font-bold text-slate-900 mt-2">Manage Teams</h4>
                <p className="text-[11px] text-slate-500">Add franchises, upload logos, set purse and squad sizes.</p>
              </div>
              <span className="text-xs text-slate-700 font-semibold mt-3 inline-flex items-center gap-1">
                Open Teams <ArrowRight className="w-3 h-3 text-slate-400" />
              </span>
            </Link>

            <Link
              href="/admin/players"
              className="p-5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between"
            >
              <div className="space-y-1">
                <FileSpreadsheet className="w-5 h-5 text-slate-600" />
                <h4 className="text-xs font-bold text-slate-900 mt-2">Import Players</h4>
                <p className="text-[11px] text-slate-500">Sync from Google Sheets or Excel and match photos from Drive.</p>
              </div>
              <span className="text-xs text-slate-700 font-semibold mt-3 inline-flex items-center gap-1">
                Open Players <ArrowRight className="w-3 h-3 text-slate-400" />
              </span>
            </Link>

            <Link
              href="/admin/settings"
              className="p-5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between"
            >
              <div className="space-y-1">
                <Gavel className="w-5 h-5 text-slate-600" />
                <h4 className="text-xs font-bold text-slate-900 mt-2">Auction Slabs & Rules</h4>
                <p className="text-[11px] text-slate-500">Configure bid increment rules, category base prices, and countdowns.</p>
              </div>
              <span className="text-xs text-slate-700 font-semibold mt-3 inline-flex items-center gap-1">
                Open Settings <ArrowRight className="w-3 h-3 text-slate-400" />
              </span>
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
