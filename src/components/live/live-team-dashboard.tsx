"use client";

import React, { useMemo } from "react";
import { Team, Player, AuctionSession, AuctionRules } from "@/types";
import { formatCurrency, formatRole, getRoleBadgeColor } from "@/lib/utils";
import { getTeamParticipantCounts } from "@/lib/auction/team-size-calculator";
import { Progress } from "@/components/ui/progress";
import { Users, TrendingUp, Sparkles, CheckCircle2 } from "lucide-react";

interface LiveTeamDashboardProps {
  teams: Team[];
  players: Player[];
  session: AuctionSession;
  rules: AuctionRules;
}

export function LiveTeamDashboard({
  teams,
  players,
  session,
  rules,
}: LiveTeamDashboardProps) {
  const sortedTeams = useMemo(() => {
    return [...teams];
  }, [teams]);

  return (
    <section className="w-full mt-4 sm:mt-5 select-none">
      <div className="flex items-center justify-between mb-2.5 sm:mb-3">
        <div>
          <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            Live Team Dashboard
          </h3>
          <p className="text-[11px] text-slate-400">
            Real-time franchise purse, participant quotas, and acquired auction squads
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
            {teams.length} Franchises Active
          </span>
        </div>
      </div>

      {/* Responsive Four Team Cards Grid: 4 cols on lg, 2 cols on sm, 1 col on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 lg:gap-4 items-stretch">
        {sortedTeams.map((team) => {
          // 1. Acquired players for this franchise
          const teamSoldPlayers = players.filter(
            (p) => p.status === "SOLD" && p.soldToTeamId === team.id
          );

          // 2. Authoritative participant counts (registered + owner (1) + icon (1))
          const counts = getTeamParticipantCounts(team, teamSoldPlayers.length);

          // 3. Financial calculations
          const totalPurse = team.purse?.totalBudget || 100000;
          const spentAmount = teamSoldPlayers.reduce(
            (sum, p) => sum + (p.soldPrice || p.basePrice || 0),
            0
          );
          const remainingPurse = Math.max(0, totalPurse - spentAmount);

          // 4. Bidding state
          const isLeading =
            session.currentLeadingTeamId === team.id &&
            (session.currentHighestBid || 0) > 0;
          const currentBidAmount = session.currentHighestBid || 0;

          // 5. Squad composition & capacity
          const minSquad = team.purse?.minPlayers || rules.minimumSquadSize || 8;
          const maxSquad = team.purse?.maxPlayers || rules.maximumSquadSize || 8;
          const additionalRequired = Math.max(0, minSquad - counts.totalParticipants);
          const remainingCapacity = Math.max(0, maxSquad - counts.totalParticipants);
          const isMinSquadMet = counts.totalParticipants >= minSquad;
          const isMaxSquadReached = counts.totalParticipants >= maxSquad;

          const spentPercentage = Math.min(
            100,
            Math.max(0, (spentAmount / (totalPurse || 1)) * 100)
          );

          return (
            <div
              key={team.id}
              className={`rounded-xl border transition-all duration-200 flex flex-col justify-between overflow-hidden relative backdrop-blur-md ${
                isLeading
                  ? "ring-2 ring-amber-400 border-amber-400/90 bg-gradient-to-b from-amber-950/40 via-charcoal-900/95 to-charcoal-950 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                  : "border-slate-800 bg-charcoal-900/90 hover:border-slate-700 shadow-md"
              }`}
            >
              {/* Top Accent Strip */}
              <div
                className="h-1 w-full shrink-0"
                style={{ backgroundColor: team.primaryColor || "#059669" }}
              />

              <div className="p-3 sm:p-3.5 flex-1 flex flex-col gap-2.5 sm:gap-3">
                {/* 1. Team Identity Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Team Logo */}
                    {team.logoUrl ? (
                      <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg overflow-hidden bg-slate-950/80 border border-slate-700/80 p-0.5 shrink-0 shadow-xs">
                        <img
                          src={team.logoUrl}
                          alt={team.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center font-black text-white text-xs shadow-xs shrink-0 border border-white/20"
                        style={{ backgroundColor: team.primaryColor || "#059669" }}
                      >
                        {team.shortCode || team.name.substring(0, 3).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[9px] font-bold px-1 rounded bg-slate-800 text-amber-300 border border-slate-700">
                          {team.shortCode}
                        </span>
                      </div>
                      <h4
                        className="font-black text-white text-xs sm:text-sm truncate leading-tight mt-0.5"
                        title={team.name}
                      >
                        {team.name}
                      </h4>
                    </div>
                  </div>

                  {/* Leading Bid Badge */}
                  {isLeading ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 animate-pulse shrink-0">
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                      <span className="text-[8px] font-black uppercase tracking-wider">
                        LEADING
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* 2. Owner & Icon Representatives */}
                <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-lg bg-charcoal-950/80 border border-slate-800/80 text-[11px]">
                  {/* Owner */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="relative w-6 h-6 rounded-full overflow-hidden bg-slate-800 border border-amber-500/50 shrink-0 flex items-center justify-center">
                      {team.ownerPhotoUrl ? (
                        <img
                          src={team.ownerPhotoUrl}
                          alt={team.ownerName || "Owner"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-bold text-[8px] text-amber-300">
                          {(team.ownerName || "OW").substring(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[7px] font-bold text-amber-400/90 uppercase tracking-wider">
                        Owner
                      </span>
                      <span
                        className="block text-[10px] font-semibold text-white truncate"
                        title={team.ownerName || "TBD"}
                      >
                        {team.ownerName || "TBD"}
                      </span>
                    </div>
                  </div>

                  {/* Icon / Representative */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="relative w-6 h-6 rounded-full overflow-hidden bg-slate-800 border border-emerald-500/50 shrink-0 flex items-center justify-center">
                      {team.iconPlayerPhotoUrl ? (
                        <img
                          src={team.iconPlayerPhotoUrl}
                          alt={team.iconPlayerName || "Icon"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-bold text-[8px] text-emerald-300">
                          {(team.iconPlayerName || "IC").substring(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[7px] font-bold text-emerald-400/90 uppercase tracking-wider">
                        Icon / Rep
                      </span>
                      <span
                        className="block text-[10px] font-semibold text-white truncate"
                        title={team.iconPlayerName || "TBD"}
                      >
                        {team.iconPlayerName || "TBD"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Financial Section */}
                <div className="space-y-1.5 p-2 sm:p-2.5 rounded-lg bg-charcoal-950/70 border border-slate-800/80">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      Purse Left
                    </span>
                    <span className="font-mono text-sm sm:text-base font-black text-emerald-400">
                      {formatCurrency(remainingPurse, true)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Spent / Total:</span>
                    <span className="font-mono text-slate-300">
                      {formatCurrency(spentAmount, true)} / {formatCurrency(totalPurse, true)}
                    </span>
                  </div>

                  {/* Active Bid Commitment (if leading) */}
                  {isLeading && (
                    <div className="pt-1 border-t border-amber-500/30 flex items-center justify-between text-[10px]">
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Bid:
                      </span>
                      <span className="font-mono font-black text-amber-300">
                        {formatCurrency(currentBidAmount)}
                      </span>
                    </div>
                  )}

                  <Progress
                    value={spentPercentage}
                    className="h-1 bg-slate-800"
                    indicatorClassName={isLeading ? "bg-amber-400" : "bg-emerald-500"}
                  />
                </div>

                {/* 4. Squad Composition & Requirements */}
                <div className="space-y-1 p-2 rounded-lg bg-charcoal-950/60 border border-slate-800/80 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">Total Squad:</span>
                    <span className="font-mono font-black text-white">
                      {counts.totalParticipants} / {maxSquad}{" "}
                      <span className="font-normal text-slate-400 font-sans text-[9px]">
                        Participants
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-slate-400">
                    <span>{counts.registeredPlayersCount} Reg + {counts.ownerCount} Owner + {counts.iconCount} Icon</span>
                    <span className="font-mono text-slate-300">
                      {isMaxSquadReached ? "Full" : `${remainingCapacity} slot${remainingCapacity === 1 ? "" : "s"}`}
                    </span>
                  </div>

                  <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between">
                    {isMinSquadMet ? (
                      <span className="inline-flex items-center gap-1 text-[8px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Min Met ({minSquad})
                      </span>
                    ) : (
                      <span className="text-[8px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.2 rounded">
                        Needs {additionalRequired} more ({counts.totalParticipants}/{minSquad})
                      </span>
                    )}
                  </div>
                </div>

                {/* 5. Purchased Player Stack */}
                <div className="pt-1.5 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-400" />
                      Signings ({teamSoldPlayers.length})
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {teamSoldPlayers.length}/{Math.max(0, maxSquad - (counts.ownerCount + counts.iconCount))}
                    </span>
                  </div>

                  {teamSoldPlayers.length === 0 ? (
                    <div className="py-2.5 px-2 rounded-lg bg-charcoal-950/40 border border-dashed border-slate-800 text-center">
                      <p className="text-[10px] text-slate-500 font-medium">No players acquired yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-[85px] overflow-y-auto pr-1 scrollbar-thin">
                      {teamSoldPlayers.map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between p-1.5 rounded-md bg-charcoal-950/80 border border-slate-800/80 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="relative w-5 h-5 rounded-full overflow-hidden bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
                              {player.photoUrl ? (
                                <img
                                  src={player.photoUrl}
                                  alt={player.fullName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="font-bold text-[7px] text-emerald-400">
                                  {player.fullName.substring(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h5
                                className="font-bold text-[10px] text-white truncate max-w-[85px] sm:max-w-[100px]"
                                title={player.fullName}
                              >
                                {player.fullName}
                              </h5>
                              <span
                                className={`text-[8px] font-semibold px-0.5 rounded inline-block ${getRoleBadgeColor(
                                  player.primaryRole
                                )}`}
                              >
                                {formatRole(player.primaryRole)}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono text-[10px] font-bold text-emerald-400 shrink-0">
                            {formatCurrency(player.soldPrice || player.basePrice, true)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
