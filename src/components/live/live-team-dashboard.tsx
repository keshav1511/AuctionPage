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
  // Ensure we sort/display teams reliably (by ID or original order)
  const sortedTeams = useMemo(() => {
    return [...teams];
  }, [teams]);

  return (
    <section className="w-full mt-6 select-none">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider flex items-center gap-2.5">
            <Users className="w-5 h-5 text-emerald-400" />
            Live Team Dashboard
          </h3>
          <p className="text-xs text-slate-400">
            Real-time franchise purse, participant quotas, and acquired auction squads
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
            {teams.length} Franchises Active
          </span>
        </div>
      </div>

      {/* Responsive Four Team Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 items-stretch">
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
          const minSquad = team.purse?.minPlayers || rules.minimumSquadSize || 10;
          const maxSquad = team.purse?.maxPlayers || rules.maximumSquadSize || 12;
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
              className={`rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden relative backdrop-blur-md ${
                isLeading
                  ? "ring-2 ring-amber-400 border-amber-400/90 bg-gradient-to-b from-amber-950/40 via-charcoal-900/95 to-charcoal-950 shadow-[0_0_30px_rgba(245,158,11,0.3)] scale-[1.01]"
                  : "border-slate-800 bg-charcoal-900/90 hover:border-slate-700 shadow-xl"
              }`}
            >
              {/* Top Accent Strip */}
              <div
                className="h-1.5 w-full"
                style={{ backgroundColor: team.primaryColor || "#059669" }}
              />

              <div className="p-4 sm:p-5 flex-1 flex flex-col gap-4">
                {/* 1. Team Identity Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Team Logo */}
                    {team.logoUrl ? (
                      <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-950/80 border border-slate-700/80 p-1 shrink-0 shadow-md">
                        <img
                          src={team.logoUrl}
                          alt={team.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-md shrink-0 border border-white/20"
                        style={{ backgroundColor: team.primaryColor || "#059669" }}
                      >
                        {team.shortCode || team.name.substring(0, 3).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 border border-slate-700">
                          {team.shortCode}
                        </span>
                      </div>
                      <h4
                        className="font-black text-white text-base truncate leading-tight mt-1"
                        title={team.name}
                      >
                        {team.name}
                      </h4>
                    </div>
                  </div>

                  {/* Leading Bid Badge */}
                  {isLeading ? (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.5)] animate-pulse shrink-0">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span className="text-[9px] font-black uppercase tracking-wider">
                        HIGHEST BID
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* 2. Owner & Icon Representatives */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-charcoal-950/80 border border-slate-800/80 text-xs">
                  {/* Owner */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-800 border-2 border-amber-500/50 shrink-0 flex items-center justify-center shadow-xs">
                      {team.ownerPhotoUrl ? (
                        <img
                          src={team.ownerPhotoUrl}
                          alt={team.ownerName || "Owner"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-bold text-[10px] text-amber-300">
                          {(team.ownerName || "OW").substring(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[8px] font-bold text-amber-400/90 uppercase tracking-wider">
                        Owner
                      </span>
                      <span
                        className="block text-xs font-semibold text-white truncate"
                        title={team.ownerName || "TBD"}
                      >
                        {team.ownerName || "TBD"}
                      </span>
                    </div>
                  </div>

                  {/* Icon / Representative */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-800 border-2 border-emerald-500/50 shrink-0 flex items-center justify-center shadow-xs">
                      {team.iconPlayerPhotoUrl ? (
                        <img
                          src={team.iconPlayerPhotoUrl}
                          alt={team.iconPlayerName || "Icon"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-bold text-[10px] text-emerald-300">
                          {(team.iconPlayerName || "IC").substring(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[8px] font-bold text-emerald-400/90 uppercase tracking-wider">
                        Icon / Rep
                      </span>
                      <span
                        className="block text-xs font-semibold text-white truncate"
                        title={team.iconPlayerName || "TBD"}
                      >
                        {team.iconPlayerName || "TBD"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Financial Section */}
                <div className="space-y-2 p-3 rounded-xl bg-charcoal-950/70 border border-slate-800/80">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Remaining Purse
                    </span>
                    <span className="font-mono text-lg font-black text-emerald-400">
                      {formatCurrency(remainingPurse)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Spent on Squad:</span>
                    <span className="font-mono font-bold text-slate-200">
                      {formatCurrency(spentAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Total Purse:</span>
                    <span className="font-mono text-slate-300">
                      {formatCurrency(totalPurse)}
                    </span>
                  </div>

                  {/* Active Bid Commitment (if leading) */}
                  {isLeading && (
                    <div className="pt-2 border-t border-amber-500/30 flex items-center justify-between text-xs">
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" /> Active Bid:
                      </span>
                      <div className="text-right">
                        <span className="font-mono font-black text-amber-300 text-sm">
                          {formatCurrency(currentBidAmount)}
                        </span>
                        <span className="block text-[9px] text-amber-400/70">
                          (Pending hammer • not yet deducted)
                        </span>
                      </div>
                    </div>
                  )}

                  <Progress
                    value={spentPercentage}
                    className="h-1.5 bg-slate-800"
                    indicatorClassName={isLeading ? "bg-amber-400" : "bg-emerald-500"}
                  />
                </div>

                {/* 4. Squad Composition & Requirements */}
                <div className="space-y-1.5 p-3 rounded-xl bg-charcoal-950/60 border border-slate-800/80 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">Total Squad:</span>
                    <span className="font-mono font-black text-white text-sm">
                      {counts.totalParticipants} / {maxSquad}{" "}
                      <span className="text-[10px] font-normal text-slate-400 font-sans">
                        Participants
                      </span>
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400">
                    {counts.registeredPlayersCount} Reg + {counts.ownerCount} Owner + {counts.iconCount} Icon
                  </p>

                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
                    {isMinSquadMet ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="w-3 h-3" /> Minimum Met ({minSquad})
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-md">
                        Needs {additionalRequired} more for min ({counts.totalParticipants}/{minSquad})
                      </span>
                    )}

                    <span className="text-[10px] text-slate-400 font-mono">
                      {isMaxSquadReached
                        ? "Squad Full"
                        : `${remainingCapacity} slot${remainingCapacity === 1 ? "" : "s"} open`}
                    </span>
                  </div>
                </div>

                {/* 5. Purchased Player Stack */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      Purchased Squad ({teamSoldPlayers.length})
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {teamSoldPlayers.length} / {Math.max(0, maxSquad - (counts.ownerCount + counts.iconCount))} max
                    </span>
                  </div>

                  {teamSoldPlayers.length === 0 ? (
                    <div className="py-4 px-3 rounded-xl bg-charcoal-950/40 border border-dashed border-slate-800 text-center">
                      <p className="text-xs text-slate-500 font-medium">No players acquired yet</p>
                      <span className="text-[9px] text-slate-600 block mt-0.5">
                        Purchases will appear here automatically
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                      {teamSoldPlayers.map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-charcoal-950/80 border border-slate-800/80 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="relative w-7 h-7 rounded-full overflow-hidden bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
                              {player.photoUrl ? (
                                <img
                                  src={player.photoUrl}
                                  alt={player.fullName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="font-bold text-[9px] text-emerald-400">
                                  {player.fullName.substring(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h5
                                className="font-bold text-xs text-white truncate max-w-[100px] sm:max-w-[120px]"
                                title={player.fullName}
                              >
                                {player.fullName}
                              </h5>
                              <span
                                className={`text-[9px] font-semibold px-1 rounded inline-block ${getRoleBadgeColor(
                                  player.primaryRole
                                )}`}
                              >
                                {formatRole(player.primaryRole)}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono text-xs font-bold text-emerald-400 shrink-0">
                            {formatCurrency(player.soldPrice || player.basePrice)}
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
