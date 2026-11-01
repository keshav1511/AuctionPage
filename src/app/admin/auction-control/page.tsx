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
import {
  calculateRoundStatistics,
  detectRound1Completion,
  getEligibleRound2Players,
} from "@/lib/auction/round-manager";
import { Team, Player } from "@/types";
import Link from "next/link";
import {
  Gavel,
  RotateCcw,
  Pause,
  Play,
  XCircle,
  Clock,
  ChevronRight,
  Radio,
  Sparkles,
  Users,
  RefreshCw,
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
    initRound2,
    startRound2,
    refreshState,
  } = useRealtimeAuction(activeLeague.id);

  const [activePlayerIndex, setActivePlayerIndex] = useState(0);
  const [localNotice, setLocalNotice] = useState<string | null>(null);

  const actionNotice = lastActionMessage || localNotice;
  const isPaused = session.status === "PAUSED";

  const currentPlayer: Player | null = useMemo(
    () => session.currentPlayer || livePlayers[activePlayerIndex] || null,
    [session.currentPlayer, livePlayers, activePlayerIndex]
  );

  const basePriceForPlayer = currentPlayer
    ? (currentPlayer.basePriceOverride || currentPlayer.basePrice || liveRules.basePrice || 2000)
    : (liveRules.basePrice || 2000);

  const { nextBid, step: currentStep } = calculateNextBid(
    session.currentHighestBid,
    basePriceForPlayer
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
        currentPlayer: currentPlayer || undefined,
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
      if (!currentPlayer) return;
      await markUnsold(reason);
    },
    [markUnsold, currentPlayer]
  );

  // Auto-unsold trigger when countdown reaches zero with 0 bids
  useEffect(() => {
    if (isPaused || session.status === "FINISHED" || session.status === "IDLE") return;
    if (remainingSeconds === 0 && session.bidCount === 0 && currentPlayer?.status === "ON_AUCTION") {
      handleMarkUnsold("No bids received within countdown window");
    }
  }, [remainingSeconds, isPaused, session.status, session.bidCount, currentPlayer, handleMarkUnsold]);

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

  // Round progression statistics
  const roundStats = useMemo(() => {
    return calculateRoundStatistics({
      players: livePlayers,
      round: session.round || 1,
      roundStage: session.roundStage,
      round2Queue: session.round2Queue,
      currentPlayerId: session.currentPlayerId,
    });
  }, [livePlayers, session.round, session.roundStage, session.round2Queue, session.currentPlayerId]);

  const isR1Complete = session.round1Completed || detectRound1Completion(livePlayers);
  const eligibleUnsoldCount = useMemo(() => getEligibleRound2Players(livePlayers).length, [livePlayers]);

  const handleInitRound2 = useCallback(async () => {
    const res = await initRound2();
    if (!res.success) {
      setLocalNotice(res.error || "Failed to initialize Round 2");
      setTimeout(() => setLocalNotice(null), 3500);
    } else {
      setLocalNotice("Round 2 queue initialized successfully!");
      setTimeout(() => setLocalNotice(null), 3000);
    }
  }, [initRound2]);

  const handleStartRound2 = useCallback(async () => {
    const res = await startRound2();
    if (!res.success) {
      setLocalNotice(res.error || "Failed to start Round 2");
      setTimeout(() => setLocalNotice(null), 3500);
    } else {
      setLocalNotice("Round 2 live auction has commenced!");
      setTimeout(() => setLocalNotice(null), 3000);
    }
  }, [startRound2]);

  /**
   * Advances to next lot
   */
  const handleNextPlayer = async () => {
    if (session.round === 2) {
      const res = await selectLot();
      if (!res.success) {
        setLocalNotice(res.error || "End of Round 2 queue reached!");
        setTimeout(() => setLocalNotice(null), 3000);
      }
    } else {
      if (activePlayerIndex < livePlayers.length - 1) {
        const nextIdx = activePlayerIndex + 1;
        const nextP = livePlayers[nextIdx];
        setActivePlayerIndex(nextIdx);
        await selectLot(nextP.id);
      } else {
        setLocalNotice("End of player roster reached!");
        setTimeout(() => setLocalNotice(null), 3000);
      }
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
          subtitle={`${activeLeague.name} • ${roundStats.roundLabel}`}
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

        {!isConnected && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs py-2 px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>Persistence Bridge Disconnected — Attempting to reconnect to Google Apps Script...</span>
            </div>
            <button
              onClick={() => refreshState()}
              className="text-[11px] font-bold text-amber-900 underline hover:text-amber-700"
            >
              Retry Connection
            </button>
          </div>
        )}

        <main className="p-6 sm:p-8 space-y-6 max-w-6xl">
          {actionNotice && (
            <div className="p-3.5 bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm">
              <span>{actionNotice}</span>
              <button onClick={() => setLocalNotice(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
          )}

          {/* Section: Authoritative Round Indicator & Statistics Bar */}
          <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 border ${
                    session.round === 2
                      ? "bg-amber-50 border-amber-300 text-amber-800"
                      : "bg-emerald-50 border-emerald-300 text-emerald-800"
                  }`}
                >
                  <Sparkles className={`w-4 h-4 ${session.round === 2 ? "text-amber-600" : "text-emerald-600"}`} />
                  <span>{roundStats.roundLabel}</span>
                </div>

                {session.roundStage === "ROUND_2_TRANSITION" && (
                  <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] animate-pulse">
                    TRANSITION SCREEN ACTIVE ON /LIVE
                  </Badge>
                )}
              </div>

              {/* Round Statistics Pills */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-mono">
                <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 flex items-center gap-1.5">
                  <span className="text-slate-500 font-sans text-[11px]">Total in Round:</span>
                  <span className="font-bold text-slate-900">{roundStats.totalInRound}</span>
                </div>

                <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1.5">
                  <span className="text-emerald-600 font-sans text-[11px]">Sold:</span>
                  <span className="font-bold">{roundStats.soldCount}</span>
                </div>

                <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-1.5">
                  <span className="text-slate-500 font-sans text-[11px]">Unsold:</span>
                  <span className="font-bold">{roundStats.unsoldCount}</span>
                </div>

                <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 flex items-center gap-1.5">
                  <span className="text-blue-600 font-sans text-[11px]">Pending:</span>
                  <span className="font-bold">{roundStats.pendingCount}</span>
                </div>

                {/* Round 2 Quick Trigger if R1 complete and not yet in R2 */}
                {isR1Complete && session.round !== 2 && eligibleUnsoldCount > 0 && (
                  <Button
                    onClick={handleInitRound2}
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Initialize Round 2 ({eligibleUnsoldCount} Unsold)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section: Round 2 Transition & Confirmation Banner (when in transition) */}
          {session.roundStage === "ROUND_2_TRANSITION" && (
            <Card className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-400/80 shadow-md rounded-2xl overflow-hidden">
              <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-black text-[10px] bg-amber-500 text-white uppercase tracking-wider">
                      STAGE TRANSITION
                    </span>
                    <h3 className="font-bold text-base text-slate-900">
                      ROUND 2 – UNSOLD PLAYERS READY
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    Round 1 main sequence is complete. {roundStats.totalInRound} unsold players have been
                    randomized once and queued. Spectators currently see the Round 2 introduction screen.
                  </p>
                </div>

                <Button
                  onClick={handleStartRound2}
                  size="lg"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 shrink-0 shadow-md active:scale-95 transition"
                >
                  <Sparkles className="w-5 h-5" />
                  START ROUND 2 AUCTION (ENTER LOT 1)
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Section: Round 2 Player Queue Drawer (when in Round 2) */}
          {(session.round === 2 || session.roundStage === "ROUND_2_TRANSITION") && session.round2Queue && (
            <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Round 2 Queue ({session.round2Queue.length} Players)
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Order locked & persisted
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-64 overflow-y-auto pr-1">
                  {session.round2Queue.map((item, idx) => {
                    const p = livePlayers.find((player) => player.id === item.id);
                    if (!p) return null;
                    const isCurrent = session.currentPlayerId === p.id && session.status === "IN_PROGRESS";

                    return (
                      <div
                        key={p.id}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                          isCurrent
                            ? "border-amber-500 bg-amber-50/70 shadow-sm ring-1 ring-amber-500"
                            : item.status === "SOLD"
                            ? "border-slate-200 bg-slate-50/60 opacity-60"
                            : item.status === "UNSOLD"
                            ? "border-slate-200 bg-slate-50/60 opacity-60"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-mono text-[10px] text-slate-400">#{idx + 1}</span>
                            {isCurrent ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-600 text-white animate-pulse">
                                ON AUCTION
                              </span>
                            ) : item.status === "SOLD" ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-600 text-white">
                                SOLD
                              </span>
                            ) : item.status === "UNSOLD" ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-300 text-slate-700">
                                UNSOLD
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                PENDING
                              </span>
                            )}
                          </div>

                          <h5 className="font-bold text-xs text-slate-900 truncate" title={p.fullName}>
                            {p.fullName}
                          </h5>
                          <p className="text-[10px] text-slate-500 truncate">
                            {formatRole(p.primaryRole)} • {p.category}
                          </p>
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                          <span className="font-mono font-semibold text-slate-700">
                            {formatCurrency(p.basePriceOverride || p.basePrice, true)}
                          </span>

                          {item.status === "PENDING" && !isCurrent && (
                            <button
                              type="button"
                              onClick={() => selectLot(p.id)}
                              className="text-[9px] font-bold text-amber-700 hover:text-amber-900 underline"
                            >
                              Spotlight
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top Split: Active Player Card & Standing Bid / Timer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Active Player Card */}
            {!currentPlayer ? (
              <Card className="lg:col-span-6 bg-white border border-slate-200 shadow-sm rounded-2xl p-8 flex items-center justify-center text-center">
                <div className="space-y-3 max-w-sm">
                  <Users className="w-10 h-10 text-slate-300 mx-auto" />
                  <h3 className="text-base font-bold text-slate-900">No Active Lot in Auction</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Select a player lot or import your tournament roster in Player Management to begin bidding.
                  </p>
                  <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                    <Link href="/admin/players">Import Players</Link>
                  </Button>
                </div>
              </Card>
            ) : (
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
                        <div className="w-full h-full bg-emerald-50 flex items-center justify-center text-emerald-800 font-bold text-lg">
                          {currentPlayer.fullName.substring(0, 2).toUpperCase()}
                        </div>
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
                        {session.round === 2 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            ROUND 2
                          </span>
                        )}
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
            )}

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

                  const isCompleted = analysis?.isCompleted ?? (playersPurchased >= minimumSquadSize);

                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isLeader
                          ? "border-emerald-600 bg-emerald-50/60 shadow-sm ring-1 ring-emerald-600"
                          : isCompleted
                          ? "border-purple-200 bg-purple-50/40 opacity-90 shadow-sm"
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
                          ) : isCompleted ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200 tracking-wide">
                              SQUAD COMPLETED
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
                            <span className={`font-semibold ${isCompleted ? "text-purple-700" : "text-slate-700"}`}>
                              {playersPurchased} / {minimumSquadSize} Players
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
                        {isCompleted ? (
                          <div
                            title={`Squad completed (${playersPurchased}/${minimumSquadSize} players required)`}
                            className="w-full py-1 px-1.5 rounded-lg bg-purple-50 text-purple-700 font-medium text-xs flex flex-col items-center justify-center border border-purple-200/80"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[9px] font-bold text-purple-800 uppercase tracking-wide">
                                Squad Completed
                              </span>
                              <span className="text-[8px] font-semibold text-purple-600 uppercase">
                                {playersPurchased}/{minimumSquadSize}
                              </span>
                            </div>
                            <span className="text-[8px] text-purple-600 truncate w-full text-left font-sans mt-0.5">
                              Quota reached • Bidding inactive
                            </span>
                          </div>
                        ) : isEligible ? (
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
                  disabled={!currentPlayer || session.bidCount === 0 || !session.currentLeadingTeam}
                  size="lg"
                  className="w-full gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-sm"
                >
                  <Gavel className="w-5 h-5 fill-white" />
                  HAMMER DOWN (SOLD • ENTER)
                </Button>

                <Button
                  onClick={() => handleMarkUnsold("Manual passed by auctioneer")}
                  disabled={!currentPlayer}
                  size="lg"
                  variant="outline"
                  className="w-full gap-2 font-semibold border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
