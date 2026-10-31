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
import { useRealtimeAuction } from "@/lib/hooks/use-realtime-auction";
import { calculateNextBid } from "@/lib/auction/slab-calculator";
import { analyzeTeamBiddingEligibility, TeamPurseReserveAnalysis } from "@/lib/auction/purse-validator";
import { Team, Player } from "@/types";
import {
  Gavel,
  RotateCcw,
  Pause,
  Play,
  XCircle,
  Clock,
  ChevronRight,
  User,
  Radio,
} from "lucide-react";

export default function AuctionControlDesk() {
  const { activeLeague } = useLeague();
  const {
    session,
    teams: liveTeams,
    players: livePlayers,
    rules: liveRules,
    isConnected,
    remainingSeconds,
    lastActionMessage,
    placeBid,
    selectLot,
    hammerSold,
    markUnsold,
    togglePause,
    undo,
  } = useRealtimeAuction(activeLeague.id);

  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [localNotice, setLocalNotice] = useState<string | null>(null);

  const actionNotice = lastActionMessage || localNotice;
  const isPaused = session.status === "PAUSED";

  const currentPlayer: Player = useMemo(
    () =>
      session.currentPlayer ||
      livePlayers[activePlayerIndex] || {
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
    [session.currentPlayer, livePlayers, activePlayerIndex, activeLeague.id]
  );

  const { nextBid, step: currentStep } = calculateNextBid(
    session.currentHighestBid,
    currentPlayer.basePriceOverride || currentPlayer.basePrice
  );

  // Authoritative purse reserve and bidding eligibility analysis for all franchises
  const teamAnalyses = useMemo(() => {
    const analysisMap: Record<string, TeamPurseReserveAnalysis> = {};
    for (const team of liveTeams) {
      const purchasedForTeam = livePlayers.filter(
        (p) => p.status === "SOLD" && p.soldToTeamId === team.id
      );
      analysisMap[team.id] = analyzeTeamBiddingEligibility(team, {
        rules: liveRules,
        currentPlayer,
        nextBidAmount: nextBid,
        isCurrentLeadingTeam: session.currentLeadingTeamId === team.id,
        allPurchasedPlayersForTeam: purchasedForTeam,
      });
    }
    return analysisMap;
  }, [liveTeams, livePlayers, liveRules, currentPlayer, nextBid, session.currentLeadingTeamId]);

  /**
   * Marks player UNSOLD and broadcasts
   */
  const handleMarkUnsold = useCallback(
    async (reason: string = "Passed by Auctioneer") => {
      await markUnsold(reason);
    },
    [markUnsold]
  );

  // Auto-unsold trigger when countdown reaches zero with 0 bids
  useEffect(() => {
    if (isPaused || session.status === "FINISHED" || session.status === "IDLE") return;
    if (remainingSeconds === 0 && session.bidCount === 0 && currentPlayer.status === "ON_AUCTION") {
      handleMarkUnsold("No bids received within countdown window");
    }
  }, [remainingSeconds, isPaused, session.status, session.bidCount, currentPlayer.status, handleMarkUnsold]);

  /**
   * Submits a bid for a specific franchise (1-Click Team Logo Bidding)
   */
  const handleTeamBid = useCallback(
    async (targetTeam: Team, customAmount?: number) => {
      const bidAmount = customAmount || nextBid;
      const analysis = teamAnalyses[targetTeam.id];
      if (analysis && !analysis.isEligibleToBid) {
        setLocalNotice(analysis.ineligibilityReason || "Team cannot place this bid");
        setTimeout(() => setLocalNotice(null), 3500);
        return;
      }
      const res = await placeBid(targetTeam.id, bidAmount);
      if (!res.success) {
        setLocalNotice(res.error || "Bid could not be registered");
        setTimeout(() => setLocalNotice(null), 3500);
      }
    },
    [nextBid, placeBid, teamAnalyses]
  );

  /**
   * Finalizes the current lot (SOLD)
   */
  const handleHammerDown = useCallback(async () => {
    if (session.bidCount === 0 || !session.currentLeadingTeam) {
      setLocalNotice("Cannot hammer lot: No valid bids placed yet!");
      setTimeout(() => setLocalNotice(null), 3000);
      return;
    }

    confetti({
      particleCount: 130,
      spread: 75,
      origin: { y: 0.6 },
    });

    const res = await hammerSold();
    if (!res.success) {
      setLocalNotice(res.error || "Hammer action failed");
      setTimeout(() => setLocalNotice(null), 3000);
    }
  }, [session.bidCount, session.currentLeadingTeam, hammerSold]);

  /**
   * Safe Undo Action
   */
  const handleUndo = useCallback(async () => {
    const res = await undo();
    if (!res.success) {
      setLocalNotice(res.error || "Nothing to undo");
      setTimeout(() => setLocalNotice(null), 3000);
    }
  }, [undo]);

  /**
   * Advances to next lot
   */
  const handleNextPlayer = async () => {
    if (activePlayerIndex < livePlayers.length - 1) {
      const nextIdx = activePlayerIndex + 1;
      const nextP = livePlayers[nextIdx];
      setActivePlayerIndex(nextIdx);
      await selectLot(nextP.id);
    } else {
      setLocalNotice("End of player roster reached!");
      setTimeout(() => setLocalNotice(null), 3000);
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
          const leader = liveTeams.find((t) => t.id === session.currentLeadingTeam?.id);
          if (leader) handleTeamBid(leader);
        } else if (liveTeams.length > 0) {
          handleTeamBid(liveTeams[0]);
        }
      } else if (e.key === " ") {
        e.preventDefault();
        togglePause();
      } else if (e.ctrlKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleHammerDown, handleTeamBid, handleUndo, togglePause, session.currentLeadingTeam, liveTeams]);

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Live Auction Control Desk"
          subtitle={`${activeLeague.name} • Lot ${activePlayerIndex + 1} of ${livePlayers.length}`}
          action={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-white border-slate-200">
                <Radio className={`w-3 h-3 ${isConnected ? "text-emerald-500 animate-pulse" : "text-amber-500"}`} />
                <span className={isConnected ? "text-emerald-700" : "text-amber-700"}>
                  {isConnected ? "Live Synchronized" : "Connecting..."}
                </span>
              </div>
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
              <button onClick={() => setLocalNotice(null)} className="text-slate-400 hover:text-white">✕</button>
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
                      onClick={togglePause}
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

              {/* Franchise Cards Grid with Dynamic Purse Reserve & Max Bid Validation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {liveTeams.map((t) => {
                  const analysis = teamAnalyses[t.id];
                  const isLeader = analysis?.isCurrentLeader ?? (session.currentLeadingTeamId === t.id);
                  const isEligible = analysis?.isEligibleToBid ?? true;
                  const remainingPurse = analysis?.remainingPurse ?? (t.purse?.remainingAmount || 5000000);
                  const playersPurchased = analysis?.playersPurchased ?? (t.squadCount || 0);
                  const minimumSquadSize = analysis?.minimumSquadSize ?? (t.purse?.minPlayers || 15);
                  const requiredReserve = analysis?.requiredReserve ?? 0;
                  const maximumBidAllowed = analysis?.maximumBidAllowed ?? remainingPurse;

                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isLeader
                          ? "border-emerald-600 bg-emerald-50/60 shadow-sm ring-1 ring-emerald-600"
                          : !isEligible
                          ? "border-slate-200 bg-slate-50/70 opacity-80"
                          : "border-slate-200 bg-white hover:border-slate-300 shadow-sm"
                      }`}
                    >
                      <div>
                        {/* Header: Logo & Badge */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                            {t.logoUrl ? (
                              <img src={t.logoUrl} alt={t.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-bold text-[10px] text-slate-600">{t.shortCode}</span>
                            )}
                          </div>

                          {isLeader ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-600 text-white tracking-wide">
                              LEADER
                            </span>
                          ) : !isEligible ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-200 tracking-wide">
                              INELIGIBLE
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ELIGIBLE
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-xs text-slate-900 truncate" title={t.name}>
                          {t.name}
                        </h4>

                        {/* Purse & Squad Stats */}
                        <div className="mt-2 space-y-1 text-[11px] font-mono">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-sans text-slate-500">Purse:</span>
                            <span className="font-bold text-slate-900">
                              {formatCurrency(remainingPurse, true)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-sans text-slate-500">Squad:</span>
                            <span className="text-slate-700">
                              {playersPurchased}/{t.purse?.maxPlayers || 18}{" "}
                              <span className="text-[9px] text-slate-400 font-sans">(Min {minimumSquadSize})</span>
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-sans text-slate-500">Reserve Req:</span>
                            <span className="text-amber-700 font-semibold">
                              {formatCurrency(requiredReserve, true)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <span className="text-[10px] font-sans font-semibold text-slate-600">Max Bid:</span>
                            <span className="font-bold text-emerald-700">
                              {formatCurrency(maximumBidAllowed, true)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button / Ineligibility Warning */}
                      <div className="mt-3 pt-2 border-t border-slate-200/60">
                        {isEligible ? (
                          <button
                            type="button"
                            onClick={() => handleTeamBid(t)}
                            className="w-full py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center justify-between transition shadow-sm"
                          >
                            <span className="text-[10px] font-normal uppercase tracking-wider text-emerald-100">
                              Bid Next
                            </span>
                            <span className="font-mono">{formatCurrency(nextBid, true)}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title={analysis?.ineligibilityReason}
                            className="w-full py-1 px-1.5 rounded-lg bg-slate-100 text-slate-400 font-medium text-xs flex flex-col items-center justify-center cursor-not-allowed border border-slate-200/70"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] line-through">Bid {formatCurrency(nextBid, true)}</span>
                              <span className="text-[8px] font-bold text-rose-600 uppercase">Blocked</span>
                            </div>
                            <span className="text-[8px] text-rose-600 truncate w-full text-left font-sans mt-0.5">
                              {analysis?.ineligibilityReason || "Ineligible"}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
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
