"use client";

import { ShieldCheck, Wifi, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLeague } from "@/lib/context/league-context";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function AdminHeader({ title, subtitle, action }: AdminHeaderProps) {
  const { activeLeague, leagues, switchLeague } = useLeague();

  return (
    <header className="h-16 border-b border-slate-800 bg-charcoal-950/70 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-xl font-black tracking-wide text-white flex items-center gap-2">
          {title}
        </h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* League Selector Dropdown */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-charcoal-900 border border-slate-800 text-xs">
          <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <select
            value={activeLeague.id}
            onChange={(e) => switchLeague(e.target.value)}
            className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer"
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id} className="bg-charcoal-950 text-white">
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {action}

        {/* Realtime Connection Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-300 font-mono text-[11px]">Realtime Active</span>
        </div>

        {/* Admin Persona Badge */}
        <Badge variant="gold" className="font-mono text-[11px] gap-1.5 py-1 px-3">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          Commissioner
        </Badge>
      </div>
    </header>
  );
}
