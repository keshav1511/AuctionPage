import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ success: false, error: "Google source validation has been retired. Use the local Excel or CSV import workflow.", code: "REMOTE_DATASOURCE_RETIRED" }, { status: 410 });
}
