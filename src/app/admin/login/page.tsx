"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, Mail, ArrowLeft, KeyRound } from "lucide-react";

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent duplicate submissions

    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 10000); // 10-second safety timeout

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: { success?: boolean; error?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Authentication server error (HTTP ${res.status})`);
      }

      if (!res.ok || !data?.success) {
        setError(data?.error || "Authentication failed. Please check your credentials.");
        setLoading(false);
        return;
      }

      // Sanitize redirect target: must be local path starting with /admin, no protocol-relative URLs
      let target = "/admin/dashboard";
      if (
        fromParam &&
        fromParam.startsWith("/admin") &&
        !fromParam.startsWith("//") &&
        !fromParam.startsWith("/\\")
      ) {
        target = fromParam;
      }

      // Use full document navigation to guarantee:
      // 1. Fresh HttpOnly cookie is attached in request headers
      // 2. Next.js middleware executes on the incoming document request
      // 3. Stale client router cache from unauthenticated state is flushed
      window.location.href = target;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = (err as Error)?.name === "AbortError";
      if (isAbort) {
        setError("Authentication request timed out. Please check network connectivity and try again.");
      } else {
        setError((err as Error)?.message || "Network connection failure. Please try again.");
      }
      setLoading(false);
    }
  };

  return (
    <Card className="border-slate-800 bg-charcoal-900/90 shadow-2xl backdrop-blur-md">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-950/80 mb-3">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <CardTitle className="text-2xl font-black uppercase tracking-wider text-white">
          Auctioneer Desk
        </CardTitle>
        <CardDescription className="text-slate-400 text-xs">
          NTL Commissioner & Administrator Control Access
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Official Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ntlcricket.com"
                required
                disabled={loading}
                className="pl-9 bg-charcoal-950 border-slate-700 text-white placeholder:text-slate-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Security Key</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter administrator password"
                required
                disabled={loading}
                className="pl-9 bg-charcoal-950 border-slate-700 text-white placeholder:text-slate-600"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-medium leading-relaxed">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="gold"
            size="lg"
            disabled={loading}
            className="w-full font-bold uppercase tracking-wider text-black mt-2 disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                Authenticating...
              </span>
            ) : (
              "Unlock Control Desk"
            )}
          </Button>
        </form>

        <div className="p-3 rounded-lg bg-charcoal-950/80 border border-slate-800 text-center space-y-1">
          <p className="text-[11px] font-semibold text-slate-300">
            🔒 Authorized Commissioner Access
          </p>
          <p className="text-[10px] text-slate-400">
            Please sign in with administrator credentials configured in system settings.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-[#070A0D] flex items-center justify-center p-4 relative overflow-hidden stage-gradient select-none">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Public Portal
        </Link>

        <Suspense
          fallback={
            <div className="p-8 text-center text-slate-400 text-sm bg-charcoal-900/90 rounded-2xl border border-slate-800">
              Loading authentication desk...
            </div>
          }
        >
          <AdminLoginForm />
        </Suspense>
      </div>
    </div>
  );
}
