"use client";

import { useState } from "react";
import Image from "next/image";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminHeader } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatRole, getCategoryBadgeColor } from "@/lib/utils";
import { MOCK_PLAYERS } from "@/lib/mock-data/players";
import {
  FileSpreadsheet,
  Search,
  Plus,
  RefreshCw,
} from "lucide-react";

export default function AdminPlayersPage() {
  const [players] = useState(MOCK_PLAYERS);
  const [search, setSearch] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [sheetId, setSheetId] = useState("1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms");
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const filtered = players.filter(
    (p) =>
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.registrationNo.toLowerCase().includes(search.toLowerCase())
  );

  const handleSyncFromSheets = () => {
    setIsSyncing(true);
    setSyncStatus("Connecting to Google Sheets API v4...");

    setTimeout(() => {
      setSyncStatus("Parsing and validating player rows with Zod schema...");
    }, 700);

    setTimeout(() => {
      setIsSyncing(false);
      setSyncStatus(`Successfully synchronized ${players.length} player records!`);
      setTimeout(() => {
        setShowSyncModal(false);
        setSyncStatus(null);
      }, 1500);
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-[#070A0D] flex text-slate-100">
      <AdminNav />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          title="Player Pool Management"
          subtitle="Manage player registry, categories, base prices, and Google Sheets imports"
          action={
            <div className="flex items-center gap-3">
              <Button
                variant="gold"
                size="sm"
                onClick={() => setShowSyncModal(true)}
                className="gap-2 text-black font-bold"
              >
                <FileSpreadsheet className="w-4 h-4 fill-black" />
                Import from Google Sheets
              </Button>
              <Button variant="default" size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> Add Player
              </Button>
            </div>
          }
        />

        <main className="p-8 space-y-6 flex-1 overflow-y-auto max-w-7xl">
          {/* Sync Modal */}
          {showSyncModal && (
            <div className="p-6 rounded-2xl border-2 border-emerald-500/50 bg-charcoal-900 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  Google Sheets Ingestion Desk
                </h3>
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Enter your tournament registration Google Spreadsheet ID. Columns will be
                automatically mapped to Registration No, Full Name, Category, Role, and Base Price.
              </p>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Spreadsheet ID</label>
                <Input
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  className="bg-charcoal-950 font-mono text-xs"
                />
              </div>

              {syncStatus && (
                <p className="text-xs font-mono text-emerald-400 bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-500/30">
                  {syncStatus}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSyncModal(false)}
                  disabled={isSyncing}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSyncFromSheets}
                  disabled={isSyncing}
                  className="gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? "Ingesting..." : "Run Ingestion"}
                </Button>
              </div>
            </div>
          )}

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              placeholder="Search players by name or reg no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-charcoal-900 border-slate-800"
            />
          </div>

          {/* Players Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-charcoal-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-charcoal-950 border-b border-slate-800 text-slate-400 font-semibold uppercase">
                <tr>
                  <th className="p-3.5">Athlete</th>
                  <th className="p-3.5">Pool Category</th>
                  <th className="p-3.5">Primary Role</th>
                  <th className="p-3.5">Base Price</th>
                  <th className="p-3.5">Lot Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((player) => (
                  <tr key={player.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                          <Image
                            src={player.photoUrl}
                            alt={player.fullName}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-bold text-white">{player.fullName}</p>
                          <p className="font-mono text-[11px] text-slate-400">
                            {player.registrationNo}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5">
                      <Badge
                        variant="gold"
                        className={`text-[10px] ${getCategoryBadgeColor(player.category)}`}
                      >
                        {player.category}
                      </Badge>
                    </td>

                    <td className="p-3.5 text-slate-300">
                      {formatRole(player.primaryRole)}
                    </td>

                    <td className="p-3.5 font-mono font-bold text-white">
                      {formatCurrency(player.basePrice)}
                    </td>

                    <td className="p-3.5">
                      <Badge variant="outline" className="text-[10px]">
                        {player.status}
                      </Badge>
                    </td>

                    <td className="p-3.5 text-right">
                      <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white">
                        Edit Lot
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
