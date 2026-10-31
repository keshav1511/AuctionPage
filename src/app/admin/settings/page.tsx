"use client";

import { useState } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { MOCK_RULES } from "@/lib/mock-data/auction";
import { Save, CheckCircle2 } from "lucide-react";

export default function AdminSettingsPage() {
  const [rules, setRules] = useState(MOCK_RULES);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#070A0D] flex text-slate-100">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Auction Rules & Increments"
          subtitle="Configure base price floors, dynamic bid slabs, and stage timer rules"
          action={
            <Button
              onClick={handleSave}
              variant="gold"
              size="sm"
              className="gap-2 font-bold text-black"
            >
              <Save className="w-4 h-4 fill-black" /> Save Configurations
            </Button>
          }
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto max-w-7xl">
          {savedNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Settings successfully saved and broadcasted to active room.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Category Base Price Floors */}
            <Card className="border-slate-800 bg-charcoal-900">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold text-white text-base">Category Base Price Floors</h3>
                <p className="text-xs text-slate-400">
                  Minimum starting bids automatically assigned to players in each pool tier.
                </p>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-400">Icon Player Pool</span>
                    <Input
                      type="number"
                      value={rules.iconBasePrice}
                      onChange={(e) =>
                        setRules({ ...rules, iconBasePrice: parseInt(e.target.value, 10) })
                      }
                      className="w-36 h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-cyan-400">Platinum Pool</span>
                    <Input
                      type="number"
                      value={rules.platinumBasePrice}
                      onChange={(e) =>
                        setRules({ ...rules, platinumBasePrice: parseInt(e.target.value, 10) })
                      }
                      className="w-36 h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-yellow-400">Gold Pool</span>
                    <Input
                      type="number"
                      value={rules.goldBasePrice}
                      onChange={(e) =>
                        setRules({ ...rules, goldBasePrice: parseInt(e.target.value, 10) })
                      }
                      className="w-36 h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">Silver Pool</span>
                    <Input
                      type="number"
                      value={rules.silverBasePrice}
                      onChange={(e) =>
                        setRules({ ...rules, silverBasePrice: parseInt(e.target.value, 10) })
                      }
                      className="w-36 h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-400">Emerging Pool</span>
                    <Input
                      type="number"
                      value={rules.emergingBasePrice}
                      onChange={(e) =>
                        setRules({ ...rules, emergingBasePrice: parseInt(e.target.value, 10) })
                      }
                      className="w-36 h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dynamic Bid Increment Slabs */}
            <Card className="border-slate-800 bg-charcoal-900">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold text-white text-base">Dynamic Bid Slab Rules</h3>
                <p className="text-xs text-slate-400">
                  Minimum increment steps applied as bidding thresholds advance.
                </p>

                <div className="space-y-3 pt-2">
                  {rules.bidSlabRules.map((slab, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg bg-charcoal-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-300">
                        Up to <strong className="text-white font-mono">{formatCurrency(slab.max)}</strong>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Step:</span>
                        <Badge variant="gold" className="font-mono text-xs">
                          +{formatCurrency(slab.step)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">Stage Countdown Duration</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={rules.timerDurationSeconds}
                        onChange={(e) =>
                          setRules({
                            ...rules,
                            timerDurationSeconds: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-20 h-8 text-xs font-mono"
                      />
                      <span className="text-slate-400">seconds</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
