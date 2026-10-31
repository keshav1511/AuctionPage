"use client";

import { ShieldCheck, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function AdminHeader({ title, subtitle, action }: AdminHeaderProps) {
  return (
    <header className="h-16 border-b border-slate-800 bg-charcoal-950/70 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h1 className="text-xl font-black tracking-wide text-white flex items-center gap-2">
          {title}
        </h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {action}

        {/* Realtime Connection Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-300 font-mono text-[11px]">Realtime Active</span>
        </div>

        {/* Admin Persona Badge */}
        <Badge variant="gold" className="font-mono text-[11px] gap-1.5 py-1 px-3">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          Commissioner Mode
        </Badge>
      </div>
    </header>
  );
}
