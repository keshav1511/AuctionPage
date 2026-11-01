"use client";

import { useState, useEffect, useMemo } from "react";
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
import { useLeague } from "@/lib/context/league-context";
import { useRealtimeAuction } from "@/lib/hooks/use-realtime-auction";
import {
  TrendingUp,
  Award,
  Sparkles,
  Zap,
  Radio,
  Users,
  Coins,
  Flame,
  Trophy,
} from "lucide-react";
import { Player } from "@/types";

export default function LiveAuctionStage() {
  const { activeLeague } = useLeague();
  const {
    session,
    teams: liveTeams,
    players: livePlayers,
    isConnected,
    remainingSeconds,
    isHammered,
  } = useRealtimeAuction(activeLeague.id);

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
    const config = activeLeague.backgroundConfig;
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
  }, [activeLeague.backgroundConfig]);

  const overlayOpacity = activeLeague.backgroundConfig?.overlayOpacity != null
    ? activeLeague.backgroundConfig.overlayOpacity / 100
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
        {activeLeague.backgroundConfig?.imageUrl && (
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
                {activeLeague.logoUrl ? (
                  <img src={activeLeague.logoUrl} alt={activeLeague.name} className="w-full h-full object-contain" />
                ) : (
                  <span className="font-black text-amber-400 text-lg sm:text-xl">{activeLeague.slug?.substring(0, 3).toUpperCase()}</span>
                )}
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-amber-400 block">
                  Official Auction Room
                </span>
                <h1 className="text-base sm:text-2xl font-black text-white uppercase tracking-tight">
                  {activeLeague.name}
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

              {/* Category / Role Badge at top left of photo */}
              <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-black shadow-md ${getCategoryBadgeColor(annPlayer?.category || "SILVER")}`}>
                  {annPlayer?.category || "SILVER"}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-black/70 text-slate-300 backdrop-blur-xs">
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
        {activeLeague.backgroundConfig?.imageUrl && (
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
                {activeLeague.logoUrl ? (
                  <img src={activeLeague.logoUrl} alt={activeLeague.name} className="w-full h-full object-contain" />
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
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold ${getCategoryBadgeColor(p.category)}`}>
                            {p.category}
                          </span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[70px]">
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
                <span>{activeLeague.name} • Official Finale Reveal</span>
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
        {activeLeague.backgroundConfig?.imageUrl && (
          <div className="fixed inset-0 z-0 pointer-events-none" style={backgroundStyle} />
        )}
        {/* Dark Overlay layer */}
        <div
          className="fixed inset-0 z-[1] pointer-events-none"
          style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
        />

        <div className="relative z-10 flex flex-col min-h-screen">
          <BroadcastHeader />

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
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${getCategoryBadgeColor(p.category)}`}>
                        {p.category}
                      </span>
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
              {activeLeague.name} Official Auction Stage
            </span>
          </div>
        </main>
        </div>
      </div>
    );
  }

  const player = session.currentPlayer || livePlayers[0];
  const leadingTeam = session.currentLeadingTeam || liveTeams[0];

  if (!player) {
    return (
      <div className="min-h-screen bg-[#070A0D] text-slate-100 flex flex-col relative select-none">
        <BroadcastHeader />
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div className="space-y-4 max-w-md">
            <Radio className="w-12 h-12 text-emerald-500 animate-pulse mx-auto" />
            <h2 className="text-xl font-bold uppercase tracking-wider text-white">Tournament Setup in Progress</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Roster and Franchises are being prepared by tournament administration. The live spectator experience will activate once lots are called.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070A0D] text-slate-100 flex flex-col overflow-x-hidden select-none relative">
      {/* Background Image layer */}
      {activeLeague.backgroundConfig?.imageUrl && (
        <div className="fixed inset-0 z-0 pointer-events-none" style={backgroundStyle} />
      )}
      {/* Dark Overlay layer */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <BroadcastHeader />
        {!isConnected && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-xs py-1.5 px-4 text-center font-medium flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Connection Interrupted — Reconnecting to live auction... Displaying last verified state.</span>
          </div>
        )}

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
                  {session.round === 2 ? (
                    <span className="text-amber-400 font-extrabold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" /> ROUND 2 – UNSOLD PLAYERS
                    </span>
                  ) : (
                    `Lot #${player.sortOrder || 1} • Round 1`
                  )}
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
                  {player.photoUrl ? (
                    <Image
                      src={player.photoUrl}
                      alt={player.fullName}
                      fill
                      className="object-cover"
                      priority
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-950 text-emerald-400 font-black text-5xl">
                      {player.fullName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
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
                {leadingTeam ? (
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
                            {formatCurrency(leadingTeam.purse?.remainingAmount || 0)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-charcoal-950/50 border border-slate-800 text-slate-500 text-xs text-center font-mono">
                    Awaiting opening bid from franchise
                  </div>
                )}
              </div>
            </div>

            {/* Countdown Clock Box */}
            <div className="bg-charcoal-900 rounded-2xl border-2 border-slate-800 p-6 flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black font-mono text-2xl border-2 transition-colors ${
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
                  <h4 className="text-white font-bold text-base">
                    {session.status === "PAUSED" ? "Auction Paused" : "Auction Countdown"}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {session.status === "PAUSED"
                      ? "Timer held by Auctioneer"
                      : remainingSeconds <= 5
                      ? "Going Three Times! Final Call"
                      : remainingSeconds <= 10
                      ? "Going Once... Going Twice..."
                      : "Open for Competitive Bidding"}
                  </p>
                </div>
              </div>

              {/* Real-time status pill (read-only) */}
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-charcoal-950/90 border border-slate-800 text-xs font-semibold">
                <Radio className={`w-3.5 h-3.5 ${isConnected ? "text-emerald-400 animate-pulse" : "text-amber-400"}`} />
                <span className={isConnected ? "text-emerald-400" : "text-amber-400 font-mono"}>
                  {isConnected ? "LIVE SYNCHRONIZED" : "CONNECTING..."}
                </span>
              </div>
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
              <span className="text-xs text-slate-400">Budget Cap: {formatCurrency(liveTeams[0]?.purse?.totalBudget || 100000)} / Team</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {liveTeams.map((t) => {
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
                        {t.squadCount}/{t.purse.minPlayers || 8}
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
    </div>
  );
}
