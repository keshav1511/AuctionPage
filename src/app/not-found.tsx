import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#090D10] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-black text-2xl text-amber-400 mx-auto">
          404
        </div>
        <h1 className="text-2xl font-black text-white uppercase tracking-wide">
          Page Not Found
        </h1>
        <p className="text-sm text-slate-400">
          The requested page or auction lot could not be found. Please return to the live dashboard.
        </p>
        <div className="pt-2">
          <Link href="/">
            <Button className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
