import { NextRequest, NextResponse } from "next/server";
import readXlsxFile, { readSheet } from "read-excel-file/node";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; } else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(field); field = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const targetSheet = (formData.get("sheetName") as string) || null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Please attach an Excel (.xlsx) or CSV file." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const isCsv = file.name.toLowerCase().endsWith(".csv");
    if (!isCsv && !file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ success: false, error: "Only .xlsx and .csv uploads are supported." }, { status: 400 });
    }
    const sheetsList = isCsv ? ["CSV"] : (await readXlsxFile(buffer)).map((sheet) => sheet.sheet);

    if (!sheetsList || sheetsList.length === 0) {
      return NextResponse.json(
        { success: false, error: "The uploaded workbook does not contain any sheets." },
        { status: 400 }
      );
    }

    const selectedSheetName = targetSheet && sheetsList.includes(targetSheet) ? targetSheet : sheetsList[0];
    const rawData = isCsv
      ? parseCsv(new TextDecoder().decode(buffer))
      : await readSheet(buffer, selectedSheetName);

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
