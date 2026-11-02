"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Maximize2, Minimize2, ArrowLeft } from "lucide-react";
import { useLeague } from "@/lib/context/league-context";
import { League } from "@/types";

interface BroadcastHeaderProps {
  tournament?: League | null;
}

export function BroadcastHeader({ tournament }: BroadcastHeaderProps = {}) {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const { activeLeague } = useLeague();
  const currentLeague = tournament || activeLeague;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  return (
    <header className="h-11 sm:h-12 px-3 sm:px-6 lg:px-8 bg-charcoal-950/95 border-b border-slate-800/90 flex items-center justify-between select-none shrink-0 backdrop-blur-md">
      {/* Brand & Stage Identifier */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        <Link
          href="/"
          className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-900 border border-slate-800 transition-colors shrink-0"
          title="Back to portal"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          {currentLeague.logoUrl ? (
            <img
              src={currentLeague.logoUrl}
              alt={currentLeague.name}
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-lg shadow border border-white/20 bg-slate-900 p-0.5 shrink-0"
            />
          ) : (
            <div
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-white text-xs sm:text-sm shadow border border-white/20 shrink-0"
              style={{ backgroundColor: currentLeague.primaryColor }}
            >
              {currentLeague.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-white font-black text-xs sm:text-sm tracking-wider uppercase flex items-center gap-1.5 truncate">
              <span className="truncate">{currentLeague.name}</span>
              <span className="text-amber-400 font-extrabold text-[11px] shrink-0">LIVE</span>
            </h1>
            <p className="text-[9px] text-emerald-400 font-semibold tracking-wider uppercase truncate">
              {currentLeague.matchVenue || "Official Stage Broadcast"}
            </p>
          </div>
        </div>
      </div>

      {/* Center Live Indicator */}
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/70 border border-red-500/40 shadow-sm shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-80"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
        <span className="text-[10px] sm:text-xs font-black tracking-widest text-red-300 uppercase">
          STAGE BROADCAST
        </span>
      </div>

      {/* Right Controls & Clock */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
        <div className="hidden md:block text-right">
          <div className="font-mono text-xs font-bold text-slate-200 tabular-nums">
            {currentTime}
          </div>
          <div className="text-[9px] text-slate-500 uppercase tracking-widest">
            {activeLeague.timezone || "IST (GMT+5:30)"}
          </div>
        </div>

        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg bg-slate-900 text-slate-300 hover:text-white border border-slate-800 transition-colors shrink-0"
          title="Toggle Fullscreen Projector Mode"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
}
