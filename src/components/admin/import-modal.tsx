"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Player, PlayerCategory, PlayerRole } from "@/types";
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, X, Table, Users, Award, Shield } from "lucide-react";

export interface ParsedSheetPayload {
  success: boolean;
  sheets?: string[];
  activeSheet?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  totalRows: number;
}

export interface ColumnMapping {
  nameCol: string;
  typeCol: string;
  regNoCol: string;
  categoryCol: string;
  roleCol: string;
  priceCol: string;
  photoCol: string;
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSheetUrl?: string;
  onImportComplete: (data: {
    players: Player[];
    owners: Array<{ name: string; photoUrl?: string }>;
    icons: Array<{ name: string; photoUrl?: string }>;
  }) => void;
  activeLeagueId: string;
}

export function ImportModal({
  isOpen,
  onClose,
  defaultSheetUrl,
  onImportComplete,
  activeLeagueId,
}: ImportModalProps) {
  const [sourceType, setSourceType] = useState<"sheets" | "excel">("sheets");
  const [sheetUrl, setSheetUrl] = useState(
    defaultSheetUrl || "https://docs.google.com/spreadsheets/d/1uC87Sn8KLbAHs9g1ZT63AIyIY85C7LVh-cZF8dvvgo0/edit?usp=sharing"
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Parsed sheet data
  const [parsedData, setParsedData] = useState<ParsedSheetPayload | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");

  // Column Mapping state
  const [mapping, setMapping] = useState<ColumnMapping>({
    nameCol: "",
    typeCol: "",
    regNoCol: "",
    categoryCol: "",
    roleCol: "",
    priceCol: "",
    photoCol: "",
  });

  // Step state: 1 = source & parse, 2 = map columns & preview
  const [step, setStep] = useState<1 | 2>(1);

  // Auto-detect mappings from headers
  const autoDetectColumns = (headers: string[]): ColumnMapping => {
    const findHeader = (patterns: string[]): string => {
      const match = headers.find((h) => {
        const lower = h.toLowerCase().trim();
        return patterns.some((p) => lower.includes(p));
      });
      return match || "";
    };

    return {
      nameCol: findHeader(["name", "player name", "athlete", "full name"]),
      typeCol: findHeader(["player/ icon/ owner", "type", "role/type", "category/type", "designation"]),
      regNoCol: findHeader(["reg", "id", "no", "token"]),
      categoryCol: findHeader(["category", "tier", "grade", "class"]),
      roleCol: findHeader(["role", "primary role", "specialization", "skill"]),
      priceCol: findHeader(["price", "base price", "base", "cost", "points"]),
      photoCol: findHeader(["photo", "photo link", "image", "picture", "url"]),
    };
  };

  // Fetch and parse Google Sheet
  const handleParseGoogleSheet = async () => {
    if (!sheetUrl.trim()) {
      setErrorNotice("Please enter a valid Google Sheets URL.");
      return;
    }
    setLoading(true);
    setErrorNotice(null);

    try {
      const res = await fetch("/api/sheets/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetUrl }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to parse Google Sheet.");
      }

      setParsedData(data);
      setAvailableSheets(data.sheets || []);
      setSelectedSheet(data.activeSheet || "");
      setMapping(autoDetectColumns(data.headers || []));
      setStep(2);
    } catch (err: unknown) {
      setErrorNotice(err instanceof Error ? err.message : "Failed to connect to Google Sheets.");
    } finally {
      setLoading(false);
    }
  };

  // Upload and parse Excel file
  const handleParseExcelFile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedFile) {
      setErrorNotice("Please select an Excel or CSV file from your computer.");
      return;
    }
    setLoading(true);
    setErrorNotice(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (selectedSheet) formData.append("sheetName", selectedSheet);

      const res = await fetch("/api/excel/parse", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to parse Excel workbook.");
      }

      setParsedData(data);
      setAvailableSheets(data.sheets || []);
      setSelectedSheet(data.activeSheet || "");
      setMapping(autoDetectColumns(data.headers || []));
      setStep(2);
    } catch (err: unknown) {
      setErrorNotice(err instanceof Error ? err.message : "Failed to parse Excel file.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to extract value from row according to mapping
  const getColValue = (row: (string | number | null | undefined)[], colName: string): string => {
    if (!colName || !parsedData) return "";
    const colIdx = parsedData.headers.indexOf(colName);
    if (colIdx === -1 || colIdx >= row.length) return "";
    const val = row[colIdx];
    return val !== undefined && val !== null ? String(val).trim() : "";
  };

  // Derive transformed rows with categorization
  const deriveRecords = () => {
    if (!parsedData) return { players: [], owners: [], icons: [], duplicates: [], warnings: [] };

    const players: Player[] = [];
    const owners: Array<{ name: string; photoUrl?: string }> = [];
    const icons: Array<{ name: string; photoUrl?: string }> = [];
    const duplicates: string[] = [];
    const warnings: string[] = [];
    const seenNames = new Set<string>();

    parsedData.rows.forEach((row, idx) => {
      const rawName = getColValue(row, mapping.nameCol);
      if (!rawName) return; // skip blank row

      const lowerName = rawName.toLowerCase();
      if (seenNames.has(lowerName)) {
        duplicates.push(rawName);
      }
      seenNames.add(lowerName);

      const rawType = getColValue(row, mapping.typeCol).toUpperCase();
      const rawCategory = getColValue(row, mapping.categoryCol).toUpperCase();
      const rawRole = getColValue(row, mapping.roleCol).toUpperCase();
      const rawPrice = getColValue(row, mapping.priceCol);
      const photoUrl = getColValue(row, mapping.photoCol);
      const regNo = getColValue(row, mapping.regNoCol) || `REG-${1000 + idx}`;

      // Identify whether this row is an Owner, an Icon Player, or a standard Auction Player
      const isOwner = rawType.includes("OWNER");
      const isIcon = rawType.includes("ICON") || rawCategory.includes("ICON");

      if (isOwner) {
        owners.push({ name: rawName, photoUrl: photoUrl || undefined });
      } else if (isIcon) {
        icons.push({ name: rawName, photoUrl: photoUrl || undefined });
        // Also register Icon in player pool with ICON category
        players.push({
          id: `player-icon-${idx}-${Date.now()}`,
          seasonId: activeLeagueId,
          registrationNo: regNo,
          fullName: rawName,
          category: "ICON",
          primaryRole: "ALL_ROUNDER",
          battingStyle: "Right-Hand Bat",
          bowlingStyle: "Right-Arm Medium",
          photoUrl: photoUrl || "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80",
          basePrice: 200000,
          status: "AVAILABLE",
          sortOrder: idx + 1,
        });
      } else {
        // Standard Player
        let category: PlayerCategory = "SILVER";
        if (rawCategory.includes("PLATINUM")) category = "PLATINUM";
        else if (rawCategory.includes("GOLD")) category = "GOLD";
        else if (rawCategory.includes("EMERGING")) category = "EMERGING";

        let role: PlayerRole = "BATSMAN";
        if (rawRole.includes("BOWL")) role = "BOWLER";
        else if (rawRole.includes("ALL") || rawRole.includes("AR")) role = "ALL_ROUNDER";
        else if (rawRole.includes("KEEP") || rawRole.includes("WK")) role = "WICKET_KEEPER";

        const parsedBasePrice = rawPrice ? parseInt(rawPrice.replace(/[^0-9]/g, ""), 10) || 25000 : 25000;

        players.push({
          id: `player-import-${idx}-${Date.now()}`,
          seasonId: activeLeagueId,
          registrationNo: regNo,
          fullName: rawName,
          category,
          primaryRole: role,
          battingStyle: "Right-Hand Bat",
          bowlingStyle: "Right-Arm Medium",
          photoUrl: photoUrl || "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&auto=format&fit=crop&q=80",
          basePrice: parsedBasePrice,
          status: "AVAILABLE",
          sortOrder: idx + 1,
        });
      }
    });

    return { players, owners, icons, duplicates, warnings };
  };

  const { players, owners, icons, duplicates } = deriveRecords();

  const handleConfirmImport = () => {
    if (players.length === 0 && owners.length === 0 && icons.length === 0) {
      setErrorNotice("No valid records found to import.");
      return;
    }

    onImportComplete({ players, owners, icons });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white text-slate-900 border border-slate-200 shadow-xl rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Import Tournament & Player Data
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                Import player rosters, franchise owners, and icon players via Google Sheets or Excel (.xlsx / .xls).
              </DialogDescription>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper indicator */}
          <div className="flex items-center gap-4 mt-4 text-xs font-semibold">
            <span className={`flex items-center gap-1.5 ${step === 1 ? "text-emerald-700" : "text-slate-500"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 1 ? "bg-emerald-600 text-white font-bold" : "bg-slate-100 text-slate-700"}`}>
                1
              </span>
              Select Data Source
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
            <span className={`flex items-center gap-1.5 ${step === 2 ? "text-emerald-700" : "text-slate-400"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 2 ? "bg-emerald-600 text-white font-bold" : "bg-slate-100 text-slate-400"}`}>
                2
              </span>
              Map Columns & Preview
            </span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorNotice && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
              <span>{errorNotice}</span>
              <button onClick={() => setErrorNotice(null)} className="text-red-500 hover:text-red-800 font-bold">
                ✕
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              {/* Source Tabs */}
              <div className="flex border-b border-slate-200 gap-6">
                <button
                  type="button"
                  onClick={() => setSourceType("sheets")}
                  className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                    sourceType === "sheets"
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Option A: Google Sheets URL
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType("excel")}
                  className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                    sourceType === "excel"
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Option B: Excel / CSV File Upload
                </button>
              </div>

              {sourceType === "sheets" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Google Sheets URL</label>
                    <Input
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="bg-white border-slate-300 font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      Supports any Google Sheet with public view permissions or authorized service account access.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-600">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Reference Spreadsheet Pre-Loaded
                    </div>
                    <p className="text-[11px]">
                      The official Nalanda Turf League reference sheet (with columns <code>Name</code>, <code>Photo Link</code>, and <code>Player/ Icon/ Owner</code>) is loaded by default.
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      onClick={handleParseGoogleSheet}
                      disabled={loading}
                      className="bg-slate-900 hover:bg-slate-800 text-white gap-2 font-medium"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Reading Google Sheet...
                        </>
                      ) : (
                        <>
                          Continue to Column Mapping
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Select Excel Workbook (.xlsx, .xls) or CSV</label>
                    <div className="border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-2xl p-8 text-center bg-slate-50 cursor-pointer">
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="excel-file-input"
                      />
                      <label htmlFor="excel-file-input" className="cursor-pointer space-y-2 block">
                        <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                        <div className="text-xs font-medium text-slate-700">
                          {selectedFile ? (
                            <span className="font-bold text-emerald-700">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                          ) : (
                            <span>Click to choose or drag & drop .xlsx, .xls, or .csv</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">All columns, sheets, and headers will be auto-detected</p>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      onClick={handleParseExcelFile}
                      disabled={!selectedFile || loading}
                      className="bg-slate-900 hover:bg-slate-800 text-white gap-2 font-medium"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Parsing Workbook...
                        </>
                      ) : (
                        <>
                          Continue to Column Mapping
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && parsedData && (
            <div className="space-y-6">
              {/* Sheet selector if multiple sheets */}
              {availableSheets.length > 1 && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <span className="font-semibold text-slate-700">Select Sheet Tab:</span>
                  <select
                    value={selectedSheet}
                    onChange={(e) => {
                      setSelectedSheet(e.target.value);
                      if (sourceType === "excel") handleParseExcelFile();
                    }}
                    className="bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 font-medium"
                  >
                    {availableSheets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Column Mapping Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Table className="w-4 h-4 text-slate-500" />
                    Column Field Mapping
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Detected {parsedData.headers.length} headers in sheet
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Full Name * <span className="text-red-500">(Required)</span>
                    </label>
                    <select
                      value={mapping.nameCol}
                      onChange={(e) => setMapping({ ...mapping, nameCol: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
                    >
                      <option value="">-- Choose Column --</option>
                      {parsedData.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Entity Type / Role <span className="text-slate-400">(Player, Icon, Owner)</span>
                    </label>
                    <select
                      value={mapping.typeCol}
                      onChange={(e) => setMapping({ ...mapping, typeCol: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
                    >
                      <option value="">-- Choose Column (Optional) --</option>
                      {parsedData.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Photo Link / URL
                    </label>
                    <select
                      value={mapping.photoCol}
                      onChange={(e) => setMapping({ ...mapping, photoCol: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
                    >
                      <option value="">-- Choose Column (Optional) --</option>
                      {parsedData.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">Category / Tier</label>
                    <select
                      value={mapping.categoryCol}
                      onChange={(e) => setMapping({ ...mapping, categoryCol: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
                    >
                      <option value="">-- Choose Column (Optional) --</option>
                      {parsedData.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">Playing Role</label>
                    <select
                      value={mapping.roleCol}
                      onChange={(e) => setMapping({ ...mapping, roleCol: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
                    >
                      <option value="">-- Choose Column (Optional) --</option>
                      {parsedData.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">Base Price</label>
                    <select
                      value={mapping.priceCol}
                      onChange={(e) => setMapping({ ...mapping, priceCol: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
                    >
                      <option value="">-- Choose Column (Optional) --</option>
                      {parsedData.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Data Summary & Quality Badges */}
              <div className="flex flex-wrap items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div className="font-semibold text-slate-700">Detected Records:</div>
                <Badge variant="outline" className="bg-white text-slate-800 font-semibold gap-1">
                  <Users className="w-3 h-3 text-blue-600" />
                  {players.length} Players
                </Badge>
                <Badge variant="outline" className="bg-white text-slate-800 font-semibold gap-1">
                  <Award className="w-3 h-3 text-amber-600" />
                  {icons.length} Icon Players
                </Badge>
                <Badge variant="outline" className="bg-white text-slate-800 font-semibold gap-1">
                  <Shield className="w-3 h-3 text-emerald-600" />
                  {owners.length} Team Owners
                </Badge>

                {duplicates.length > 0 && (
                  <Badge variant="destructive" className="gap-1 font-semibold">
                    <AlertTriangle className="w-3 h-3" />
                    {duplicates.length} Duplicates Detected
                  </Badge>
                )}
              </div>

              {/* Live Preview Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Data Preview (First 15 Rows)
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold sticky top-0">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Name</th>
                        <th className="p-2.5">Detected Type</th>
                        <th className="p-2.5">Category</th>
                        <th className="p-2.5">Role</th>
                        <th className="p-2.5">Base Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {parsedData.rows.slice(0, 15).map((row, i) => {
                        const name = getColValue(row, mapping.nameCol);
                        const type = getColValue(row, mapping.typeCol) || "Player";
                        const isDup = duplicates.includes(name);

                        return (
                          <tr key={i} className={isDup ? "bg-amber-50" : "hover:bg-slate-50"}>
                            <td className="p-2.5 font-mono text-slate-400">{i + 1}</td>
                            <td className="p-2.5 font-semibold text-slate-900">
                              {name || <span className="text-slate-300 italic">(Empty)</span>}
                              {isDup && (
                                <span className="ml-2 text-[10px] text-amber-700 font-bold bg-amber-100 px-1 py-0.5 rounded">
                                  Duplicate
                                </span>
                              )}
                            </td>
                            <td className="p-2.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold ${
                                  type.toLowerCase().includes("owner")
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : type.toLowerCase().includes("icon")
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                }`}
                              >
                                {type}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-slate-600">
                              {type.toLowerCase().includes("icon") ? "ICON" : "SILVER"}
                            </td>
                            <td className="p-2.5 text-slate-600">Batsman</td>
                            <td className="p-2.5 font-mono text-slate-700">
                              {type.toLowerCase().includes("icon") ? "₹2,00,000" : "₹25,000"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Back to Source
                </Button>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    className="border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmImport}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5"
                  >
                    Import {players.length} Players & Roles
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
