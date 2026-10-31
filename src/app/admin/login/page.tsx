"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, Mail, ArrowLeft, KeyRound } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("commissioner@ntlcricket.com");
  const [password, setPassword] = useState("••••••••••••");
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Instant demo login transition to dashboard
    setTimeout(() => {
      router.push("/admin/dashboard");
    }, 600);
  };

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

        <Card className="border-slate-800 bg-charcoal-900/90 shadow-2xl backdrop-blur-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-950/80 mb-3">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-wider text-white">
              Auctioneer Desk
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              NTL Season 1 Commissioner & Control Access
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
                    required
                    className="pl-9 bg-charcoal-950 border-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300">Security Key</label>
                  <span className="text-[11px] text-amber-400 font-mono">Demo Auto-Fill</span>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-9 bg-charcoal-950 border-slate-700"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="gold"
                size="lg"
                disabled={loading}
                className="w-full font-bold uppercase tracking-wider text-black mt-2"
              >
                {loading ? "Authenticating..." : "Unlock Control Desk"}
              </Button>
            </form>

            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-center space-y-1">
              <p className="text-[11px] font-semibold text-emerald-300">
                🔒 Stage Mode Demo Active
              </p>
              <p className="text-[10px] text-slate-400">
                No external credentials needed for local evaluation. Press Enter to proceed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
