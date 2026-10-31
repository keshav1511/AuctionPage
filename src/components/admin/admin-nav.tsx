"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  Users,
  UserCheck,
  Sliders,
  Gavel,
  Award,
  FileSpreadsheet,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLeague } from "@/lib/context/league-context";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Tournament Setup", href: "/admin/setup", icon: Trophy },
  { label: "Teams", href: "/admin/teams", icon: Users },
  { label: "Players", href: "/admin/players", icon: UserCheck },
  { label: "Auction Settings", href: "/admin/settings", icon: Sliders },
  { label: "Live Auction", href: "/admin/auction-control", icon: Gavel, badge: "Live" },
  { label: "Results", href: "/admin/results", icon: Award },
  { label: "Reports", href: "/admin/reports", icon: FileSpreadsheet },
];

export function AdminNav() {
  const pathname = usePathname();
  const { activeLeague } = useLeague();

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between shrink-0 min-h-screen text-slate-700">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-base shadow-sm"
              style={{ backgroundColor: activeLeague.primaryColor || "#059669" }}
            >
              {activeLeague.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900 text-sm tracking-tight truncate leading-tight">
                {activeLeague.name}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                {activeLeague.matchVenue || "Auction Admin"}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href === "/admin/setup" && pathname === "/admin/leagues");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={cn(
                      "w-4 h-4",
                      isActive ? "text-slate-900" : "text-slate-400"
                    )}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer link to public broadcast stage */}
      <div className="p-4 border-t border-slate-200">
        <Link
          href="/live"
          target="_blank"
          className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Public Broadcast View
          </span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </Link>
      </div>
    </aside>
  );
}
