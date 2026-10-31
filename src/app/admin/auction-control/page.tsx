"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import confetti from "canvas-confetti";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatRole, getCategoryBadgeColor } from "@/lib/utils";
import { useLeague } from "@/lib/context/league-context";
import { MOCK_AUCTION_SESSION } from "@/lib/mock-data/auction";
import { MOCK_TEAMS } from "@/lib/mock-data/teams";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";
import { calculateNextBid } from "@/lib/auction/slab-calculator";
import { Team, Player, Bid } from "@/types";
import {
  Gavel,
  RotateCcw,
  Pause,
  Play,
  XCircle,
  Clock,
  ChevronRight,
} from "lucide-react";

export default function AuctionControlDesk() {
  const { activeLeague } = useLeague();
  const [session, setSession] = useState(MOCK_AUCTION_SESSION);
  const [teams, setTeams] = useState<Team[]>(MOCK_TEAMS);
  const [players, setPlayers] = useState<Player[]>(MOCK_PLAYERS);
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Authoritative server timestamp representation
  // timerExpiresAt is stored in ISO format
  const [timerExpiresAt, setTimerExpiresAt] = useState<number>(Date.now() + 45000);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(45);

  const currentPlayer = players[activePlayerIndex] || players[0];
  const leadingTeam = session.currentLeadingTeam || teams[4];

  // Derived next bid & step
  const { nextBid, step: currentStep } = calculateNextBid(
    session.currentHighestBid,
    currentPlayer.basePriceOverride || currentPlayer.basePrice
  );

  /**
   * Marks player UNSOLD and resets
   */
  const handleMarkUnsold = useCallback(
    (reason: string = "Passed by Auctioneer") => {
      setPlayers((prev) =>
        prev.map((p) => (p.id === currentPlayer.id ? { ...p, status: "UNSOLD" } : p))
      );
      setActionNotice(`${currentPlayer.fullName} marked UNSOLD (${reason}). Requeued for accelerated round.`);
    },
    [currentPlayer.id, currentPlayer.fullName]
  );

  // Authoritative countdown tick derived from (timerExpiresAt - Date.now())
  useEffect(() => {
    if (isPaused || session.status === "FINISHED") return;

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.ceil((timerExpiresAt - Date.now()) / 1000));
      setRemainingSeconds(diff);

      // Auto-unsold trigger when timer reaches zero without bid
      if (diff === 0 && session.bidCount === 0 && currentPlayer.status === "ON_AUCTION") {
        handleMarkUnsold("No bids received within initial countdown");
      }
    }, 200);

    return () => clearInterval(interval);
  }, [timerExpiresAt, isPaused, session.status, session.bidCount, currentPlayer.status, handleMarkUnsold]);

  /**
   * Submits a bid for a specific franchise (1-Click Team Logo Bidding)
   */
  const handleTeamBid = useCallback(
    (targetTeam: Team, customAmount?: number) => {
      const bidAmount = customAmount || nextBid;

      // Squad & purse reserve mathematical validation:
      // Minimum reserve: (min_players - current_squad - 1) * 25,000
      const currentSquad = targetTeam.squadCount || 0;
      const minRequiredReserve = Math.max(0, targetTeam.purse.minPlayers - currentSquad - 1) * 25000;

      if (targetTeam.purse.remainingAmount - bidAmount < minRequiredReserve) {
        setActionNotice(
          `Purse Reserve Violation: ${targetTeam.name} must reserve ₹${minRequiredReserve.toLocaleString()} for minimum squad spots!`
        );
        return;
      }

      // Authoritative timer extension:
      // Reset timer to NOW + bidExtensionSeconds (e.g. 10s)
      const extensionMs = 10000;
      const newExpiry = Date.now() + extensionMs;

      const newBid: Bid = {
        id: `bid-${Date.now()}`,
        auctionId: session.id,
        playerId: currentPlayer.id,
        teamId: targetTeam.id,
        teamName: targetTeam.name,
        teamShortCode: targetTeam.shortCode,
        teamLogoUrl: targetTeam.logoUrl,
        amount: bidAmount,
        bidType: session.bidCount === 0 ? "BASE" : "STANDARD",
        placedAt: new Date().toISOString(),
      };

      setTimerExpiresAt(newExpiry);
      setRemainingSeconds(Math.ceil(extensionMs / 1000));

      setSession((prev) => ({
        ...prev,
        currentHighestBid: bidAmount,
        currentLeadingTeamId: targetTeam.id,
        currentLeadingTeam: targetTeam,
        timerSeconds: 10,
        timerExpiresAt: new Date(newExpiry).toISOString(),
        lastBidAt: new Date().toISOString(),
        bidCount: prev.bidCount + 1,
        recentBids: [newBid, ...prev.recentBids],
      }));

      setActionNotice(`BID REGISTERED: ${formatCurrency(bidAmount)} for ${targetTeam.name}! (+10s added)`);
      setTimeout(() => setActionNotice(null), 3000);
    },
    [nextBid, session.id, session.bidCount, currentPlayer.id]
  );

  /**
   * Finalizes the current lot (SOLD)
   */
  const handleHammerDown = useCallback(() => {
    if (session.bidCount === 0 || !session.currentLeadingTeam) {
      setActionNotice("Cannot hammer lot: No valid bids placed yet!");
      return;
    }

    confetti({
      particleCount: 160,
      spread: 85,
      origin: { y: 0.6 },
      colors: ["#F59E0B", "#10B981", "#FBBF24", "#FFFFFF"],
    });

    const winningPrice = session.currentHighestBid;
    const winner = session.currentLeadingTeam;

    // Deduct purse and update player record
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === winner.id) {
          const newSpent = t.purse.spentAmount + winningPrice;
          return {
            ...t,
            squadCount: (t.squadCount || 0) + 1,
            purse: {
              ...t.purse,
              spentAmount: newSpent,
              remainingAmount: t.purse.totalBudget - newSpent,
            },
          };
        }
        return t;
      })
    );

    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === currentPlayer.id) {
          return {
            ...p,
            status: "SOLD",
            soldToTeamId: winner.id,
            soldPrice: winningPrice,
          };
        }
        return p;
      })
    );

    setActionNotice(
      `HAMMER DOWN: ${currentPlayer.fullName} SOLD to ${winner.name} for ${formatCurrency(winningPrice)}!`
    );
  }, [session.bidCount, session.currentLeadingTeam, session.currentHighestBid, currentPlayer]);

  /**
   * Transaction-safe Undo Last Action
   */
  const handleUndo = useCallback(() => {
    if (session.recentBids.length <= 1) {
      // Revert back to base starting state
      setSession((prev) => ({
        ...prev,
        currentHighestBid: currentPlayer.basePriceOverride || currentPlayer.basePrice,
        currentLeadingTeamId: null,
        currentLeadingTeam: null,
        bidCount: 0,
        recentBids: [],
      }));
      setTimerExpiresAt(Date.now() + 45000);
      setRemainingSeconds(45);
      setActionNotice("Reverted to base price floor. Standing bids cleared.");
      return;
    }

    const previousBids = session.recentBids.slice(1);
    const prevStandingBid = previousBids[0];
    const prevTeam = teams.find((t) => t.id === prevStandingBid.teamId) || teams[0];

    const newExpiry = Date.now() + 15000;
    setTimerExpiresAt(newExpiry);
    setRemainingSeconds(15);

    setSession((prev) => ({
      ...prev,
      currentHighestBid: prevStandingBid.amount,
      currentLeadingTeamId: prevTeam.id,
      currentLeadingTeam: prevTeam,
      bidCount: Math.max(1, prev.bidCount - 1),
      recentBids: previousBids,
    }));

    setActionNotice(`Undid last bid. Restored ${formatCurrency(prevStandingBid.amount)} for ${prevTeam.name}.`);
  }, [session.recentBids, currentPlayer, teams]);

  /**
   * Advances to next player in pool
   */
  const handleNextPlayer = () => {
    const nextIdx = (activePlayerIndex + 1) % players.length;
    setActivePlayerIndex(nextIdx);
    const nextP = players[nextIdx];

    const initialMs = 45000;
    setTimerExpiresAt(Date.now() + initialMs);
    setRemainingSeconds(45);

    setSession((prev) => ({
      ...prev,
      currentPlayerId: nextP.id,
      currentPlayer: nextP,
      currentHighestBid: nextP.basePriceOverride || nextP.basePrice,
      currentLeadingTeamId: null,
      currentLeadingTeam: null,
      bidCount: 0,
      recentBids: [],
    }));

    setActionNotice(`Next Lot: ${nextP.fullName} spotlighted on stage.`);
  };

  // Keyboard shortcut listener: Up Arrow = Raise Bid, Enter = Hammer, Space = Pause, Z = Undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keystrokes when typing in inputs
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (leadingTeam) {
          handleTeamBid(leadingTeam);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleHammerDown();
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      } else if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [leadingTeam, handleTeamBid, handleHammerDown, handleUndo]);

  return (
    <div className="min-h-screen bg-[#070A0D] flex text-slate-100">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Live Auction Control Desk"
          subtitle={`${activeLeague.name} • 1-Click Team Bidding, Authoritative Timers & Gavel`}
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPlayer}
                className="gap-2 text-xs"
              >
                Next Lot <ChevronRight className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleUndo}
                className="gap-2 text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo (Ctrl+Z)
              </Button>
            </div>
          }
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto max-w-7xl">
          {/* Action notification banner */}
          {actionNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center justify-between shadow-xl">
              <span>{actionNotice}</span>
              <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
          )}

          {/* Top Section: Spotlight Lot & Standing High Bid with Authoritative Timer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Active Lot Card */}
            <Card className="lg:col-span-6 border-slate-800 bg-charcoal-900">
              <CardContent className="p-6">
                <div className="flex items-start gap-5">
                  <div className="relative w-28 h-36 rounded-xl overflow-hidden bg-slate-800 border-2 border-slate-700 shrink-0">
                    <Image
                      src={currentPlayer.photoUrl}
                      alt={currentPlayer.fullName}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-black/80 py-1 text-center text-[10px] font-mono text-emerald-400">
                      3:4 PORTRAIT
                    </div>
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
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

                    <h2 className="text-2xl font-black text-white truncate">{currentPlayer.fullName}</h2>
                    <p className="text-xs text-slate-400">
                      {currentPlayer.battingStyle} • {currentPlayer.bowlingStyle}
                    </p>

                    <div className="pt-3 flex items-center justify-between text-xs border-t border-slate-800/80">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Base Price</span>
                        <span className="font-mono font-bold text-white text-sm">
                          {formatCurrency(currentPlayer.basePriceOverride || currentPlayer.basePrice)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block text-[10px] uppercase">Next Valid Bid</span>
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          {formatCurrency(nextBid)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Standing Bid & Authoritative Countdown */}
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
                      title={isPaused ? "Resume (Space)" : "Pause (Space)"}
                    >
                      {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
                    </button>
                    <div
                      className={`font-mono text-sm font-bold px-3 py-1 rounded-lg border flex items-center gap-1.5 ${
                        remainingSeconds <= 5
                          ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
                          : remainingSeconds <= 10
                          ? "bg-amber-500/20 border-amber-500 text-amber-400"
                          : "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {remainingSeconds}s
                    </div>
                  </div>
                </div>

                <div className="font-mono font-black text-5xl sm:text-6xl text-amber-300 tracking-tight my-2">
                  {formatCurrency(session.currentHighestBid)}
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Current Leader:</span>
                    {session.currentLeadingTeam ? (
                      <span className="text-white font-bold flex items-center gap-1">
                        {session.currentLeadingTeam.name}{" "}
                        <span className="text-amber-400 font-mono">
                          ({session.currentLeadingTeam.shortCode})
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-500">None (Awaiting First Bid)</span>
                    )}
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    Slab Step: +{formatCurrency(currentStep)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section: 1-Click Interactive Team Logo Bidding Controls */}
          <Card className="border-slate-800 bg-charcoal-900">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    1-Click Team Logo Bidding Pad
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click any franchise logo to instantly register that team as high bidder at the next valid slab ({formatCurrency(nextBid)})
                  </p>
                </div>
                <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                  Keyboard: [↑ Arrow] Bids next step • [Enter] Hammer Down
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {teams.map((t) => {
                  const isLeader = t.id === session.currentLeadingTeamId;
                  const currentSquad = t.squadCount || 0;
                  const minReserve = Math.max(0, t.purse.minPlayers - currentSquad - 1) * 25000;
                  const canAfford = t.purse.remainingAmount - nextBid >= minReserve;

                  return (
                    <button
                      key={t.id}
                      onClick={() => handleTeamBid(t)}
                      disabled={!canAfford}
                      className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group select-none ${
                        isLeader
                          ? "bg-amber-500/20 border-amber-500 shadow-xl shadow-amber-500/10 ring-2 ring-amber-400/40"
                          : canAfford
                          ? "bg-charcoal-950 border-slate-800 hover:border-emerald-500 hover:scale-[1.02] active:scale-[0.98]"
                          : "bg-slate-900/40 border-red-900/40 opacity-40 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm text-white border border-white/20 shadow-md"
                          style={{ backgroundColor: t.primaryColor }}
                        >
                          {t.shortCode}
                        </div>
                        {isLeader ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-400 text-black">
                            LEADER
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500">
                            {t.squadCount}/18
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-xs text-white truncate">{t.name}</h4>
                      <p className="font-mono text-[11px] font-bold text-emerald-400 mt-1">
                        {formatCurrency(t.purse.remainingAmount, true)}
                      </p>

                      <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Bid Next:</span>
                        <span className="font-mono font-bold text-white group-hover:text-amber-300">
                          {formatCurrency(nextBid, true)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Gavel Finalization & Unsold Controls */}
              <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  onClick={handleHammerDown}
                  size="xl"
                  variant="gold"
                  className="w-full gap-3 font-black text-black tracking-wide shadow-xl shadow-amber-950/50"
                >
                  <Gavel className="w-6 h-6 fill-black" />
                  HAMMER DOWN (SOLD • ENTER)
                </Button>

                <Button
                  onClick={() => handleMarkUnsold("Manual passed by auctioneer")}
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
