"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import confetti from "canvas-confetti";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatRole, getCategoryBadgeColor } from "@/lib/utils";
import { useLeague } from "@/lib/context/league-context";
import { MOCK_AUCTION_SESSION } from "@/lib/mock-data/auction";
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
  User,
} from "lucide-react";

export default function AuctionControlDesk() {
  const { activeLeague, teams, updateTeam, players, updatePlayer } = useLeague();

  const [session, setSession] = useState(MOCK_AUCTION_SESSION);
  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Authoritative server timestamp representation
  const [timerExpiresAt, setTimerExpiresAt] = useState<number>(Date.now() + 45000);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(45);

  const currentPlayer: Player = useMemo(
    () =>
      players[activePlayerIndex] || {
        id: "fallback-p1",
        seasonId: activeLeague.id,
        registrationNo: "NTL-001",
        fullName: "Ashwin Pai",
        category: "ICON",
        primaryRole: "ALL_ROUNDER",
        battingStyle: "Right-Hand Bat",
        bowlingStyle: "Right-Arm Medium",
        photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80",
        basePrice: 200000,
        status: "ON_AUCTION",
        sortOrder: 1,
      },
    [players, activePlayerIndex, activeLeague.id]
  );

  const { nextBid, step: currentStep } = calculateNextBid(
    session.currentHighestBid,
    currentPlayer.basePriceOverride || currentPlayer.basePrice
  );

  /**
   * Marks player UNSOLD and resets
   */
  const handleMarkUnsold = useCallback(
    (reason: string = "Passed by Auctioneer") => {
      updatePlayer(currentPlayer.id, { status: "UNSOLD" });
      setActionNotice(`${currentPlayer.fullName} marked UNSOLD (${reason}). Requeued for accelerated round.`);
      setTimeout(() => setActionNotice(null), 3500);
    },
    [currentPlayer.id, currentPlayer.fullName, updatePlayer]
  );

  // Authoritative countdown tick derived from (timerExpiresAt - Date.now())
  useEffect(() => {
    if (isPaused || session.status === "FINISHED") return;

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.ceil((timerExpiresAt - Date.now()) / 1000));
      setRemainingSeconds(diff);

      // Auto-unsold trigger when timer reaches zero without bid
      if (diff === 0 && session.bidCount === 0 && currentPlayer.status === "AVAILABLE") {
        handleMarkUnsold("No bids received within countdown window");
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

      // Squad & purse reserve validation
      const currentSquad = targetTeam.squadCount || 0;
      const minPlayers = targetTeam.purse?.minPlayers || 15;
      const minRequiredReserve = Math.max(0, minPlayers - currentSquad - 1) * 25000;
      const remainingAmount = targetTeam.purse?.remainingAmount || 5000000;

      if (remainingAmount - bidAmount < minRequiredReserve) {
        setActionNotice(
          `Purse Reserve Violation: ${targetTeam.name} must reserve ₹${minRequiredReserve.toLocaleString()} for minimum squad spots!`
        );
        setTimeout(() => setActionNotice(null), 3500);
        return;
      }

      // Authoritative timer extension: Reset timer to NOW + 10s
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
      setTimeout(() => setActionNotice(null), 3000);
      return;
    }

    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
    });

    const winningPrice = session.currentHighestBid;
    const winner = session.currentLeadingTeam;

    // Deduct purse and increment squad count in context
    const currentSpent = winner.purse?.spentAmount || 0;
    const totalBudget = winner.purse?.totalBudget || 5000000;
    const newSpent = currentSpent + winningPrice;

    updateTeam(winner.id, {
      squadCount: (winner.squadCount || 0) + 1,
      purse: {
        ...winner.purse,
        spentAmount: newSpent,
        remainingAmount: totalBudget - newSpent,
      },
    });

    updatePlayer(currentPlayer.id, {
      status: "SOLD",
      soldToTeamId: winner.id,
      soldPrice: winningPrice,
    });

    setActionNotice(
      `HAMMER DOWN: ${currentPlayer.fullName} SOLD to ${winner.name} for ${formatCurrency(winningPrice)}!`
    );
  }, [session.bidCount, session.currentLeadingTeam, session.currentHighestBid, currentPlayer, updateTeam, updatePlayer]);

  /**
   * Safe Undo Action
   */
  const handleUndo = useCallback(() => {
    if (session.recentBids.length <= 1) {
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
      setActionNotice("Reverted to base price floor. Bids cleared.");
      return;
    }

    const previousBid = session.recentBids[1];
    const previousTeam = teams.find((t) => t.id === previousBid.teamId) || null;

    setSession((prev) => ({
      ...prev,
      currentHighestBid: previousBid.amount,
      currentLeadingTeamId: previousBid.teamId,
      currentLeadingTeam: previousTeam,
      bidCount: prev.bidCount - 1,
      recentBids: prev.recentBids.slice(1),
    }));
    setTimerExpiresAt(Date.now() + 10000);
    setRemainingSeconds(10);
    setActionNotice(`Undone last bid. Standing bid reverted to ${formatCurrency(previousBid.amount)}.`);
  }, [session.recentBids, currentPlayer, teams]);

  /**
   * Advances to next lot
   */
  const handleNextPlayer = () => {
    if (activePlayerIndex < players.length - 1) {
      const nextIdx = activePlayerIndex + 1;
      const nextP = players[nextIdx];
      setActivePlayerIndex(nextIdx);

      const base = nextP.basePriceOverride || nextP.basePrice;
      setSession({
        ...session,
        currentPlayerId: nextP.id,
        currentPlayer: nextP,
        currentHighestBid: base,
        currentLeadingTeamId: null,
        currentLeadingTeam: null,
        bidCount: 0,
        recentBids: [],
        status: "IN_PROGRESS",
      });
      setTimerExpiresAt(Date.now() + 45000);
      setRemainingSeconds(45);
      setActionNotice(`Podium ready: Lot #${nextIdx + 1} - ${nextP.fullName}`);
    } else {
      setActionNotice("End of player roster reached!");
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Enter") {
        e.preventDefault();
        handleHammerDown();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (session.currentLeadingTeam) {
          const leader = teams.find((t) => t.id === session.currentLeadingTeam?.id);
          if (leader) handleTeamBid(leader);
        } else if (teams.length > 0) {
          handleTeamBid(teams[0]);
        }
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPaused((p) => !p);
      } else if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleHammerDown, handleTeamBid, handleUndo, session.currentLeadingTeam, teams]);

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Live Auction Control Desk"
          subtitle={`${activeLeague.name} • Lot ${activePlayerIndex + 1} of ${players.length}`}
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPlayer}
                className="gap-1.5 text-xs border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
              >
                Next Lot <ChevronRight className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                className="gap-1.5 text-xs border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo (Ctrl+Z)
              </Button>
            </div>
          }
        />

        <main className="p-6 sm:p-8 space-y-6 max-w-6xl">
          {actionNotice && (
            <div className="p-3.5 bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm">
              <span>{actionNotice}</span>
              <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
          )}

          {/* Top Split: Active Player Card & Standing Bid / Timer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Active Player Card */}
            <Card className="lg:col-span-6 bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-5">
                  <div className="w-28 h-36 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                    {currentPlayer.photoUrl ? (
                      <img
                        src={currentPlayer.photoUrl}
                        alt={currentPlayer.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-10 h-10 text-slate-300" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getCategoryBadgeColor(currentPlayer.category)}`}>
                        {currentPlayer.category}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        {currentPlayer.registrationNo}
                      </span>
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 leading-tight">
                      {currentPlayer.fullName}
                    </h2>

                    <div className="text-xs text-slate-600">
                      {formatRole(currentPlayer.primaryRole)} • {currentPlayer.battingStyle || "Right-Hand Bat"}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Base Price</span>
                        <span className="font-mono font-bold text-slate-700">
                          {formatCurrency(currentPlayer.basePriceOverride || currentPlayer.basePrice)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Next Valid Bid</span>
                        <span className="font-mono font-bold text-emerald-700 text-sm">
                          {formatCurrency(nextBid)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Standing Bid & Countdown Timer Card */}
            <Card className="lg:col-span-6 bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden flex flex-col justify-between">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">
                    Standing Highest Bid
                  </span>

                  {/* Countdown Timer with Pause/Resume */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsPaused(!isPaused)}
                      className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                      title={isPaused ? "Resume Countdown" : "Pause Countdown"}
                    >
                      {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    </button>
                    <div
                      className={`font-mono text-xs font-bold px-3 py-1 rounded-lg border flex items-center gap-1.5 ${
                        remainingSeconds <= 5
                          ? "bg-red-50 border-red-300 text-red-700 font-black animate-pulse"
                          : remainingSeconds <= 10
                          ? "bg-amber-50 border-amber-300 text-amber-800"
                          : "bg-emerald-50 border-emerald-300 text-emerald-800"
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {remainingSeconds}s
                    </div>
                  </div>
                </div>

                <div className="font-mono font-extrabold text-4xl sm:text-5xl text-slate-900 tracking-tight my-4">
                  {formatCurrency(session.currentHighestBid)}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Current Leader:</span>
                    {session.currentLeadingTeam ? (
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        {session.currentLeadingTeam.name}
                        <Badge variant="outline" className="font-mono text-[10px] bg-slate-50">
                          {session.currentLeadingTeam.shortCode}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">No bids yet</span>
                    )}
                  </div>

                  <span className="text-slate-500 font-mono text-[11px]">
                    Step: +{formatCurrency(currentStep)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section: 1-Click Interactive Team Logo Bidding Pad */}
          <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">1-Click Team Logo Bidding Pad</h3>
                  <p className="text-xs text-slate-500">
                    Click any franchise logo to register their next valid bid (+10s added automatically).
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Next Step: {formatCurrency(nextBid)}
                </span>
              </div>

              {/* Franchise Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {teams.map((t) => {
                  const isLeader = session.currentLeadingTeamId === t.id;
                  const remainingPurse = t.purse?.remainingAmount || 5000000;

                  return (
                    <button
                      key={t.id}
                      onClick={() => handleTeamBid(t)}
                      className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isLeader
                          ? "border-emerald-600 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-600"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                          {t.logoUrl ? (
                            <img src={t.logoUrl} alt={t.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-[10px] text-slate-600">{t.shortCode}</span>
                          )}
                        </div>

                        {isLeader ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600 text-white">
                            LEADER
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">
                            {t.squadCount || 0}/{t.purse?.maxPlayers || 18}
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-xs text-slate-900 truncate">{t.name}</h4>
                      <p className="font-mono text-[11px] font-semibold text-emerald-700 mt-0.5">
                        {formatCurrency(remainingPurse, true)}
                      </p>

                      <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Bid Next:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatCurrency(nextBid, true)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Gavel & Pass Control Bar */}
              <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  onClick={handleHammerDown}
                  size="lg"
                  className="w-full gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  <Gavel className="w-5 h-5 fill-white" />
                  HAMMER DOWN (SOLD • ENTER)
                </Button>

                <Button
                  onClick={() => handleMarkUnsold("Manual passed by auctioneer")}
                  size="lg"
                  variant="outline"
                  className="w-full gap-2 font-semibold border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  <XCircle className="w-5 h-5 text-slate-400" />
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
