import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ success: false, error: "Google Sheets synchronization has been retired. Use the local Excel or CSV importer." }, { status: 410 });
}
