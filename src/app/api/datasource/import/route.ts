import { NextResponse } from "next/server";

/** Google Sheets/Drive imports were retired. Use the local Excel/CSV importer. */
export async function POST() {
  return NextResponse.json({ success: false, error: "Remote Google data sources are no longer supported. Upload an Excel or CSV registration file from the admin importer.", code: "REMOTE_DATASOURCE_RETIRED" }, { status: 410 });
}
