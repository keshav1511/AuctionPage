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
  Image as ImageIcon,
  RotateCcw,
  Sliders,
} from "lucide-react";
import Link from "next/link";

export default function AdminSettingsPage() {
  const { activeLeague, updateLeague, players, updatePlayer, auctionRules, updateAuctionRules } = useLeague();
  const [savedNotice, setSavedNotice] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Background Customization
  const [bgImageUrl, setBgImageUrl] = useState<string>(activeLeague.backgroundConfig?.imageUrl || "");
  const [bgDriveId, setBgDriveId] = useState<string>(activeLeague.backgroundConfig?.driveFileId || "");
  const [bgPosition, setBgPosition] = useState<'center' | 'top' | 'bottom'>(activeLeague.backgroundConfig?.position || "center");
  const [bgScale, setBgScale] = useState<'cover' | 'contain' | 'fill'>(activeLeague.backgroundConfig?.scale || "cover");
  const [bgOverlayOpacity, setBgOverlayOpacity] = useState<number>(
    activeLeague.backgroundConfig?.overlayOpacity != null ? activeLeague.backgroundConfig.overlayOpacity : 50
  );
  const [bgSavedNotice, setBgSavedNotice] = useState(false);

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
  const [minSquadSize, setMinSquadSize] = useState<number>(auctionRules.minimumSquadSize || 15);
  const [maxSquadSize, setMaxSquadSize] = useState<number>(18);
  const [minimumBasePrice, setMinimumBasePrice] = useState<number>(auctionRules.minimumBasePrice || 25000);
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
      minimumSquadSize: minSquadSize,
      minimumBasePrice: minimumBasePrice,
      categoryMinimumBasePrices: categoryPrices,
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

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                    <p className="text-[11px] text-slate-500">Slots required to avoid disqualification</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Minimum Base Price (Floor ₹)</label>
                    <Input
                      type="number"
                      value={minimumBasePrice}
                      onChange={(e) => setMinimumBasePrice(parseInt(e.target.value, 10) || 1000)}
                      className="bg-white border-slate-300 font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-500">Guaranteed reserve per remaining slot</p>
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

                <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 space-y-1">
                  <span className="font-bold block">Dynamic Reserve Formula (Phase 5.3):</span>
                  <p className="text-[11px] font-mono text-emerald-800">
                    Remaining Reserve = max(0, MinSquad - Purchased - 1) × FloorPrice
                  </p>
                  <p className="text-[11px] font-mono text-emerald-800">
                    Maximum Allowed Bid = max(0, RemainingPurse - RemainingReserve)
                  </p>
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

            {/* Card 6: Public Stage Background Customization */}
            <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-emerald-600" /> Public Stage Background Customization
                    </h3>
                    <p className="text-xs text-slate-500">
                      Configure the background image and dark intensity for the live spectator screen (/live), player announcements, and tournament finale.
                    </p>
                  </div>

                  {bgSavedNotice && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-medium border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Background Saved!
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Controls */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Google Drive File ID or Image URL
                      </label>
                      <Input
                        value={bgImageUrl || bgDriveId}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (val.startsWith("http")) {
                            setBgImageUrl(val);
                            setBgDriveId("");
                          } else {
                            setBgDriveId(val);
                            setBgImageUrl(val ? `https://lh3.googleusercontent.com/d/${val}` : "");
                          }
                        }}
                        placeholder="e.g. 1MtjUStUIqnlQic13... or https://..."
                        className="bg-white border-slate-300 font-mono text-xs"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Paste a public image link or a Google Drive file ID from your tournament asset folder.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Positioning
                        </label>
                        <select
                          value={bgPosition}
                          onChange={(e) => setBgPosition(e.target.value as 'center' | 'top' | 'bottom')}
                          className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="center">Center</option>
                          <option value="top">Top</option>
                          <option value="bottom">Bottom</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Image Scaling
                        </label>
                        <select
                          value={bgScale}
                          onChange={(e) => setBgScale(e.target.value as 'cover' | 'contain' | 'fill')}
                          className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="cover">Cover (Fill screen)</option>
                          <option value="contain">Contain (Fit screen)</option>
                          <option value="fill">Fill (Stretch)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-slate-500" /> Dark Overlay Intensity:
                        </label>
                        <span className="font-mono font-bold text-slate-900">{bgOverlayOpacity}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="90"
                        step="5"
                        value={bgOverlayOpacity}
                        onChange={(e) => setBgOverlayOpacity(parseInt(e.target.value, 10))}
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Controls contrast overlay for player readability on TV broadcasts and projectors.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          let effectiveUrl = bgImageUrl;
                          if (bgDriveId && !effectiveUrl) {
                            const cleanId = bgDriveId.replace(/.*folders\//, "").replace(/.*id=/, "").trim();
                            effectiveUrl = `https://lh3.googleusercontent.com/d/${cleanId}`;
                          }

                          updateLeague(activeLeague.id, {
                            backgroundConfig: {
                              imageUrl: effectiveUrl,
                              driveFileId: bgDriveId,
                              position: bgPosition,
                              scale: bgScale,
                              overlayOpacity: bgOverlayOpacity,
                            },
                          });
                          setBgSavedNotice(true);
                          setTimeout(() => setBgSavedNotice(false), 3000);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs py-1.5 px-4 shadow-sm gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" /> Save Background
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          setBgImageUrl("");
                          setBgDriveId("");
                          setBgPosition("center");
                          setBgScale("cover");
                          setBgOverlayOpacity(50);
                          updateLeague(activeLeague.id, {
                            backgroundConfig: undefined,
                          });
                          setBgSavedNotice(true);
                          setTimeout(() => setBgSavedNotice(false), 3000);
                        }}
                        className="border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs py-1.5 px-3 gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore Default
                      </Button>
                    </div>
                  </div>

                  {/* Live Preview Card */}
                  <div className="space-y-2">
                    <span className="block text-xs font-semibold text-slate-700">Live Stage Preview</span>
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-300 shadow-inner bg-[#070A0D] flex flex-col justify-between p-3 select-none">
                      {/* Background Image layer */}
                      {bgImageUrl ? (
                        <div
                          className="absolute inset-0 z-0"
                          style={{
                            backgroundImage: `url(${bgImageUrl})`,
                            backgroundPosition: bgPosition,
                            backgroundSize: bgScale === "fill" ? "100% 100%" : bgScale,
                            backgroundRepeat: "no-repeat",
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-950 via-[#0B0F15] to-emerald-950/40" />
                      )}

                      {/* Dark Overlay layer */}
                      <div
                        className="absolute inset-0 z-[1] transition-opacity pointer-events-none"
                        style={{ backgroundColor: `rgba(0, 0, 0, ${bgOverlayOpacity / 100})` }}
                      />

                      {/* Mockup Broadcast elements */}
                      <div className="relative z-10 flex items-center justify-between text-[10px] text-slate-300">
                        <span className="font-bold uppercase tracking-wider text-amber-400">NTL Auction Live</span>
                        <span className="font-mono bg-red-600/80 text-white px-1.5 py-0.5 rounded font-black">LIVE</span>
                      </div>

                      <div className="relative z-10 text-center space-y-1">
                        <div className="text-[9px] uppercase font-bold text-slate-400">Active Lot Preview</div>
                        <div className="text-sm font-black text-white uppercase tracking-tight">Rohan Sharma</div>
                        <div className="font-mono text-emerald-400 font-bold text-xs">₹2,50,000</div>
                      </div>

                      <div className="relative z-10 flex items-center justify-between text-[8px] text-slate-400 border-t border-white/10 pt-1">
                        <span>Overlay: {bgOverlayOpacity}%</span>
                        <span className="capitalize">{bgPosition} • {bgScale}</span>
                      </div>
                    </div>
                  </div>
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
