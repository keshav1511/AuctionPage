"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tv, Users, Trophy, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLeague } from "@/lib/context/league-context";

export function PublicNav() {
  const pathname = usePathname();
  const { activeLeague } = useLeague();

  const links = [
    { label: "Live Stage", href: "/live", icon: Tv, live: true },
    { label: "Franchises & Purses", href: "/teams", icon: Users },
    { label: "Auction Results", href: "/results", icon: Trophy },
  ];

  return (
    <header className="border-b border-slate-800 bg-charcoal-950/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* League Logo & Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg group-hover:scale-105 transition-transform border border-white/20"
            style={{ backgroundColor: activeLeague.primaryColor }}
          >
            {activeLeague.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-white text-base tracking-wider uppercase">
                {activeLeague.name}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {activeLeague.matchVenue || "Official Auction Portal"}
            </p>
          </div>
        </Link>

        {/* Public Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all",
                  isActive
                    ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-emerald-400" : "text-slate-400")} />
                <span>{link.label}</span>
                {link.live && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Admin Login Link */}
        <Link
          href="/admin/login"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-amber-300 border border-slate-800 hover:border-amber-500/30 hover:bg-amber-500/5 transition-colors"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Admin Desk</span>
        </Link>
      </div>
    </header>
  );
}
