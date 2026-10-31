import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const targetSheet = (formData.get("sheetName") as string) || null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Please attach an Excel file (.xlsx, .xls) or CSV." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetsList = workbook.SheetNames;

    if (!sheetsList || sheetsList.length === 0) {
      return NextResponse.json(
        { success: false, error: "The uploaded workbook does not contain any sheets." },
        { status: 400 }
      );
    }

    const selectedSheetName = targetSheet && sheetsList.includes(targetSheet) ? targetSheet : sheetsList[0];
    const sheet = workbook.Sheets[selectedSheetName];
    const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

    if (!rawData || rawData.length === 0) {
      return NextResponse.json(
        { success: false, error: "The selected sheet is empty." },
        { status: 400 }
      );
    }

    // Find first non-empty header row
    let headerRowIdx = 0;
    while (headerRowIdx < rawData.length && (!rawData[headerRowIdx] || (rawData[headerRowIdx] as unknown[]).filter(Boolean).length === 0)) {
      headerRowIdx++;
    }

    const headers = (rawData[headerRowIdx] || []).map((h: unknown, i: number) => String(h || `Column ${i + 1}`).trim());
    const dataRows = rawData
      .slice(headerRowIdx + 1)
      .filter((r) => Array.isArray(r) && r.some((c) => c !== undefined && c !== null && String(c).trim() !== ""));

    return NextResponse.json({
      success: true,
      fileName: file.name,
      sheets: sheetsList,
      activeSheet: selectedSheetName,
      headers,
      rows: dataRows,
      totalRows: dataRows.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to parse uploaded Excel file";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
