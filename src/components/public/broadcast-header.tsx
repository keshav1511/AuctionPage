"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Maximize2, Minimize2, ArrowLeft } from "lucide-react";

export function BroadcastHeader() {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

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
    <header className="h-16 px-6 lg:px-12 bg-charcoal-950 border-b border-slate-800 flex items-center justify-between select-none">
      {/* Brand & Stage Identifier */}
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-slate-400 hover:text-white p-2 rounded-lg bg-slate-900 border border-slate-800 transition-colors"
          title="Back to portal"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center font-black text-white text-base shadow-lg shadow-emerald-900/60">
            NTL
          </div>
          <div>
            <h1 className="text-white font-black text-sm lg:text-base tracking-wider uppercase flex items-center gap-2">
              Nalanda Turf League
              <span className="text-amber-400 font-extrabold">Season 1</span>
            </h1>
            <p className="text-[10px] text-emerald-400 font-semibold tracking-widest uppercase">
              Official Auction Broadcast
            </p>
          </div>
        </div>
      </div>

      {/* Center Live Indicator */}
      <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-red-950/60 border border-red-500/40 shadow-lg shadow-red-950/40">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-80"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
        </span>
        <span className="text-xs font-black tracking-widest text-red-300 uppercase">
          LIVE ON STAGE
        </span>
      </div>

      {/* Right Controls & Clock */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:block text-right">
          <div className="font-mono text-sm font-bold text-slate-200 tabular-nums">
            {currentTime}
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">
            IST (GMT+5:30)
          </div>
        </div>

        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-lg bg-slate-900 text-slate-300 hover:text-white border border-slate-800 transition-colors"
          title="Toggle Fullscreen Projector Mode"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
