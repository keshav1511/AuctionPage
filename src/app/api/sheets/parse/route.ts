import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ success: false, error: "Google Sheets parsing has been retired. Upload a local Excel or CSV file." }, { status: 410 });
}
