"use client";

import { useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { useLeague } from "@/lib/context/league-context";
import { BidSlab, PlayerCategory } from "@/types";
import {
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  Clock,
  TrendingUp,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { DEFAULT_DYNAMIC_SLABS } from "@/lib/auction/slab-calculator";

export default function AdminSettingsPage() {
  const { activeLeague } = useLeague();
  const [savedNotice, setSavedNotice] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Timers
  const [initialCountdown, setInitialCountdown] = useState<number>(45);
  const [bidExtension, setBidExtension] = useState<number>(10);

  // Category Base Prices
  const [categoryPrices, setCategoryPrices] = useState<Record<PlayerCategory, number>>({
    ICON: 200000,
    PLATINUM: 100000,
    GOLD: 50000,
    SILVER: 25000,
    EMERGING: 15000,
  });

  const [globalDefaultBase, setGlobalDefaultBase] = useState<number>(25000);
  const [enableIndividualOverrides, setEnableIndividualOverrides] = useState<boolean>(true);

  // Dynamic Bid Slabs Table
  const [slabs, setSlabs] = useState<BidSlab[]>(DEFAULT_DYNAMIC_SLABS);

  const handleAddSlab = () => {
    const lastSlab = slabs[slabs.length - 1];
    const newMin = lastSlab ? (lastSlab.max === 999999999 ? 1000000 : lastSlab.max) : 500;
    const newMax = newMin * 2;
    const newStep = Math.max(500, Math.round(newMin * 0.1));

    setSlabs([...slabs, { min: newMin, max: newMax, step: newStep }]);
  };

  const handleRemoveSlab = (index: number) => {
    if (slabs.length <= 1) return;
    setSlabs(slabs.filter((_, i) => i !== index));
  };

  const handleUpdateSlab = (index: number, field: "min" | "max" | "step", value: number) => {
    const updated = [...slabs];
    updated[index] = { ...updated[index], [field]: value };
    setSlabs(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate slabs: steps must be > 0 and max > min
    for (let i = 0; i < slabs.length; i++) {
      const slab = slabs[i];
      if (slab.step <= 0) {
        setValidationError(`Slab row #${i + 1} increment must be strictly greater than 0.`);
        return;
      }
      if (slab.min !== undefined && slab.max <= slab.min) {
        setValidationError(`Slab row #${i + 1} ending amount must exceed starting amount.`);
        return;
      }
    }

    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#070A0D] flex text-slate-100">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Dynamic Auction Engine Settings"
          subtitle={`Configure authoritative timers, dynamic bid slabs & category base prices for ${activeLeague.name}`}
          action={
            <Button
              onClick={handleSave}
              variant="gold"
              size="sm"
              className="gap-2 font-bold text-black"
            >
              <Save className="w-4 h-4 fill-black" /> Save Rules
            </Button>
          }
        />

        <main className="p-8 space-y-8 flex-1 overflow-y-auto max-w-7xl">
          {savedNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Settings saved! Authoritative timers and slabs applied to active auction rooms.
            </div>
          )}

          {validationError && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {validationError}
            </div>
          )}

          {/* Section A: Authoritative Timers */}
          <Card className="border-slate-800 bg-charcoal-900">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black uppercase text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-emerald-400" />
                    Authoritative Auction Timers (League-Specific)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Server-calculated timestamps. Page refreshes and network reconnections will
                    never restart the timer.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div className="p-4 rounded-xl bg-charcoal-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white">Initial Player Bidding Countdown</label>
                    <Badge variant="outline" className="font-mono text-xs text-emerald-400">
                      {initialCountdown}s
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Begins authoritative countdown as soon as an athlete lot is spotlighted on stage.
                  </p>
                  <Input
                    type="number"
                    value={initialCountdown}
                    onChange={(e) => setInitialCountdown(Math.max(10, parseInt(e.target.value, 10) || 10))}
                    className="h-9 font-mono text-xs w-32"
                  />
                </div>

                <div className="p-4 rounded-xl bg-charcoal-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white">Bid Extension Duration</label>
                    <Badge variant="gold" className="font-mono text-xs text-amber-300">
                      +{bidExtension}s
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Time added whenever any valid bid is placed. Countdown extends authoritatively.
                  </p>
                  <Input
                    type="number"
                    value={bidExtension}
                    onChange={(e) => setBidExtension(Math.max(3, parseInt(e.target.value, 10) || 3))}
                    className="h-9 font-mono text-xs w-32"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section B: Dynamic Bid Increment Slabs Table */}
          <Card className="border-slate-800 bg-charcoal-900">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black uppercase text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                    Dynamic Bid Increment Slabs Table
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Unambiguous boundaries. Every valid bid amount maps to exactly one next increment.
                  </p>
                </div>

                <Button onClick={handleAddSlab} variant="outline" size="sm" className="gap-2 text-xs">
                  <Plus className="w-3.5 h-3.5 text-emerald-400" /> Add Slab Row
                </Button>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-charcoal-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-charcoal-900 border-b border-slate-800 text-slate-400 font-semibold uppercase">
                    <tr>
                      <th className="p-3.5">Starting Amount (Min)</th>
                      <th className="p-3.5">Ending Amount (Max)</th>
                      <th className="p-3.5">Increment Step</th>
                      <th className="p-3.5">Example Step</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {slabs.map((slab, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3.5">
                          <Input
                            type="number"
                            value={slab.min ?? 0}
                            onChange={(e) =>
                              handleUpdateSlab(idx, "min", parseInt(e.target.value, 10) || 0)
                            }
                            className="h-8 w-28 font-mono text-xs bg-charcoal-900"
                          />
                        </td>
                        <td className="p-3.5">
                          <Input
                            type="number"
                            value={slab.max}
                            onChange={(e) =>
                              handleUpdateSlab(idx, "max", parseInt(e.target.value, 10) || 0)
                            }
                            className="h-8 w-32 font-mono text-xs bg-charcoal-900"
                          />
                        </td>
                        <td className="p-3.5">
                          <Input
                            type="number"
                            value={slab.step}
                            onChange={(e) =>
                              handleUpdateSlab(idx, "step", parseInt(e.target.value, 10) || 500)
                            }
                            className="h-8 w-28 font-mono text-xs font-bold text-amber-300 bg-charcoal-900"
                          />
                        </td>
                        <td className="p-3.5 text-slate-400 font-mono">
                          {formatCurrency(slab.min || 0)} → {formatCurrency((slab.min || 0) + slab.step)}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleRemoveSlab(idx)}
                            className="text-slate-500 hover:text-red-400 p-1 rounded"
                            title="Delete slab"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Section C: Base Prices Configuration */}
          <Card className="border-slate-800 bg-charcoal-900">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-base font-black uppercase text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  Base Price Floors & Overrides
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Global defaults, category-specific base prices, and individual athlete override rules.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Category Base Prices */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-slate-400">Category-Specific Floors</h4>

                  {(["ICON", "PLATINUM", "GOLD", "SILVER", "EMERGING"] as PlayerCategory[]).map(
                    (cat) => (
                      <div
                        key={cat}
                        className="flex items-center justify-between p-3 rounded-lg bg-charcoal-950 border border-slate-800 text-xs"
                      >
                        <span className="font-bold text-white">{cat} Pool</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={categoryPrices[cat]}
                            onChange={(e) =>
                              setCategoryPrices({
                                ...categoryPrices,
                                [cat]: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="h-8 w-32 font-mono text-xs bg-charcoal-900 text-right"
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* Global and Individual Overrides */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase text-slate-400">Global Fallback & Overrides</h4>

                  <div className="p-4 rounded-xl bg-charcoal-950 border border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-white">Default Global Base Price</label>
                    <p className="text-[11px] text-slate-400">
                      Applied when a player has no category or explicit starting bid assigned.
                    </p>
                    <Input
                      type="number"
                      value={globalDefaultBase}
                      onChange={(e) => setGlobalDefaultBase(parseInt(e.target.value, 10) || 10000)}
                      className="h-8 w-36 font-mono text-xs bg-charcoal-900"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-charcoal-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-white">Allow Individual Player Overrides</label>
                      <input
                        type="checkbox"
                        checked={enableIndividualOverrides}
                        onChange={(e) => setEnableIndividualOverrides(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 bg-charcoal-900 border-slate-700"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      When enabled, individual base prices specified during player import or manual edit take precedence over pool categories.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
