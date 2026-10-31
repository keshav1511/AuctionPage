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
import { DEFAULT_DYNAMIC_SLABS } from "@/lib/auction/slab-calculator";
import {
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  Clock,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Users,
  Search,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function AdminSettingsPage() {
  const { activeLeague, players, updatePlayer, auctionRules, updateAuctionRules } = useLeague();
  const [savedNotice, setSavedNotice] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Timers
  const [initialCountdown, setInitialCountdown] = useState<number>(auctionRules.initialTimerSeconds || 45);
  const [bidExtension, setBidExtension] = useState<number>(auctionRules.bidExtensionSeconds || 10);

  // Category Base Prices
  const [categoryPrices, setCategoryPrices] = useState<Record<PlayerCategory, number>>({
    ICON: auctionRules.iconBasePrice || 200000,
    PLATINUM: auctionRules.platinumBasePrice || 100000,
    GOLD: auctionRules.goldBasePrice || 50000,
    SILVER: auctionRules.silverBasePrice || 25000,
    EMERGING: auctionRules.emergingBasePrice || 15000,
  });

  // Dynamic Bid Slabs Table
  const [slabs, setSlabs] = useState<BidSlab[]>(auctionRules.bidSlabRules || DEFAULT_DYNAMIC_SLABS);

  // Team Squad Limits & Purse Rules
  const [defaultPurse, setDefaultPurse] = useState<number>(5000000);
  const [minSquadSize, setMinSquadSize] = useState<number>(15);
  const [maxSquadSize, setMaxSquadSize] = useState<number>(18);
  const [maxIconLimit, setMaxIconLimit] = useState<number>(2);
  const [maxPlatLimit, setMaxPlatLimit] = useState<number>(4);
  const [minEmergingLimit, setMinEmergingLimit] = useState<number>(3);

  // Player Overrides Filter
  const [overrideSearch, setOverrideSearch] = useState("");

  const handleAddSlab = () => {
    const lastSlab = slabs[slabs.length - 1];
    const newMin = lastSlab ? lastSlab.max : 0;
    const newMax = newMin + 100000;
    const newStep = 25000;

    setSlabs([...slabs, { min: newMin, max: newMax, step: newStep }]);
  };

  const handleRemoveSlab = (index: number) => {
    if (slabs.length <= 1) {
      setValidationError("At least one bid slab rule is required.");
      return;
    }
    const updated = slabs.filter((_, i) => i !== index);
    setSlabs(updated);
  };

  const handleSlabChange = (index: number, field: "min" | "max" | "step", value: number) => {
    const updated = [...slabs];
    updated[index] = { ...updated[index], [field]: value };
    setSlabs(updated);
  };

  const validateSlabs = (): boolean => {
    for (let i = 0; i < slabs.length; i++) {
      const s = slabs[i];
      const min = s.min ?? 0;
      if (s.max <= min) {
        setValidationError(`Slab ${i + 1}: Max bid (₹${s.max.toLocaleString()}) must be greater than Min bid (₹${min.toLocaleString()}).`);
        return false;
      }
      if (s.step <= 0) {
        setValidationError(`Slab ${i + 1}: Increment step must be greater than 0.`);
        return false;
      }
    }
    setValidationError(null);
    return true;
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSlabs()) return;

    updateAuctionRules({
      initialTimerSeconds: initialCountdown,
      bidExtensionSeconds: bidExtension,
      iconBasePrice: categoryPrices.ICON,
      platinumBasePrice: categoryPrices.PLATINUM,
      goldBasePrice: categoryPrices.GOLD,
      silverBasePrice: categoryPrices.SILVER,
      emergingBasePrice: categoryPrices.EMERGING,
      bidSlabRules: slabs,
    });

    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const filteredPlayersForOverride = players.filter((p) =>
    p.fullName.toLowerCase().includes(overrideSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Auction Rules & Settings"
          subtitle={`${activeLeague.name} • Bid Increments, Base Prices, Squad Limits & Authoritative Timers`}
          action={
            <Button asChild size="sm" className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-sm">
              <Link href="/admin/auction-control">
                Open Live Auction
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
          }
        />

        <main className="p-6 sm:p-8 space-y-6 max-w-5xl">
          {savedNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Auction rules, bid slabs, and timers saved successfully.
            </div>
          )}

          {validationError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              {validationError}
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* Card 1: Authoritative Timers */}
            <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">Authoritative Auction Timers</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Initial Countdown Duration (seconds)</label>
                    <Input
                      type="number"
                      value={initialCountdown}
                      onChange={(e) => setInitialCountdown(parseInt(e.target.value, 10) || 45)}
                      className="bg-white border-slate-300 font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      Countdown starting time when a player is brought to the podium (e.g. 45s).
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Bid Extension Duration (seconds)</label>
                    <Input
                      type="number"
                      value={bidExtension}
                      onChange={(e) => setBidExtension(parseInt(e.target.value, 10) || 10)}
                      className="bg-white border-slate-300 font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      Authoritative timer reset duration added whenever a valid bid is placed (e.g. 10s).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Category Base Prices */}
            <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">Category Base Prices (Floor Amounts)</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {(["ICON", "PLATINUM", "GOLD", "SILVER", "EMERGING"] as PlayerCategory[]).map((cat) => (
                    <div key={cat} className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-600 uppercase block">{cat}</span>
                      <Input
                        type="number"
                        value={categoryPrices[cat]}
                        onChange={(e) =>
                          setCategoryPrices({
                            ...categoryPrices,
                            [cat]: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="bg-white border-slate-300 font-mono text-xs h-8"
                      />
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {formatCurrency(categoryPrices[cat], true)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Dynamic Bid Increments Slabs Table */}
            <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Dynamic Bid Increment Slabs</h3>
                      <p className="text-xs text-slate-500">
                        Ensures every bid amount yields exactly one unambiguous next increment step.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddSlab}
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Slab
                  </Button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="p-3 pl-4">Range Floor (Min ₹)</th>
                        <th className="p-3">Range Ceiling (Max ₹)</th>
                        <th className="p-3">Increment Step (+₹)</th>
                        <th className="p-3 text-right pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {slabs.map((slab, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="p-2.5 pl-4">
                            <Input
                              type="number"
                              value={slab.min ?? 0}
                              onChange={(e) => handleSlabChange(i, "min", parseInt(e.target.value, 10) || 0)}
                              className="w-36 bg-white border-slate-300 font-mono text-xs h-8"
                            />
                          </td>
                          <td className="p-2.5">
                            <Input
                              type="number"
                              value={slab.max}
                              onChange={(e) => handleSlabChange(i, "max", parseInt(e.target.value, 10) || 0)}
                              className="w-36 bg-white border-slate-300 font-mono text-xs h-8"
                            />
                          </td>
                          <td className="p-2.5">
                            <Input
                              type="number"
                              value={slab.step}
                              onChange={(e) => handleSlabChange(i, "step", parseInt(e.target.value, 10) || 0)}
                              className="w-32 bg-white border-slate-300 font-mono text-xs h-8 text-emerald-700 font-bold"
                            />
                          </td>
                          <td className="p-2.5 text-right pr-4">
                            <Button
                              type="button"
                              onClick={() => handleRemoveSlab(i)}
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Team Purse & Squad Limits */}
            <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">Franchise Purse & Squad Constraints</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Default Team Purse (₹)</label>
                    <Input
                      type="number"
                      value={defaultPurse}
                      onChange={(e) => setDefaultPurse(parseInt(e.target.value, 10) || 5000000)}
                      className="bg-white border-slate-300 font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-500">{formatCurrency(defaultPurse, true)}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Minimum Squad Size</label>
                    <Input
                      type="number"
                      value={minSquadSize}
                      onChange={(e) => setMinSquadSize(parseInt(e.target.value, 10) || 15)}
                      className="bg-white border-slate-300 font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-500">Reserved funds check: (Min - Current - 1) × 25k</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Maximum Squad Size</label>
                    <Input
                      type="number"
                      value={maxSquadSize}
                      onChange={(e) => setMaxSquadSize(parseInt(e.target.value, 10) || 18)}
                      className="bg-white border-slate-300 font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-500">Total player capacity per franchise</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">Max Icon Players</label>
                    <Input
                      type="number"
                      value={maxIconLimit}
                      onChange={(e) => setMaxIconLimit(parseInt(e.target.value, 10) || 2)}
                      className="bg-white border-slate-300 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">Max Platinum Players</label>
                    <Input
                      type="number"
                      value={maxPlatLimit}
                      onChange={(e) => setMaxPlatLimit(parseInt(e.target.value, 10) || 4)}
                      className="bg-white border-slate-300 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">Min Emerging Players</label>
                    <Input
                      type="number"
                      value={minEmergingLimit}
                      onChange={(e) => setMinEmergingLimit(parseInt(e.target.value, 10) || 3)}
                      className="bg-white border-slate-300 font-mono text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 5: Individual Player Base Price Overrides */}
            <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Individual Player Base Price Overrides</h3>
                    <p className="text-xs text-slate-500">
                      Override standard category base prices for specific elite or marquee players.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <Input
                      value={overrideSearch}
                      onChange={(e) => setOverrideSearch(e.target.value)}
                      placeholder="Search player..."
                      className="pl-8 bg-white border-slate-300 text-xs h-8"
                    />
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                      <tr>
                        <th className="p-2.5 pl-4">Player Name</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Default Base Price</th>
                        <th className="p-2.5 pr-4">Custom Base Price Override (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredPlayersForOverride.slice(0, 15).map((player) => (
                        <tr key={player.id} className="hover:bg-slate-50">
                          <td className="p-2.5 pl-4 font-semibold text-slate-900">
                            {player.fullName}
                          </td>
                          <td className="p-2.5">
                            <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700">
                              {player.category}
                            </Badge>
                          </td>
                          <td className="p-2.5 font-mono text-slate-500">
                            {formatCurrency(player.basePrice)}
                          </td>
                          <td className="p-2.5 pr-4">
                            <Input
                              type="number"
                              defaultValue={player.basePriceOverride || ""}
                              placeholder={String(player.basePrice)}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value, 10);
                                updatePlayer(player.id, {
                                  basePriceOverride: isNaN(val) ? undefined : val,
                                });
                              }}
                              className="w-36 bg-white border-slate-300 font-mono text-xs h-7"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-6 py-2 shadow-sm gap-2"
              >
                <Save className="w-4 h-4" />
                Save All Auction Settings
              </Button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
