"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login" || pathname.startsWith("/admin/login/");
  const [isVerifying, setIsVerifying] = useState(!isLoginPage);

  useEffect(() => {
    // Skip verification loop for login page
    if (isLoginPage) {
      setIsVerifying(false);
      return;
    }

    // 1. Anti-bfcache: if browser navigates back from a public page (e.g. /live) via cache, force reload
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener("pageshow", handlePageShow);

    // 2. Client session validation against /api/auth/me
    let isCancelled = false;
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => {
        if (!isCancelled) {
          const isAuthed = Boolean(data && (data.authenticated === true || data.success === true));
          if (!isAuthed) {
            router.replace(`/admin/login?from=${encodeURIComponent(pathname)}`);
          } else {
            setIsVerifying(false);
          }
        }
      })
      .catch(() => {
        if (!isCancelled) {
          router.replace(`/admin/login?from=${encodeURIComponent(pathname)}`);
        }
      });

    return () => {
      isCancelled = true;
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [pathname, isLoginPage, router]);

  // Login page bypasses layout loading screen
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Loading state while verifying credentials on client navigation
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-sm font-sans select-none">
        <div className="flex items-center gap-3 bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-2xl">
          <span className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-slate-200">
            Verifying administrative access...
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
