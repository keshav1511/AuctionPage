"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import confetti from "canvas-confetti";
import { BroadcastHeader } from "@/components/public/broadcast-header";
import { Badge } from "@/components/ui/badge";
import {
  formatCurrency,
  formatRole,
  getRoleBadgeColor,
} from "@/lib/utils";
import { LiveTeamDashboard } from "@/components/live/live-team-dashboard";
import { useLeague } from "@/lib/context/league-context";
import { useRealtimeAuction } from "@/lib/hooks/use-realtime-auction";
import {
  TrendingUp,
  Award,
  Sparkles,
  Radio,
  Users,
  Coins,
  Flame,
  Trophy,
} from "lucide-react";
import { Player, League } from "@/types";

function LiveAuctionContent() {
  const searchParams = useSearchParams();
  const queryTournamentId = searchParams.get("tournamentId") || searchParams.get("leagueId");
  const { activeLeague } = useLeague();
  const [resolvedTournamentId, setResolvedTournamentId] = useState<string>(queryTournamentId || "");
  const [resolvedTournament, setResolvedTournament] = useState<League | null>(null);

  useEffect(() => {
    if (queryTournamentId) {
      setResolvedTournamentId(queryTournamentId);
      return;
    }
    let isMounted = true;
    fetch("/api/tournaments/active")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && data.activeTournamentId) {
          setResolvedTournamentId(data.activeTournamentId);
          if (data.tournament) {
            setResolvedTournament(data.tournament);
          }
        }
      })
      .catch((err) => {
        console.warn("[Live] Failed to resolve active tournament:", err);
      });
    return () => {
      isMounted = false;
    };
  }, [queryTournamentId]);

  const effectiveLeagueId = resolvedTournamentId || activeLeague.id || "league-main";
  const currentLeague = resolvedTournament || activeLeague;

  const {
    session,
    teams: liveTeams,
    players: livePlayers,
    rules: liveRules,
    connectionStatus,
    currentRevision,
    remainingSeconds,
    isHammered,
  } = useRealtimeAuction(effectiveLeagueId);

  // Authoritative 5-second announcement timer calculation
  const [announcementRemaining, setAnnouncementRemaining] = useState<number>(0);

  useEffect(() => {
    if (!session.announcement || !session.announcement.endsAt) {
      setAnnouncementRemaining(0);
      return;
    }

    const checkDuration = () => {
      const endsAtMs = new Date(session.announcement!.endsAt).getTime();
      const nowMs = Date.now();
      const diff = Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
      setAnnouncementRemaining(diff);
    };

    checkDuration();
    const interval = setInterval(checkDuration, 200);
    return () => clearInterval(interval);
  }, [session.announcement]);

  const isAnnouncementActive = Boolean(
    session.announcement &&
    session.announcement.type !== "NONE" &&
    announcementRemaining > 0
  );

  // Trigger celebratory confetti when sold
  useEffect(() => {
    if (isHammered || (isAnnouncementActive && session.announcement?.type === "SOLD")) {
      confetti({
        particleCount: 160,
        spread: 90,
        origin: { y: 0.6 },
        colors: ["#F59E0B", "#10B981", "#FFFFFF", "#FBBF24"],
      });
    }
  }, [isHammered, isAnnouncementActive, session.announcement?.type, session.announcement?.playerId]);

  // Authoritative player lot and leading franchise derivations (unconditional hooks)
  const player: Player | null = useMemo(() => {
    if (session.currentPlayer) return session.currentPlayer;
    if (session.currentPlayerId) {
      return (
        livePlayers.find(
          (p) =>
            p.id === session.currentPlayerId ||
            p.registrationNo === session.currentPlayerId ||
            p.fullName === session.currentPlayerId
        ) || null
      );
    }
    return null;
  }, [session.currentPlayer, session.currentPlayerId, livePlayers]);

  const leadingTeam = useMemo(() => {
    if (session.currentLeadingTeam) return session.currentLeadingTeam;
    if (session.currentLeadingTeamId) {
      return (
        liveTeams.find(
          (t) =>
            t.id === session.currentLeadingTeamId ||
            t.shortCode === session.currentLeadingTeamId
        ) || null
      );
    }
    return null;
  }, [session.currentLeadingTeam, session.currentLeadingTeamId, liveTeams]);

  // Selected team in Finale screen
  const [selectedFinaleTeamId, setSelectedFinaleTeamId] = useState<string>("");

  const activeFinaleTeam = useMemo(() => {
    if (selectedFinaleTeamId) {
      return liveTeams.find((t) => t.id === selectedFinaleTeamId) || liveTeams[0];
    }
    return liveTeams[0];
  }, [liveTeams, selectedFinaleTeamId]);

  const activeFinaleTeamPlayers = useMemo(() => {
    if (!activeFinaleTeam) return [];
    return livePlayers.filter((p) => p.soldToTeamId === activeFinaleTeam.id);
  }, [livePlayers, activeFinaleTeam]);

  // Background Customization
  const backgroundStyle = useMemo(() => {
    const config = currentLeague.backgroundConfig;
    if (!config?.imageUrl) {
      return {
        background: "radial-gradient(circle at 50% 0%, rgba(5, 150, 105, 0.12) 0%, rgba(7, 10, 13, 0.98) 70%)",
      };
    }
    return {
      backgroundImage: `url(${config.imageUrl})`,
      backgroundPosition: config.position || "center",
      backgroundSize: config.scale === "fill" ? "100% 100%" : config.scale || "cover",
      backgroundRepeat: "no-repeat",
    };
  }, [currentLeague.backgroundConfig]);

  const overlayOpacity = currentLeague.backgroundConfig?.overlayOpacity != null
    ? currentLeague.backgroundConfig.overlayOpacity / 100
    : 0.55;

  const isRound2Transition =
    session.roundStage === "ROUND_2_TRANSITION" ||
    (session.round === 2 && !session.currentPlayerId && session.status !== "FINISHED");

  const returningPlayers: Player[] = useMemo(() => {
    if (session.round2Queue && session.round2Queue.length > 0) {
      return session.round2Queue
        .map((item) => livePlayers.find((p) => p.id === item.id))
        .filter((p): p is Player => p !== undefined);
    }
    return livePlayers.filter((p) => p.status === "UNSOLD");
  }, [session.round2Queue, livePlayers]);

  const totalPurseRemaining = useMemo(() => {
    return liveTeams.reduce((sum, t) => sum + (t.purse?.remainingAmount || 0), 0);
  }, [liveTeams]);

  // Dedicated FULL-SCREEN SOLD / UNSOLD ANNOUNCEMENT SCREEN (Module 2)
  if (isAnnouncementActive && session.announcement) {
    const ann = session.announcement;
    const isSold = ann.type === "SOLD";
    const annPlayer = ann.player || livePlayers.find((p) => p.id === ann.playerId);
    const annTeam = ann.winningTeam || liveTeams.find((t) => t.id === ann.winningTeamId);

    return (
      <div className="min-h-screen bg-[#070A0D] text-slate-100 flex flex-col justify-between overflow-x-hidden select-none relative">
        {/* Background Image layer */}
        {currentLeague.backgroundConfig?.imageUrl && (
          <div className="fixed inset-0 z-0 pointer-events-none" style={backgroundStyle} />
        )}
        {/* Dark Overlay layer */}
        <div
          className="fixed inset-0 z-[1] pointer-events-none"
          style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
        />

        <div className="relative z-10 flex flex-col min-h-screen justify-between p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto w-full">
          {/* Top Header: League Logo on Left, Winning Team on Right */}
          <header className="flex items-center justify-between border-b border-white/10 pb-4">
            {/* League Brand (LEFT) */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-slate-900 border border-white/20 flex items-center justify-center p-1 shadow-lg">
                {currentLeague.logoUrl ? (
                  <img src={currentLeague.logoUrl} alt={currentLeague.name} className="w-full h-full object-contain" />
                ) : (
                  <span className="font-black text-amber-400 text-lg sm:text-xl">{currentLeague.slug?.substring(0, 3).toUpperCase()}</span>
                )}
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-amber-400 block">
                  Official Auction Room
                </span>
                <h1 className="text-base sm:text-2xl font-black text-white uppercase tracking-tight">
                  {currentLeague.name}
                </h1>
              </div>
            </div>

            {/* Countdown Badge (CENTER) */}
            <div className="hidden sm:inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/60 border border-white/20 font-mono text-xs font-bold text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>OFFICIAL RESULT • NEXT LOT IN {announcementRemaining}S</span>
            </div>

            {/* Winning Team Brand (RIGHT) for SOLD, or League Seal for UNSOLD */}
            {isSold && annTeam ? (
              <div className="flex items-center gap-3 text-right">
                <div>
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-emerald-400 block">
                    Winning Franchise
                  </span>
                  <h2 className="text-base sm:text-2xl font-black text-white uppercase tracking-tight">
                    {annTeam.name}
                  </h2>
                </div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-slate-900 border border-emerald-500/40 flex items-center justify-center p-1 shadow-lg">
                  {annTeam.logoUrl ? (
                    <img src={annTeam.logoUrl} alt={annTeam.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="font-bold text-emerald-400 text-sm sm:text-lg">{annTeam.shortCode}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-bold font-mono">
                <span>UNSOLD LOT</span>
              </div>
            )}
          </header>

          {/* Center: Large Player Photograph with Falling Stamp Animation */}
          <main className="my-auto py-6 flex flex-col items-center justify-center relative">
            <div className="relative w-64 sm:w-80 lg:w-96 aspect-[3/4] rounded-3xl overflow-hidden border-4 border-slate-700/80 shadow-[0_20px_60px_rgba(0,0,0,0.9)] bg-slate-950">
              {annPlayer?.photoUrl ? (
                <img
                  src={annPlayer.photoUrl}
                  alt={annPlayer?.fullName || "Player"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-600 font-bold text-4xl">
                  {annPlayer?.fullName?.charAt(0) || "P"}
                </div>
              )}

              {/* Role Badge at top left of photo */}
              <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-black/70 text-slate-200 backdrop-blur-xs border border-white/10 shadow-md">
                  {formatRole(annPlayer?.primaryRole || "BATSMAN")}
                </span>
              </div>

              {/* Falling Animated Stamp Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                {isSold ? (
                  <div className="border-[6px] border-amber-400 bg-amber-500/20 backdrop-blur-xs px-8 py-3 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.6)] animate-stamp-impact text-center">
                    <span className="block font-black text-4xl sm:text-6xl lg:text-7xl tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-100 via-amber-300 to-yellow-500 uppercase drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                      SOLD
                    </span>
                  </div>
                ) : (
                  <div className="border-[6px] border-red-500 bg-red-600/20 backdrop-blur-xs px-8 py-3 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.6)] animate-stamp-impact text-center">
                    <span className="block font-black text-4xl sm:text-6xl lg:text-7xl tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-rose-400 to-red-600 uppercase drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                      UNSOLD
                    </span>
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* Bottom Announcement Card */}
          <footer className="w-full max-w-4xl mx-auto">
            {isSold ? (
              <div className="bg-gradient-to-r from-amber-950/95 via-yellow-950/90 to-amber-900/95 border-2 border-amber-500/70 shadow-[0_0_50px_rgba(245,158,11,0.3)] rounded-3xl p-5 sm:p-7 text-center backdrop-blur-md space-y-2">
                <span className="text-xs uppercase font-extrabold tracking-widest text-amber-300 block">
                  Official Lot Hammer Result
                </span>
                <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight uppercase">
                  {annPlayer?.fullName || "Player"}
                </h2>
                <div className="text-lg sm:text-2xl font-bold text-amber-200 uppercase tracking-wide">
                  SOLD TO <span className="text-white font-black">{annTeam?.name || "Franchise"}</span>
                </div>
                <div className="font-mono text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100 gold-glow pt-1">
                  {formatCurrency(ann.soldPrice || 0)}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-rose-950/95 via-red-950/90 to-slate-950/95 border-2 border-red-500/60 shadow-[0_0_50px_rgba(239,68,68,0.25)] rounded-3xl p-5 sm:p-7 text-center backdrop-blur-md space-y-2">
                <span className="text-xs uppercase font-extrabold tracking-widest text-rose-400 block">
                  Official Lot Hammer Result
                </span>
                <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight uppercase">
                  {annPlayer?.fullName || "Player"}
                </h2>
                <div className="text-base sm:text-xl font-bold text-rose-300 uppercase tracking-wide">
                  REMAINS UNSOLD IN THIS STAGE
                </div>
                <div className="font-mono text-xl sm:text-2xl font-semibold text-slate-400 pt-1">
                  Base Price: {formatCurrency(annPlayer?.basePrice || 25000)}
                </div>
              </div>
            )}
          </footer>
        </div>
      </div>
    );
  }

  // Dedicated FULL-SCREEN TOURNAMENT FINALE SCREEN (Module 3)
  if (session.status === "FINISHED") {
    const totalSold = livePlayers.filter((p) => p.status === "SOLD").length;
    const totalSpent = liveTeams.reduce((sum, t) => sum + (t.purse?.spentAmount || 0), 0);

    return (
      <div className="min-h-screen bg-[#070A0D] text-slate-100 flex flex-col justify-between overflow-x-hidden select-none relative">
        {/* Background Image layer */}
        {currentLeague.backgroundConfig?.imageUrl && (
          <div className="fixed inset-0 z-0 pointer-events-none" style={backgroundStyle} />
        )}
        {/* Dark Overlay layer */}
        <div
          className="fixed inset-0 z-[1] pointer-events-none"
          style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
        />

        <div className="relative z-10 flex flex-col min-h-screen p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto w-full justify-between">
          {/* Header */}
          <header className="flex flex-col sm:flex-row items-center justify-between border-b border-white/10 pb-5 gap-4">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-900 border border-amber-400/50 flex items-center justify-center p-1.5 shadow-lg">
                {currentLeague.logoUrl ? (
                  <img src={currentLeague.logoUrl} alt={currentLeague.name} className="w-full h-full object-contain" />
                ) : (
                  <Trophy className="w-7 h-7 text-amber-400" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400 block">
                  Official Tournament Reveal
                </span>
                <h1 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight">
                  AUCTION FINALE • TEAM SQUADS
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="px-4 py-2 rounded-xl bg-charcoal-900/90 border border-slate-800 text-left">
                <span className="text-[10px] text-slate-400 uppercase block">Players Acquired</span>
                <span className="font-bold text-white text-base">{totalSold} Players</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-charcoal-900/90 border border-slate-800 text-left">
                <span className="text-[10px] text-slate-400 uppercase block">Total Purse Invested</span>
                <span className="font-bold text-emerald-400 text-base">{formatCurrency(totalSpent, true)}</span>
              </div>
            </div>
          </header>

          {/* Franchise Selector Tabs */}
          <div className="my-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {liveTeams.map((t) => {
                const isSelected = activeFinaleTeam?.id === t.id;
                const auctionSquad = livePlayers.filter((p) => p.soldToTeamId === t.id);
                const preAssignedCount = (t.ownerName ? 1 : 0) + (t.iconPlayerName ? 1 : 0);
                const totalSquadCount = preAssignedCount + auctionSquad.length;
                const minSquad = t.purse?.minPlayers || 8;
                const isComplete = totalSquadCount >= minSquad;

                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedFinaleTeamId(t.id)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border transition-all shrink-0 ${
                      isSelected
                        ? "bg-amber-500/20 border-amber-400 shadow-md text-white font-bold ring-1 ring-amber-400"
                        : "bg-charcoal-900/80 border-slate-800 hover:border-slate-700 text-slate-300"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
                      {t.logoUrl ? (
                        <img src={t.logoUrl} alt={t.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-bold text-[10px] text-amber-400">{t.shortCode}</span>
                      )}
                    </div>
                    <span className="text-xs uppercase font-extrabold truncate max-w-[140px]">{t.name}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isComplete ? "bg-purple-900/80 text-purple-200 border border-purple-500/40" : "bg-slate-800 text-slate-400"}`}>
                      {totalSquadCount}/{minSquad}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Franchise Showcase Card */}
          {activeFinaleTeam && (
            <main className="flex-1 bg-charcoal-900/90 rounded-3xl border-2 border-slate-800 p-6 lg:p-8 flex flex-col justify-between shadow-2xl backdrop-blur-md">
              {/* Franchise Showcase Header */}
              <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-800/80 pb-6 gap-4">
                <div className="flex items-center gap-4 text-center sm:text-left">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/10 border-2 border-white/20 flex items-center justify-center p-2 shadow-xl shrink-0">
                    {activeFinaleTeam.logoUrl ? (
                      <img src={activeFinaleTeam.logoUrl} alt={activeFinaleTeam.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="font-black text-2xl text-amber-400">{activeFinaleTeam.shortCode}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight">
                        {activeFinaleTeam.name}
                      </h2>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 uppercase">
                        Squad Completed
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      Spent: {formatCurrency(activeFinaleTeam.purse?.spentAmount || 0)} • Remaining: {formatCurrency(activeFinaleTeam.purse?.remainingAmount || 0)}
                    </p>
                  </div>
                </div>

                {/* Owner & Icon Badges */}
                <div className="flex items-center gap-4">
                  {/* Franchise Owner */}
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-charcoal-950 border border-slate-800 text-left">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-800 border-2 border-amber-400/60 shrink-0">
                      {activeFinaleTeam.ownerPhotoUrl ? (
                        <img src={activeFinaleTeam.ownerPhotoUrl} alt={activeFinaleTeam.ownerName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-amber-400 text-sm">
                          {activeFinaleTeam.ownerName?.charAt(0) || "O"}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-400 block">
                        FRANCHISE OWNER
                      </span>
                      <span className="text-xs font-bold text-white truncate max-w-[110px] block">
                        {activeFinaleTeam.ownerName || "Franchise Owner"}
                      </span>
                    </div>
                  </div>

                  {/* Icon Player */}
                  {activeFinaleTeam.iconPlayerName && (
                    <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-charcoal-950 border border-slate-800 text-left">
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-800 border-2 border-emerald-400/60 shrink-0">
                        {activeFinaleTeam.iconPlayerPhotoUrl ? (
                          <img src={activeFinaleTeam.iconPlayerPhotoUrl} alt={activeFinaleTeam.iconPlayerName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-emerald-400 text-sm">
                            {activeFinaleTeam.iconPlayerName?.charAt(0) || "I"}
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-400 block">
                          ICON PLAYER
                        </span>
                        <span className="text-xs font-bold text-white truncate max-w-[110px] block">
                          {activeFinaleTeam.iconPlayerName}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Player Squad Grid */}
              <div className="my-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" /> Auction Signings ({activeFinaleTeamPlayers.length} / 6 Acquired)
                  </h3>
                  <span className="text-xs text-emerald-400 font-mono font-bold">
                    Total Squad: {activeFinaleTeamPlayers.length + ((activeFinaleTeam.ownerName ? 1 : 0) + (activeFinaleTeam.iconPlayerName ? 1 : 0))} / {activeFinaleTeam.purse?.minPlayers || 8}
                  </span>
                </div>

                {activeFinaleTeamPlayers.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-charcoal-950/60 rounded-2xl border border-slate-800">
                    No players purchased in this auction
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                    {activeFinaleTeamPlayers.map((p) => (
                      <div
                        key={p.id}
                        className="bg-charcoal-950/80 rounded-2xl border border-slate-800 p-3 flex flex-col items-center text-center shadow-md transition-all hover:border-amber-400/40"
                      >
                        {/* Circular portrait frame */}
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-amber-400/70 overflow-hidden bg-slate-900 shadow-inner mb-2 shrink-0">
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt={p.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-lg">
                              {p.fullName?.charAt(0)}
                            </div>
                          )}
                        </div>

                        <h4 className="font-bold text-xs text-white truncate w-full" title={p.fullName}>
                          {p.fullName}
                        </h4>

                        <div className="flex items-center gap-1 my-1">
                          <span className="text-[10px] text-slate-400 font-medium truncate">
                            {formatRole(p.primaryRole)}
                          </span>
                        </div>

                        <span className="font-mono text-emerald-400 font-bold text-[11px] mt-1">
                          {formatCurrency(p.soldPrice || p.basePrice, true)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer Ticker */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>{currentLeague.name} • Official Finale Reveal</span>
                <span>Franchise Squad Complete</span>
              </div>
            </main>
          )}
        </div>
      </div>
    );
  }

  // Dedicated ROUND 2 – UNSOLD PLAYERS Transition Screen
  if (isRound2Transition) {
    return (
      <div className="min-h-screen bg-[#070A0D] text-slate-100 flex flex-col overflow-x-hidden select-none relative">
        {/* Background Image layer */}
        {currentLeague.backgroundConfig?.imageUrl && (
          <div className="fixed inset-0 z-0 pointer-events-none" style={backgroundStyle} />
        )}
        {/* Dark Overlay layer */}
        <div
          className="fixed inset-0 z-[1] pointer-events-none"
          style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
        />

        <div className="relative z-10 flex flex-col min-h-screen">
          <BroadcastHeader tournament={currentLeague} />

        <main className="flex-1 p-4 lg:p-8 flex flex-col justify-between max-w-[1920px] mx-auto w-full">
          {/* Transition Hero Banner */}
          <div className="text-center my-6 relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold tracking-widest uppercase">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>STAGE TRANSITION • SECOND CHANCE AUCTION</span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-500 gold-glow">
              ROUND 2 – UNSOLD PLAYERS
            </h1>

            <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto font-medium">
              Round 1 has concluded. {returningPlayers.length} elite cricketers return to the auction floor
              in randomized sequence. Franchises will compete once more with remaining purse balances.
            </p>

            {/* Quick Metrics Bar */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 pt-2">
              <div className="px-5 py-2.5 rounded-xl bg-charcoal-900/80 border border-slate-800 flex items-center gap-3">
                <Users className="w-5 h-5 text-amber-400" />
                <div className="text-left">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Returning Players</span>
                  <span className="font-mono text-lg font-bold text-white">{returningPlayers.length}</span>
                </div>
              </div>

              <div className="px-5 py-2.5 rounded-xl bg-charcoal-900/80 border border-slate-800 flex items-center gap-3">
                <Coins className="w-5 h-5 text-emerald-400" />
                <div className="text-left">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">League Purse Available</span>
                  <span className="font-mono text-lg font-bold text-emerald-400">{formatCurrency(totalPurseRemaining, true)}</span>
                </div>
              </div>

              <div className="px-5 py-2.5 rounded-xl bg-charcoal-900/80 border border-slate-800 flex items-center gap-3">
                <Flame className="w-5 h-5 text-yellow-400" />
                <div className="text-left">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Stage Status</span>
                  <span className="font-mono text-xs font-bold text-amber-300 uppercase">Queue Locked & Ready</span>
                </div>
              </div>
            </div>
          </div>

          {/* Returning Players Gallery Grid */}
          <div className="my-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" /> Returning Player Pool ({returningPlayers.length})
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Order: Authoritatively randomized once
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {returningPlayers.map((p, idx) => (
                <div
                  key={p.id}
                  className="bg-charcoal-900/90 rounded-2xl border border-slate-800 hover:border-amber-500/50 p-3.5 flex flex-col justify-between shadow-lg backdrop-blur-md transition-all hover:scale-[1.02]"
                >
                  <div>
                    {/* Photo with 3:4 aspect ratio */}
                    <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-slate-900 border border-slate-700/60 mb-2.5">
                      {p.photoUrl ? (
                        <Image
                          src={p.photoUrl}
                          alt={p.fullName}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900 text-amber-400 font-bold text-2xl">
                          {p.fullName.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/70 text-amber-300 border border-amber-500/30">
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent py-1.5 px-2">
                        <span className="text-[9px] font-black tracking-wider text-amber-300 uppercase truncate block">
                          ROUND 2
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] text-slate-400 font-medium truncate">
                        {formatRole(p.primaryRole)}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-white truncate" title={p.fullName}>
                      {p.fullName}
                    </h4>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-[10px] text-slate-500 uppercase">Base:</span>
                    <span className="font-mono font-bold text-amber-300">
                      {formatCurrency(p.basePriceOverride || p.basePrice, true)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Live Broadcast Ticker */}
          <div className="p-3.5 rounded-xl bg-charcoal-900/80 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Broadcast Live • Awaiting Auctioneer to call first Round 2 lot</span>
            </div>
            <span className="font-mono text-slate-500 text-[11px]">
              {currentLeague.name} Official Auction Stage
            </span>
          </div>
        </main>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-[#070A0D] text-slate-100 flex flex-col relative select-none">
        <BroadcastHeader tournament={currentLeague} />
        <div className="flex-1 flex items-center justify-center p-4 text-center">
          <div className="space-y-3 max-w-md bg-charcoal-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-2xl">
            <Radio className="w-10 h-10 text-emerald-400 animate-pulse mx-auto" />
            <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
              Awaiting Next Lot
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              The live auction room is synchronized and ready. The tournament auctioneer will call the next lot to the bidding floor momentarily.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                Live Synchronized • r{currentRevision}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070A0D] text-slate-100 flex flex-col overflow-x-hidden select-none relative">
      {/* Background Image layer */}
      {currentLeague.backgroundConfig?.imageUrl && (
        <div className="fixed inset-0 z-0 pointer-events-none" style={backgroundStyle} />
      )}
      {/* Dark Overlay layer */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <BroadcastHeader tournament={currentLeague} />
        {connectionStatus === "reconnecting" && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-[11px] py-1 px-4 text-center font-medium flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span>Reconnecting to live auction stream... Showing verified state (r{currentRevision}).</span>
          </div>
        )}
        {connectionStatus === "unavailable" && (
          <div className="bg-rose-500/15 border-b border-rose-500/30 text-rose-300 text-[11px] py-1 px-4 text-center font-medium flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            <span>Connection Unavailable — Attempting to restore live synchronization...</span>
          </div>
        )}

      {/* Main Broadcast Stage Canvas - Optimized for 100% Zoom across 1366x768 to 1920x1080 */}
      <main className="flex-1 px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex flex-col justify-between max-w-[1920px] mx-auto w-full">
        {/* Top Grid: Player Spotlight + High Bid & Timer Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-3.5 items-stretch">
          {/* LEFT: Player Spotlight (Lot Card) */}
          <div className="lg:col-span-7 bg-charcoal-900/90 rounded-2xl border-2 border-slate-800 p-3.5 sm:p-4 flex flex-col justify-between relative overflow-hidden shadow-xl backdrop-blur-md">
            {/* Background subtle watermark */}
            <div className="absolute -right-8 -bottom-8 opacity-5 pointer-events-none text-8xl font-black">
              {currentLeague.name.charAt(0)}
            </div>

            {/* Top Bar of Card: Registration No, Lot, Category */}
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 font-mono text-xs font-bold text-emerald-400">
                  {player.registrationNo}
                </span>
                <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                  {session.round === 2 ? (
                    <span className="text-amber-400 font-extrabold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" /> ROUND 2
                    </span>
                  ) : (
                    `Lot #${player.sortOrder || 1} • Round 1`
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={`text-[11px] px-2.5 py-0.5 font-semibold ${getRoleBadgeColor(
                    player.primaryRole
                  )}`}
                >
                  {formatRole(player.primaryRole)}
                </Badge>
              </div>
            </div>

            {/* Middle Section: Player Photo & Profile Details */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 my-2 sm:my-2.5 items-center z-10">
              {/* Photo Box - Compact aspect 3:4 */}
              <div className="sm:col-span-4 flex justify-center">
                <div className="relative w-24 h-32 sm:w-28 sm:h-36 lg:w-32 lg:h-40 rounded-xl overflow-hidden border-2 border-slate-700/70 shadow-lg shadow-black/60 bg-slate-900 shrink-0">
                  {player.photoUrl ? (
                    <Image
                      src={player.photoUrl}
                      alt={player.fullName}
                      fill
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-950 text-emerald-400 font-black text-3xl">
                      {player.fullName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  {/* Category ribbon across photo */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent py-1 px-2 text-center">
                    <span className="text-[9px] font-black tracking-widest text-amber-300 uppercase truncate block">
                      {activeLeague.name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Player Attributes & Bio */}
              <div className="sm:col-span-8 space-y-2">
                <div>
                  <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white uppercase leading-tight truncate" title={player.fullName}>
                    {player.fullName}
                  </h2>
                  <p className="text-xs font-medium text-emerald-400">
                    {player.battingStyle} • {player.bowlingStyle}
                  </p>
                </div>

                {/* Tournament Stats Capsule */}
                <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-charcoal-950/80 border border-slate-800 text-center">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-semibold">
                      Matches
                    </span>
                    <p className="font-mono text-sm sm:text-base font-bold text-white">
                      {player.statsSummary?.matches || 48}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-semibold">
                      Runs
                    </span>
                    <p className="font-mono text-sm sm:text-base font-bold text-amber-400">
                      {player.statsSummary?.runs || 1420}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-semibold">
                      Wickets
                    </span>
                    <p className="font-mono text-sm sm:text-base font-bold text-emerald-400">
                      {player.statsSummary?.wickets || 52}
                    </p>
                  </div>
                </div>

                {/* Notable achievement badge */}
                {player.statsSummary?.notableAchievement && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-200 truncate">
                    <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">{player.statsSummary.notableAchievement}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row of Player Spotlight: Base Price Indicator */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between z-10">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Base Starting Price
              </span>
              <span className="font-mono text-base sm:text-lg font-bold text-slate-200">
                {formatCurrency(player.basePrice)}
              </span>
            </div>
          </div>

          {/* RIGHT: High Bid Monitor, Countdown, Leading Team */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-3 sm:gap-3.5">
            {/* Top Bid Banner */}
            <div className="bg-gradient-to-br from-charcoal-900 to-charcoal-950 rounded-2xl border-2 border-amber-500/40 p-3.5 sm:p-4 shadow-xl relative overflow-hidden flex flex-col justify-between flex-1">
              {/* Subtle gold accent light */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Standing Highest Bid
                </span>
                <Badge variant="gold" className="text-[10px] px-2 py-0.2 font-mono">
                  {session.bidCount} Bids Placed
                </Badge>
              </div>

              {/* Tabular Bid Number */}
              <div className="my-auto py-1">
                <div className="font-mono font-black text-4xl sm:text-5xl lg:text-6xl tracking-tight bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 bg-clip-text text-transparent gold-glow">
                  {formatCurrency(session.currentHighestBid)}
                </div>
              </div>

              {/* Leading Franchise Callout */}
              <div className="pt-2.5 border-t border-slate-800/80">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mb-1">
                  Leading Franchise
                </span>
                {leadingTeam ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-charcoal-950/90 border border-amber-500/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-amber-400 text-sm border border-slate-700 shrink-0">
                        {leadingTeam.shortCode}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-white text-xs sm:text-sm truncate">
                          {leadingTeam.name}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Remaining:{" "}
                          <span className="text-emerald-400 font-mono font-semibold">
                            {formatCurrency(leadingTeam.purse?.remainingAmount || 0, true)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <Sparkles className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-charcoal-950/50 border border-slate-800 text-slate-500 text-[10px] text-center font-mono">
                    Awaiting opening bid from franchise
                  </div>
                )}
              </div>
            </div>

            {/* Countdown Clock Box */}
            <div className="bg-charcoal-900 rounded-xl border-2 border-slate-800 p-2.5 sm:p-3 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-black font-mono text-lg sm:text-xl border-2 transition-colors shrink-0 ${
                    session.status === "PAUSED"
                      ? "bg-amber-500/20 border-amber-500 text-amber-400"
                      : remainingSeconds <= 5
                      ? "bg-red-500/20 border-red-500 text-red-400 animate-ping"
                      : remainingSeconds <= 10
                      ? "bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse"
                      : "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                  }`}
                >
                  {session.status === "PAUSED" ? "⏸" : `${remainingSeconds}s`}
                </div>
                <div>
                  <h4 className="text-white font-bold text-xs sm:text-sm">
                    {session.status === "PAUSED" ? "Auction Paused" : "Auction Countdown"}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {session.status === "PAUSED"
                      ? "Timer held by Auctioneer"
                      : remainingSeconds <= 5
                      ? "Final Call • Going Three Times!"
                      : remainingSeconds <= 10
                      ? "Going Once... Going Twice..."
                      : "Open for Competitive Bidding"}
                  </p>
                </div>
              </div>

              {/* Real-time status pill */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-charcoal-950/90 border border-slate-800 text-[10px] font-semibold">
                <Radio className={`w-3 h-3 ${connectionStatus === "connected" ? "text-emerald-400 animate-pulse" : "text-amber-400"}`} />
                <span className={connectionStatus === "connected" ? "text-emerald-400 font-mono" : "text-amber-400 font-mono"}>
                  {connectionStatus === "connected" ? `LIVE SYNC • r${currentRevision}` : connectionStatus === "reconnecting" ? "RECONNECTING..." : "UNAVAILABLE"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Live Team Dashboard (Four Team Cards directly below central auction stage) */}
        <LiveTeamDashboard
          teams={liveTeams}
          players={livePlayers}
          session={session}
          rules={liveRules}
        />

        {/* SECTION 3: Live Activity & Recent Bid Transactions */}
        <div className="mt-4 sm:mt-5 bg-charcoal-900/90 rounded-xl border border-slate-800 p-3 sm:p-4 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between mb-2 sm:mb-2.5">
            <div>
              <h3 className="font-black text-white text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                Live Auction Activity & Recent Bids
              </h3>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-charcoal-950 border border-slate-800">
              <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === "connected" ? "bg-emerald-400 animate-ping" : "bg-amber-400"}`} />
              <span className={`text-[10px] font-mono font-semibold ${connectionStatus === "connected" ? "text-emerald-400" : "text-amber-400"}`}>
                {connectionStatus === "connected" ? `SYNC r${currentRevision}` : "RECONNECTING"}
              </span>
            </div>
          </div>

          {session.recentBids && session.recentBids.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {session.recentBids.slice(0, 8).map((b, idx) => (
                <div
                  key={b.id || idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-charcoal-950/80 border border-slate-800 text-[11px] hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-[10px] text-amber-400 shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="font-bold text-white block truncate text-[11px]" title={b.teamName}>
                        {b.teamName}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {b.placedAt
                          ? new Date(b.placedAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })
                          : "Standing Bid"}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-black text-emerald-400 text-xs shrink-0">
                    {formatCurrency(b.amount, true)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 px-3 rounded-lg bg-charcoal-950/40 border border-dashed border-slate-800 text-center">
              <p className="text-[11px] text-slate-400 font-medium">Awaiting opening bid transactions for this lot</p>
            </div>
          )}
        </div>
      </main>
      </div>
    </div>
  );
}

export default function LiveAuctionStage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-charcoal-950 flex items-center justify-center text-slate-400 select-none">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold tracking-wide">Connecting to Live Auction Stage...</span>
          </div>
        </div>
      }
    >
      <LiveAuctionContent />
    </Suspense>
  );
}

