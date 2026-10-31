"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLeaguesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/setup");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500">
      Redirecting to Tournament Setup...
    </div>
  );
}
