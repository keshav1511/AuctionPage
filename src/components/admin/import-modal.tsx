"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Player } from "@/types";
import {
  detectRegistrationColumns,
  parseRegistrationRows,
  ColumnMappingConfig,
} from "@/lib/sheets/registration-parser";
import {
  FileSpreadsheet,
  Upload,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  X,
  Table,
  Users,
  Award,
  Shield,
  FolderOpen,
} from "lucide-react";

export interface ParsedSheetPayload {
  success: boolean;
  sheets?: string[];
  activeSheet?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  totalRows: number;
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSheetUrl?: string;
  defaultDriveUrl?: string;
  defaultBasePrice?: number;
  existingPlayerCount?: number;
  onImportComplete?: (data: {
    players: Player[];
    owners: Array<{ name: string; photoUrl?: string; teamName?: string }>;
    icons: Array<{ name: string; photoUrl?: string; teamName?: string }>;
    mode: "append" | "replace";
  }) => void;
  activeLeagueId: string;
}

export function ImportModal({
  isOpen,
  onClose,
  defaultSheetUrl,
  defaultDriveUrl,
  defaultBasePrice,
  existingPlayerCount = 0,
  onImportComplete,
  activeLeagueId,
}: ImportModalProps) {
  const [sourceType, setSourceType] = useState<"sheets" | "excel">("excel");
  const [sheetUrl, setSheetUrl] = useState(defaultSheetUrl || "");
  const [driveUrl, setDriveUrl] = useState(defaultDriveUrl || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"append" | "replace">(existingPlayerCount > 0 ? "append" : "replace");

  // Sync props when opening
  useEffect(() => {
    if (defaultSheetUrl !== undefined) setSheetUrl(defaultSheetUrl || "");
    if (defaultDriveUrl !== undefined) setDriveUrl(defaultDriveUrl || "");
  }, [defaultSheetUrl, defaultDriveUrl, isOpen]);

  // Parsed sheet data
  const [parsedData, setParsedData] = useState<ParsedSheetPayload | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");

  // Column Mapping state
  const [mapping, setMapping] = useState<ColumnMappingConfig>({
    nameCol: "",
    typeCol: "",
    teamCol: "",
    regNoCol: "",
    categoryCol: "",
    roleCol: "",
    priceCol: "",
    photoCol: "",
  });

  // Step state: 1 = source & parse, 2 = map columns & preview
  const [step, setStep] = useState<1 | 2>(1);

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
      const detected = detectRegistrationColumns(data.headers || [], data.rows || []);
      setMapping(detected);
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
      const detected = detectRegistrationColumns(data.headers || [], data.rows || []);
      setMapping(detected);
      setStep(2);
    } catch (err: unknown) {
      setErrorNotice(err instanceof Error ? err.message : "Failed to parse Excel file.");
    } finally {
      setLoading(false);
    }
  };

  // Derive transformed rows with categorization using pure parser
  const validationSummary = parsedData
    ? parseRegistrationRows(parsedData.headers, parsedData.rows, mapping, defaultBasePrice || 2000)
    : null;

  const derivedPlayers: Player[] = [];
  const derivedOwners: Array<{ name: string; photoUrl?: string; teamName?: string }> = [];
  const derivedIcons: Array<{ name: string; photoUrl?: string; teamName?: string }> = [];

  if (validationSummary) {
    validationSummary.records.forEach((rec, idx) => {
      if (rec.type === "OWNER") {
        derivedOwners.push({
          name: rec.name,
          photoUrl: rec.resolvedPhotoUrl || rec.photoRef || undefined,
          teamName: rec.teamAffiliation,
        });
      } else if (rec.type === "ICON") {
        derivedIcons.push({
          name: rec.name,
          photoUrl: rec.resolvedPhotoUrl || rec.photoRef || undefined,
          teamName: rec.teamAffiliation,
        });
        derivedPlayers.push({
          id: `player-icon-${idx}-${Date.now()}`,
          seasonId: activeLeagueId,
          registrationNo: `ICON-${String(idx + 1).padStart(3, "0")}`,
          fullName: rec.name,
          category: rec.category || undefined,
          primaryRole: rec.role || "ALL_ROUNDER",
          battingStyle: "Right-Hand Bat",
          bowlingStyle: "Right-Arm Medium",
          photoUrl: rec.resolvedPhotoUrl || rec.photoRef || "",
          basePrice: rec.basePrice || defaultBasePrice || 2000,
          status: "AVAILABLE",
          sortOrder: idx + 1,
        });
      } else {
        derivedPlayers.push({
          id: `player-import-${idx}-${Date.now()}`,
          seasonId: activeLeagueId,
          registrationNo: `REG-${String(idx + 1).padStart(3, "0")}`,
          fullName: rec.name,
          category: rec.category || undefined,
          primaryRole: rec.role || "ALL_ROUNDER",
          battingStyle: "Right-Hand Bat",
          bowlingStyle: "Right-Arm Medium",
          photoUrl: rec.resolvedPhotoUrl || rec.photoRef || "",
          basePrice: rec.basePrice || defaultBasePrice || 2000,
          status: "AVAILABLE",
          sortOrder: idx + 1,
        });
      }
    });
  }

  const handleConfirmImport = async () => {
    if (!validationSummary || validationSummary.records.length === 0) {
      setErrorNotice("No valid records found to import.");
      return;
    }

    setLoading(true);
    setErrorNotice(null);

    try {
      // If importing from Google Sheets, invoke server datasource import route
      if (sourceType === "sheets" && sheetUrl.trim()) {
        const res = await fetch("/api/datasource/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leagueId: activeLeagueId,
            googleSheetsUrl: sheetUrl.trim(),
            googleDriveFolderUrl: driveUrl.trim() || undefined,
          }),
        });
        const result = await res.json();
        if (!result.success) {
          throw new Error(result.error || "Failed to import registration data into league workbook");
        }
      }

      onImportComplete?.({
        players: derivedPlayers,
        owners: derivedOwners,
        icons: derivedIcons,
        mode: importMode,
      });

      onClose();
    } catch (err: unknown) {
      setErrorNotice(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
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
                    <label className="text-xs font-semibold text-slate-700">
                      Google Sheets Registration URL * <span className="text-red-500">(Required)</span>
                    </label>
                    <Input
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="bg-white border-slate-300 font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      URL of the Google Sheet containing player registrations, icons, owners, and team affiliations.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                      Google Drive Photographs Folder URL <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <Input
                      value={driveUrl}
                      onChange={(e) => setDriveUrl(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/..."
                      className="bg-white border-slate-300 font-mono text-xs"
                    />
                    <p className="text-[11px] text-slate-500">
                      Folder containing photo files. Filenames in the sheet will be dynamically matched (case-insensitive, extension-tolerant).
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      onClick={handleParseGoogleSheet}
                      disabled={loading || !sheetUrl.trim()}
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

              {parsedData.headers.length === 1 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <span className="font-bold">✓ Single-column file detected:</span>
                  <span>All {parsedData.totalRows} entries will be imported as available auction players.</span>
                </div>
              )}

              {validationSummary && validationSummary.duplicates.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    Duplicate Player Names Detected ({validationSummary.duplicates.length})
                  </div>
                  <p className="text-[11px] text-amber-700">
                    The following names appear multiple times: {validationSummary.duplicates.slice(0, 5).join(", ")}{validationSummary.duplicates.length > 5 ? ` and ${validationSummary.duplicates.length - 5} more` : ""}.
                  </p>
                </div>
              )}

              {existingPlayerCount > 0 && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">Import Target Mode</span>
                  <div className="flex flex-wrap items-center gap-6 text-xs font-medium">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="append"
                        checked={importMode === "append"}
                        onChange={() => setImportMode("append")}
                        className="text-emerald-600"
                      />
                      <span>Append to current {existingPlayerCount} players</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="replace"
                        checked={importMode === "replace"}
                        onChange={() => setImportMode("replace")}
                        className="text-red-600"
                      />
                      <span className="text-red-700 font-semibold">Replace existing {existingPlayerCount} players</span>
                    </label>
                  </div>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                      {parsedData.headers.map((h, i) => (
                        <option key={i} value={h}>
                          {h || `Column ${i + 1}`}
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
                      {parsedData.headers.map((h, i) => (
                        <option key={i} value={h}>
                          {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Team Affiliation <span className="text-slate-400">(Owners & Icons)</span>
                    </label>
                    <select
                      value={mapping.teamCol}
                      onChange={(e) => setMapping({ ...mapping, teamCol: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
                    >
                      <option value="">-- Choose Column (Optional) --</option>
                      {parsedData.headers.map((h, i) => (
                        <option key={i} value={h}>
                          {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Photo Link / Filename
                    </label>
                    <select
                      value={mapping.photoCol}
                      onChange={(e) => setMapping({ ...mapping, photoCol: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
                    >
                      <option value="">-- Choose Column (Optional) --</option>
                      {parsedData.headers.map((h, i) => (
                        <option key={i} value={h}>
                          {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">Playing Role</label>
                    <select
                      value={mapping.roleCol || ""}
                      onChange={(e) => setMapping({ ...mapping, roleCol: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
                    >
                      <option value="">-- Choose Column (Optional) --</option>
                      {parsedData.headers.map((h, i) => (
                        <option key={i} value={h}>
                          {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700">Base Price</label>
                    <select
                      value={mapping.priceCol || ""}
                      onChange={(e) => setMapping({ ...mapping, priceCol: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium"
                    >
                      <option value="">-- Choose Column (Optional) --</option>
                      {parsedData.headers.map((h, i) => (
                        <option key={i} value={h}>
                          {h || `Column ${i + 1}`}
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
                  {derivedPlayers.length} Players
                </Badge>
                <Badge variant="outline" className="bg-white text-slate-800 font-semibold gap-1">
                  <Award className="w-3 h-3 text-amber-600" />
                  {derivedIcons.length} Icon Players
                </Badge>
                <Badge variant="outline" className="bg-white text-slate-800 font-semibold gap-1">
                  <Shield className="w-3 h-3 text-emerald-600" />
                  {derivedOwners.length} Team Owners
                </Badge>
                {validationSummary && validationSummary.teamsDiscovered.length > 0 && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold gap-1">
                    {validationSummary.teamsDiscovered.length} Teams Discovered
                  </Badge>
                )}

                {validationSummary && validationSummary.duplicates.length > 0 && (
                  <Badge variant="destructive" className="gap-1 font-semibold">
                    <AlertTriangle className="w-3 h-3" />
                    {validationSummary.duplicates.length} Duplicates Detected
                  </Badge>
                )}
              </div>

              {/* Discovered Teams preview if any */}
              {validationSummary && validationSummary.teamsDiscovered.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <div className="font-semibold text-slate-700">Discovered Franchises from Affiliation:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {validationSummary.teamsDiscovered.map((teamName, idx) => (
                      <span key={idx} className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium text-slate-800">
                        {teamName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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
                        <th className="p-2.5">Team Affiliation</th>
                        <th className="p-2.5">Photo Link / File</th>
                        <th className="p-2.5">Playing Role</th>
                        <th className="p-2.5">Base Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {validationSummary?.records.slice(0, 15).map((rec, i) => {
                        const isDup = validationSummary.duplicates.includes(rec.name);

                        return (
                          <tr key={i} className={isDup ? "bg-amber-50" : "hover:bg-slate-50"}>
                            <td className="p-2.5 font-mono text-slate-400">{i + 1}</td>
                            <td className="p-2.5 font-semibold text-slate-900">
                              {rec.name || <span className="text-slate-300 italic">(Empty)</span>}
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
                                  rec.type === "OWNER"
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : rec.type === "ICON"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                }`}
                              >
                                {rec.type}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-slate-700 font-medium">
                              {rec.teamAffiliation || <span className="text-slate-400 italic">None</span>}
                            </td>
                            <td className="p-2.5 text-slate-600 truncate max-w-[150px] font-mono text-[11px]">
                              {rec.photoRef || <span className="text-slate-300 italic">None</span>}
                            </td>
                            <td className="p-2.5 text-slate-600 font-medium">
                              {rec.role || "ALL_ROUNDER"}
                            </td>
                            <td className="p-2.5 font-mono text-slate-700">
                              {rec.type === "ICON" ? "₹2,00,000" : (rec.basePrice ? `₹${rec.basePrice.toLocaleString("en-IN")}` : "₹25,000")}
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
                  disabled={loading}
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
                    disabled={loading}
                    className="border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={loading || derivedPlayers.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 gap-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Importing & Syncing Data...
                      </>
                    ) : (
                      `Import ${derivedPlayers.length} Players & Rosters`
                    )}
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
