import { NextResponse } from "next/server";

export async function GET() {
  const configured = Boolean(process.env.DATABASE_URL && process.env.UPLOADTHING_TOKEN);
  return NextResponse.json({ status: configured ? "healthy" : "misconfigured", app: "NTL Auction Platform", timestamp: new Date().toISOString(), services: { dataStorage: "postgresql", media: "uploadthing", configured } }, { status: configured ? 200 : 503 });
}
