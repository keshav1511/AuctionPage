"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import confetti from "canvas-confetti";
import { BroadcastHeader } from "@/components/public/broadcast-header";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  formatCurrency,
  formatRole,
  getCategoryBadgeColor,
  getRoleBadgeColor,
} from "@/lib/utils";
import { MOCK_AUCTION_SESSION } from "@/lib/mock-data/auction";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";
import { useLeague } from "@/lib/context/league-context";
import {
  TrendingUp,
  Award,
  Sparkles,
  Zap,
} from "lucide-react";

export default function LiveAuctionStage() {
  const { activeLeague, teams, players } = useLeague();
  const [session] = useState(MOCK_AUCTION_SESSION);
  const [timer, setTimer] = useState(session.timerSeconds);
  const [isHammered, setIsHammered] = useState(false);

  // Countdown timer simulation
  useEffect(() => {
    if (timer <= 0 || isHammered) return;
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timer, isHammered]);

  const player = session.currentPlayer || players[0] || MOCK_PLAYERS[0];
  const leadingTeam = session.currentLeadingTeam || teams[0];

  // Trigger celebratory confetti when sold
  const triggerSoldCelebration = () => {
    setIsHammered(true);
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 },
      colors: ["#F59E0B", "#10B981", "#FFFFFF", "#FBBF24"],
    });
  };

  return (
    <div className="min-h-screen bg-[#070A0D] text-slate-100 flex flex-col overflow-x-hidden select-none">
      <BroadcastHeader />

      {/* Main Broadcast Stage Canvas */}
      <main className="flex-1 p-4 lg:p-8 flex flex-col justify-between max-w-[1920px] mx-auto w-full">
        {/* Top Grid: Player Spotlight + High Bid & Timer Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* LEFT: Player Spotlight (Lot Card) */}
          <div className="lg:col-span-7 bg-charcoal-900/90 rounded-2xl border-2 border-slate-800 p-6 lg:p-8 flex flex-col justify-between relative overflow-hidden shadow-2xl backdrop-blur-md">
            {/* Background subtle watermark */}
            <div className="absolute -right-12 -bottom-12 opacity-5 pointer-events-none text-9xl font-black">
              {activeLeague.name.charAt(0)}
            </div>

            {/* Top Bar of Card: Registration No, Lot, Category */}
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 font-mono text-sm font-bold text-emerald-400">
                  {player.registrationNo}
                </span>
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                  Lot #1 • Round {session.round}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="gold"
                  className={`text-xs px-3 py-1 font-bold ${getCategoryBadgeColor(
                    player.category
                  )}`}
                >
                  {player.category}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-xs px-3 py-1 font-semibold ${getRoleBadgeColor(
                    player.primaryRole
                  )}`}
                >
                  {formatRole(player.primaryRole)}
                </Badge>
              </div>
            </div>

            {/* Middle Section: Player Photo & Profile Details */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 my-6 items-center z-10">
              {/* Photo Box */}
              <div className="sm:col-span-5 flex justify-center">
                <div className="relative w-48 h-56 sm:w-56 sm:h-64 rounded-2xl overflow-hidden border-4 border-slate-700/60 shadow-2xl shadow-black/80 bg-slate-900">
                  <Image
                    src={player.photoUrl}
                    alt={player.fullName}
                    fill
                    className="object-cover"
                    priority
                  />
                  {/* Category ribbon across photo */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent py-2 px-3 text-center">
                    <span className="text-[11px] font-black tracking-widest text-amber-300 uppercase truncate block">
                      {activeLeague.name} POOL
                    </span>
                  </div>
                </div>
              </div>

              {/* Player Attributes & Bio */}
              <div className="sm:col-span-7 space-y-4">
                <div>
                  <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white uppercase leading-none">
                    {player.fullName}
                  </h2>
                  <p className="text-sm font-medium text-emerald-400 mt-1">
                    {player.battingStyle} • {player.bowlingStyle}
                  </p>
                </div>

                {/* Tournament Stats Capsule */}
                <div className="grid grid-cols-3 gap-2 p-3.5 rounded-xl bg-charcoal-950/80 border border-slate-800 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Matches
                    </span>
                    <p className="font-mono text-lg font-bold text-white">
                      {player.statsSummary?.matches || 48}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Runs
                    </span>
                    <p className="font-mono text-lg font-bold text-amber-400">
                      {player.statsSummary?.runs || 1420}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Wickets
                    </span>
                    <p className="font-mono text-lg font-bold text-emerald-400">
                      {player.statsSummary?.wickets || 52}
                    </p>
                  </div>
                </div>

                {/* Notable achievement badge */}
                {player.statsSummary?.notableAchievement && (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                    <Award className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{player.statsSummary.notableAchievement}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row of Player Spotlight: Base Price Indicator */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between z-10">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Base Starting Price
              </span>
              <span className="font-mono text-xl font-bold text-slate-200">
                {formatCurrency(player.basePrice)}
              </span>
            </div>
          </div>

          {/* RIGHT: High Bid Monitor, Countdown, Leading Team */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-6">
            {/* Top Bid Banner */}
            <div className="bg-gradient-to-br from-charcoal-900 to-charcoal-950 rounded-2xl border-2 border-amber-500/40 p-6 lg:p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between flex-1">
              {/* Subtle gold accent light */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Current Highest Bid
                </span>
                <Badge variant="gold" className="text-xs px-2.5 py-0.5 font-mono">
                  {session.bidCount} Bids Placed
                </Badge>
              </div>

              {/* Massive Tabular Bid Number */}
              <div className="my-auto py-2">
                <div className="font-mono font-black text-6xl sm:text-7xl lg:text-8xl tracking-tight bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 bg-clip-text text-transparent gold-glow">
                  {formatCurrency(session.currentHighestBid)}
                </div>
              </div>

              {/* Leading Franchise Callout */}
              <div className="pt-6 border-t border-slate-800/80">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-2">
                  Leading Franchise
                </span>
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-charcoal-950/90 border border-amber-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-amber-400 text-lg border border-slate-700">
                      {leadingTeam.shortCode}
                    </div>
                    <div>
                      <h4 className="font-black text-white text-base lg:text-lg">
                        {leadingTeam.name}
                      </h4>
                      <p className="text-xs text-slate-400">
                        Remaining Purse:{" "}
                        <span className="text-emerald-400 font-mono font-semibold">
                          {formatCurrency(leadingTeam.purse.remainingAmount)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Countdown Clock Box */}
            <div className="bg-charcoal-900 rounded-2xl border-2 border-slate-800 p-6 flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black font-mono text-2xl border-2 transition-colors ${
                    timer <= 5
                      ? "bg-red-500/20 border-red-500 text-red-400 animate-ping"
                      : timer <= 10
                      ? "bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse"
                      : "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                  }`}
                >
                  {timer}s
                </div>
                <div>
                  <h4 className="text-white font-bold text-base">Auction Countdown</h4>
                  <p className="text-xs text-slate-400">
                    {timer <= 5
                      ? "Going Three Times! Final Call"
                      : timer <= 10
                      ? "Going Once... Going Twice..."
                      : "Open for Competitive Bidding"}
                  </p>
                </div>
              </div>

              {/* Demo hammer button for testing stage celebration */}
              <button
                onClick={triggerSoldCelebration}
                className="px-4 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all"
              >
                Simulate Sold
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Section: Franchise Purse Scoreboard & Live Bid Log */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Team Purse Grid (All 6 Franchises) */}
          <div className="lg:col-span-8 bg-charcoal-900/80 rounded-2xl border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" /> Franchise Purse Scoreboard
              </h3>
              <span className="text-xs text-slate-400">Budget Cap: ₹50,00,000 / Team</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {teams.map((t) => {
                const percentSpent = (t.purse.spentAmount / t.purse.totalBudget) * 100;
                const isLeading = t.id === leadingTeam.id;

                return (
                  <div
                    key={t.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isLeading
                        ? "bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/5"
                        : "bg-charcoal-950/70 border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-white">{t.shortCode}</span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[100px]">
                          {t.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {t.squadCount}/18
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-xs mb-2">
                      <span className="text-[10px] text-slate-500 uppercase">Purse Left</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatCurrency(t.purse.remainingAmount, true)}
                      </span>
                    </div>

                    <Progress
                      value={percentSpent}
                      className="h-1.5 bg-slate-800"
                      indicatorClassName={isLeading ? "bg-amber-400" : "bg-emerald-500"}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Bids Feed */}
          <div className="lg:col-span-4 bg-charcoal-900/80 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between">
            <h3 className="font-black text-white text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" /> Recent Bid Transactions
            </h3>

            <div className="space-y-2.5 overflow-y-auto max-h-[160px] pr-1">
              {session.recentBids.map((b, idx) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-charcoal-950 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center font-bold text-[10px] text-amber-400">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-white">{b.teamName}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400">
                    {formatCurrency(b.amount)}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-center text-slate-500 mt-3">
              Real-time WebSockets synchronization active
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
