"use client";

import { ShieldCheck, Trophy } from "lucide-react";
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
    <header className="h-16 border-b border-slate-200 bg-white px-6 sm:px-8 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Tournament Switcher */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs">
          <Trophy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <select
            value={activeLeague.id}
            onChange={(e) => switchLeague(e.target.value)}
            className="bg-transparent text-slate-800 font-medium text-xs focus:outline-none cursor-pointer"
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id} className="bg-white text-slate-900">
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {action}

        {/* Commissioner Role Badge */}
        <Badge variant="outline" className="hidden sm:flex font-medium text-xs gap-1.5 py-1 px-2.5 bg-slate-50 text-slate-700 border-slate-200">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
          Commissioner
        </Badge>
      </div>
    </header>
  );
}
