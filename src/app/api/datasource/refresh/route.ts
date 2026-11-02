import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ success: false, error: "Remote Google refresh has been retired. Re-upload the local Excel or CSV source file.", code: "REMOTE_DATASOURCE_RETIRED" }, { status: 410 });
}
