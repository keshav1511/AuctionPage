"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Sliders,
  Gavel,
  Trophy,
  FileSpreadsheet,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Auction Control", href: "/admin/auction-control", icon: Gavel, badge: "LIVE" },
  { label: "Team Management", href: "/admin/teams", icon: Users },
  { label: "Player Management", href: "/admin/players", icon: UserCheck },
  { label: "Auction Results", href: "/admin/results", icon: Trophy },
  { label: "Auction Settings", href: "/admin/settings", icon: Sliders },
  { label: "Reports & Export", href: "/admin/reports", icon: FileSpreadsheet },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-800 bg-charcoal-950 flex flex-col justify-between shrink-0 min-h-screen">
      <div>
        {/* Brand header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-emerald-950/60">
              N
            </div>
            <div>
              <h2 className="font-bold text-white text-base tracking-wide leading-tight">
                NTL ADMIN
              </h2>
              <p className="text-xs text-emerald-400 font-medium">Season 1 Desk</p>
            </div>
          </div>
        </div>

        {/* Links */}
        <nav className="p-4 space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("w-4 h-4", isActive ? "text-emerald-400" : "text-slate-400")} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer link to public stage */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        <Link
          href="/live"
          target="_blank"
          className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold bg-charcoal-900 text-amber-300 border border-amber-500/30 hover:bg-amber-500/10 transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            Open Public Stage
          </span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
        <Link
          href="/admin/login"
          className="flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit Session</span>
        </Link>
      </div>
    </aside>
  );
}
