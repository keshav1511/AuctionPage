"use client";

import Link from "next/link";
import { PublicNav } from "@/components/public/public-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useLeague } from "@/lib/context/league-context";
import {
  Tv,
  Users,
  ArrowRight,
  Sparkles,
  Sliders,
  MapPin,
  Calendar,
} from "lucide-react";

export default function HomePage() {
  const { activeLeague, teams, players } = useLeague();

  const totalPurseAllocated = teams.reduce((acc, t) => acc + t.purse.totalBudget, 0);
  const totalPurseSpent = teams.reduce((acc, t) => acc + t.purse.spentAmount, 0);
  const soldPlayers = players.filter((p) => p.status === "SOLD").length;

  return (
    <div className="min-h-screen bg-[#090D10] text-slate-100 flex flex-col">
      <PublicNav />

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden py-16 lg:py-24 border-b border-slate-800 stage-gradient">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wider uppercase">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {activeLeague.name} • Official Auction Portal
              </div>

              <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white uppercase leading-none">
                {activeLeague.name} <br />
                <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-500 bg-clip-text text-transparent">
                  Player Auction
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
                {activeLeague.description ||
                  "6 Franchises. 120+ Registered Athletes. Multi-Crore Purse Battles. Witness the live bidding wars, squad acquisitions, and dynamic purse fluctuations in real-time."}
              </p>

              <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-400" /> {activeLeague.matchVenue}
                </span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-400" /> Auction: {activeLeague.auctionDate} @ {activeLeague.auctionTime}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                <Button asChild size="lg" variant="gold" className="gap-2 shadow-amber-500/20 text-black font-bold">
                  <Link href="/live">
                    <Tv className="w-5 h-5 text-black" />
                    Enter Live Stage Screen
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="gap-2">
                  <Link href="/teams">
                    <Users className="w-5 h-5 text-emerald-400" />
                    View Team Purses
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="gap-2 text-slate-300">
                  <Link href="/admin/dashboard">
                    <Sliders className="w-4 h-4 text-slate-400" />
                    Admin Operations
                  </Link>
                </Button>
              </div>
            </div>

            {/* Quick Metrics Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-5xl mx-auto">
              <Card className="border-slate-800 bg-charcoal-900/60">
                <CardContent className="p-5 text-center">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Total Purse Pool
                  </p>
                  <p className="text-2xl font-black text-amber-400 font-mono mt-1">
                    {formatCurrency(totalPurseAllocated, true)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Allocated across teams</p>
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-charcoal-900/60">
                <CardContent className="p-5 text-center">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Purse Spent So Far
                  </p>
                  <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
                    {formatCurrency(totalPurseSpent, true)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Across 6 Franchises</p>
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-charcoal-900/60">
                <CardContent className="p-5 text-center">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Lots Hammered
                  </p>
                  <p className="text-2xl font-black text-white font-mono mt-1">
                    {soldPlayers} Players
                  </p>
                  <p className="text-[11px] text-emerald-400 mt-1 font-semibold">Active Round</p>
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-charcoal-900/60">
                <CardContent className="p-5 text-center">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Competing Teams
                  </p>
                  <p className="text-2xl font-black text-white font-mono mt-1">
                    {teams.length} Franchises
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">{activeLeague.matchVenue}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Franchises Spotlight Grid */}
        <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-black uppercase text-white tracking-wide">
                Competing Franchises
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Official teams registered for {activeLeague.name}
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/teams">
                All Squads <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <Card
                key={team.id}
                className="border-slate-800 bg-charcoal-900/80 hover:border-emerald-500/40 transition-all hover:-translate-y-1"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl border border-white/20 flex items-center justify-center font-bold text-white text-lg shadow-md"
                        style={{ backgroundColor: team.primaryColor }}
                      >
                        {team.shortCode}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">{team.name}</h3>
                        <p className="text-xs text-slate-400">Owner: {team.ownerName}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {team.squadCount} / {team.purse.maxPlayers}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Remaining Budget</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatCurrency(team.purse.remainingAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Spent Amount</span>
                      <span className="font-mono text-slate-300">
                        {formatCurrency(team.purse.spentAmount)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-charcoal-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 {activeLeague.name}. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/live" className="hover:text-emerald-400 transition-colors">
              Live Stage
            </Link>
            <Link href="/teams" className="hover:text-emerald-400 transition-colors">
              Franchises
            </Link>
            <Link href="/results" className="hover:text-emerald-400 transition-colors">
              Results
            </Link>
            <Link href="/admin/login" className="hover:text-amber-400 transition-colors">
              Admin Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
