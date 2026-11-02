import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { UTApi } from "uploadthing/server";
import { authenticateAdminActionRequest } from "@/lib/auth/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const permittedFolders = new Set(["players", "teams", "league"]);

function mediaPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  return new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Admin
    const auth = authenticateAdminActionRequest(req);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || "Unauthorized: Admin session required to upload media." },
        { status: 401 }
      );
    }

    if (!process.env.UPLOADTHING_TOKEN) return NextResponse.json({ success: false, error: "UPLOADTHING_TOKEN is not configured." }, { status: 503 });
    const formData = await req.formData();
    const uploaded = formData.get("file");
    const category = String(formData.get("folder") || "players");
    const leagueId = String(formData.get("leagueId") || "").trim() || null;
    const entityType = String(formData.get("entityType") || "").trim() || null;
    const entityId = String(formData.get("entityId") || "").trim() || null;
    if (!(uploaded instanceof File)) return NextResponse.json({ success: false, error: "No image file provided in form data." }, { status: 400 });
    if (!permittedFolders.has(category) || !uploaded.type.startsWith("image/")) return NextResponse.json({ success: false, error: "Only supported image categories can be uploaded." }, { status: 400 });

    const bytes = Buffer.from(await uploaded.arrayBuffer());
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    const file = new File([bytes], uploaded.name, { type: uploaded.type, lastModified: uploaded.lastModified });
    const result = await new UTApi({ token: process.env.UPLOADTHING_TOKEN }).uploadFiles(file);
    if (result.error || !result.data) throw new Error(result.error?.message || "UploadThing rejected the upload.");
    const output = result.data;
    const p = mediaPool();
    if (p) try {
      await p.query(`INSERT INTO media_assets (league_id, category, file_key, url, file_name, mime_type, content_hash, entity_type, entity_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [leagueId, category, output.key, output.ufsUrl || output.url, uploaded.name, uploaded.type, contentHash, entityType, entityId]);
    } finally { await p.end(); }

    return NextResponse.json({
      success: true,
      fileId: output.key,
      fileKey: output.key,
      url: output.ufsUrl || output.url,
      fileName: uploaded.name,
    });
  } catch (error: unknown) {
    console.error("[MediaUpload] Error handling upload:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Failed to upload image to UploadThing." },
      { status: 500 }
    );
  }
}
