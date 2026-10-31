"use client";

import { useState } from "react";
import Image from "next/image";
import confetti from "canvas-confetti";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatRole, getCategoryBadgeColor } from "@/lib/utils";
import { MOCK_AUCTION_SESSION } from "@/lib/mock-data/auction";
import { MOCK_TEAMS } from "@/lib/mock-data/teams";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";
import {
  Gavel,
  RotateCcw,
  Pause,
  Play,
  XCircle,
} from "lucide-react";

export default function AuctionControlDesk() {
  const [session, setSession] = useState(MOCK_AUCTION_SESSION);
  const [selectedBiddingTeamId, setSelectedBiddingTeamId] = useState<string>(MOCK_TEAMS[0].id);
  const [isPaused, setIsPaused] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const currentPlayer = session.currentPlayer || MOCK_PLAYERS[0];
  const leadingTeam = session.currentLeadingTeam || MOCK_TEAMS[4];

  // Helper to place bid
  const handlePlaceBid = (incrementAmount: number) => {
    const newBidAmount = session.currentHighestBid + incrementAmount;
    const team = MOCK_TEAMS.find((t) => t.id === selectedBiddingTeamId)!;

    // Check squad reserve limit
    const minReserve = Math.max(0, team.purse.minPlayers - (team.squadCount || 0) - 1) * 25000;
    if (team.purse.remainingAmount - newBidAmount < minReserve) {
      setActionNotice(`Warning: ${team.name} requires ₹${minReserve.toLocaleString()} reserved for remaining squad slots!`);
      return;
    }

    setSession((prev) => ({
      ...prev,
      currentHighestBid: newBidAmount,
      currentLeadingTeamId: team.id,
      currentLeadingTeam: team,
      timerSeconds: 30,
      bidCount: prev.bidCount + 1,
      recentBids: [
        {
          id: `bid-${Date.now()}`,
          auctionId: prev.id,
          playerId: currentPlayer.id,
          teamId: team.id,
          teamName: team.name,
          teamShortCode: team.shortCode,
          amount: newBidAmount,
          bidType: "STANDARD",
          placedAt: new Date().toISOString(),
        },
        ...prev.recentBids,
      ],
    }));

    setActionNotice(`Bid of ${formatCurrency(newBidAmount)} registered for ${team.name}!`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Hammer Down (SOLD)
  const handleHammerDown = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
    setActionNotice(`GAVEL STRUCK: ${currentPlayer.fullName} SOLD to ${leadingTeam.name} for ${formatCurrency(session.currentHighestBid)}!`);
  };

  // Mark UNSOLD
  const handleMarkUnsold = () => {
    setActionNotice(`${currentPlayer.fullName} marked UNSOLD. Requeued for accelerated round.`);
  };

  // Undo Last Bid
  const handleUndo = () => {
    if (session.recentBids.length <= 1) return;
    const remainingBids = session.recentBids.slice(1);
    const previousBid = remainingBids[0];
    const prevTeam = MOCK_TEAMS.find((t) => t.id === previousBid.teamId) || MOCK_TEAMS[0];

    setSession((prev) => ({
      ...prev,
      currentHighestBid: previousBid.amount,
      currentLeadingTeamId: prevTeam.id,
      currentLeadingTeam: prevTeam,
      bidCount: Math.max(1, prev.bidCount - 1),
      recentBids: remainingBids,
    }));
    setActionNotice("Last bid undone. Restored previous standing bid.");
  };

  return (
    <div className="min-h-screen bg-[#070A0D] flex text-slate-100">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Live Auction Control Desk"
          subtitle="Real-time stage bidding console & gavel controls"
          action={
            <Button
              variant="destructive"
              size="sm"
              onClick={handleUndo}
              className="gap-2 text-xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Undo Last Bid
            </Button>
          }
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto max-w-7xl">
          {/* Action Notification Alert */}
          {actionNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center justify-between shadow-lg">
              <span>{actionNotice}</span>
              <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
          )}

          {/* Top Lot Summary & Live High Bidder */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Active Lot Info */}
            <Card className="lg:col-span-6 border-slate-800 bg-charcoal-900">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="relative w-24 h-28 rounded-xl overflow-hidden bg-slate-800 border-2 border-slate-700 shrink-0">
                    <Image
                      src={currentPlayer.photoUrl}
                      alt={currentPlayer.fullName}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        {currentPlayer.registrationNo}
                      </span>
                      <Badge
                        variant="gold"
                        className={`text-[10px] ${getCategoryBadgeColor(currentPlayer.category)}`}
                      >
                        {currentPlayer.category}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {formatRole(currentPlayer.primaryRole)}
                      </span>
                    </div>

                    <h2 className="text-2xl font-black text-white">{currentPlayer.fullName}</h2>
                    <p className="text-xs text-slate-400">
                      {currentPlayer.battingStyle} • {currentPlayer.bowlingStyle}
                    </p>

                    <div className="pt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Base Price:</span>
                      <span className="font-mono font-bold text-white">
                        {formatCurrency(currentPlayer.basePrice)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Standing Bid & Leading Franchise */}
            <Card className="lg:col-span-6 border-2 border-amber-500/40 bg-charcoal-900 flex flex-col justify-between">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase font-bold text-amber-400 tracking-wider">
                    Standing Highest Bid
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsPaused(!isPaused)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                      title={isPaused ? "Resume" : "Pause"}
                    >
                      {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
                    </button>
                    <span className="font-mono text-xs font-bold text-slate-300 px-2 py-0.5 rounded bg-slate-800">
                      30s Timer
                    </span>
                  </div>
                </div>

                <div className="font-mono font-black text-5xl text-amber-300 tracking-tight my-2">
                  {formatCurrency(session.currentHighestBid)}
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Leader:</span>
                    <strong className="text-white font-bold">{leadingTeam.name}</strong>
                    <span className="text-amber-400 font-mono">({leadingTeam.shortCode})</span>
                  </div>
                  <span className="text-slate-400 font-mono">
                    Purse Rem: {formatCurrency(leadingTeam.purse.remainingAmount, true)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Increment Bid Pad */}
          <Card className="border-slate-800 bg-charcoal-900">
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-3">
                  Step 1: Select Bidding Franchise
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {MOCK_TEAMS.map((t) => {
                    const isSelected = t.id === selectedBiddingTeamId;
                    const isLeader = t.id === leadingTeam.id;

                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedBiddingTeamId(t.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "bg-emerald-950/70 border-emerald-500 shadow-md shadow-emerald-950"
                            : "bg-charcoal-950 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-white">{t.shortCode}</span>
                          {isLeader && (
                            <span className="text-[9px] font-bold text-amber-400">LEADING</span>
                          )}
                        </div>
                        <p className="font-mono text-[11px] font-bold text-emerald-400">
                          {formatCurrency(t.purse.remainingAmount, true)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white mb-3">
                  Step 2: Submit Bid Increment
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Button
                    onClick={() => handlePlaceBid(10000)}
                    size="xl"
                    variant="outline"
                    className="border-slate-700 hover:border-emerald-500 font-mono text-base"
                  >
                    +₹10,000
                  </Button>
                  <Button
                    onClick={() => handlePlaceBid(25000)}
                    size="xl"
                    variant="outline"
                    className="border-slate-700 hover:border-emerald-500 font-mono text-base"
                  >
                    +₹25,000
                  </Button>
                  <Button
                    onClick={() => handlePlaceBid(50000)}
                    size="xl"
                    variant="outline"
                    className="border-slate-700 hover:border-emerald-500 font-mono text-base"
                  >
                    +₹50,000
                  </Button>
                  <Button
                    onClick={() => handlePlaceBid(100000)}
                    size="xl"
                    variant="outline"
                    className="border-slate-700 hover:border-emerald-500 font-mono text-base"
                  >
                    +₹1,00,000
                  </Button>
                </div>
              </div>

              {/* Hammer & Finalize Actions */}
              <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  onClick={handleHammerDown}
                  size="xl"
                  variant="gold"
                  className="w-full gap-3 font-black text-black tracking-wide shadow-xl shadow-amber-950/50"
                >
                  <Gavel className="w-6 h-6 fill-black" />
                  HAMMER DOWN (MARK SOLD)
                </Button>

                <Button
                  onClick={handleMarkUnsold}
                  size="xl"
                  variant="destructive"
                  className="w-full gap-3 font-black tracking-wide"
                >
                  <XCircle className="w-6 h-6" />
                  PASS LOT (MARK UNSOLD)
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
