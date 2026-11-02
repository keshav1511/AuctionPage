"use client";

import { useState } from "react";
import { ShieldCheck, Trophy, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLeague } from "@/lib/context/league-context";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function AdminHeader({ title, subtitle, action }: AdminHeaderProps) {
  const { activeLeague, leagues, switchLeague } = useLeague();
  const [pendingLeagueId, setPendingLeagueId] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [showSwitchWarning, setShowSwitchWarning] = useState(false);

  const handleSelectLeague = async (targetId: string) => {
    if (targetId === activeLeague.id) return;

    const result = await switchLeague(targetId, false);
    if (!result.success && result.requiresConfirmation) {
      setPendingLeagueId(targetId);
      setWarningMessage(
        result.message ||
          "An auction is currently IN_PROGRESS for this tournament. Switching tournaments during an active auction will disconnect the live session. Are you sure you want to proceed?"
      );
      setShowSwitchWarning(true);
    }
  };

  const handleConfirmSwitch = async () => {
    if (pendingLeagueId) {
      await switchLeague(pendingLeagueId, true);
    }
    setShowSwitchWarning(false);
    setPendingLeagueId(null);
    setWarningMessage(null);
  };

  const handleCancelSwitch = () => {
    setShowSwitchWarning(false);
    setPendingLeagueId(null);
    setWarningMessage(null);
  };

  const pendingLeagueName =
    leagues.find((l) => l.id === pendingLeagueId)?.name || "the selected tournament";

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white px-6 sm:px-8 flex items-center justify-between sticky top-0 z-20">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            {activeLeague.edition && (
              <Badge
                variant="outline"
                className="hidden md:inline-flex text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 py-0.5"
              >
                {activeLeague.edition}
              </Badge>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          {/* Active Tournament Switcher */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs shadow-sm">
            <Trophy className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-semibold text-slate-500 hidden sm:inline">Active:</span>
            <select
              value={activeLeague.id}
              onChange={(e) => handleSelectLeague(e.target.value)}
              className="bg-transparent text-slate-900 font-bold text-xs focus:outline-none cursor-pointer pr-1"
            >
              {leagues.map((l) => (
                <option key={l.id} value={l.id} className="bg-white text-slate-900 font-medium">
                  {l.name} {l.edition ? `(${l.edition})` : ""}
                </option>
              ))}
            </select>
          </div>

          {action}

          {/* Commissioner Role Badge */}
          <Badge
            variant="outline"
            className="hidden sm:flex font-medium text-xs gap-1.5 py-1 px-2.5 bg-slate-50 text-slate-700 border-slate-200"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            Commissioner
          </Badge>
        </div>
      </header>

      {/* Confirmation Modal for Active Auction Switch */}
      <Dialog open={showSwitchWarning} onOpenChange={(open) => !open && handleCancelSwitch()}>
        <DialogContent className="max-w-md bg-white border border-red-200 text-slate-900 p-6 rounded-2xl shadow-xl">
          <DialogHeader className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 mx-auto sm:mx-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Auction Currently In Progress!
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 leading-relaxed">
              {warningMessage ||
                `An auction is actively running for "${activeLeague.name}". Switching to "${pendingLeagueName}" will disconnect the live auction and interrupt spectator displays.`}
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
            ⚠️ Live bidders and viewers connected to &quot;{activeLeague.name}&quot; will lose real-time sync.
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancelSwitch}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
            >
              Cancel & Stay Here
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmSwitch}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold gap-1.5"
            >
              Switch Tournament Anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
