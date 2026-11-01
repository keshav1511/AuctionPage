import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/auth/admin-auth";
import { callAppsScript, isAppsScriptConfigured } from "@/lib/sheets/apps-script-client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Admin
    const session = getAdminSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Admin session required to upload media." },
        { status: 401 }
      );
    }

    let base64Data = "";
    let fileName = "";
    let mimeType = "image/jpeg";
    let folderId = "";
    let subfolder = "players";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      folderId = (formData.get("folderId") as string) || "";
      const rawFolder = (formData.get("folder") as string) || "";
      if (rawFolder === "players" || rawFolder === "teams" || rawFolder === "league") {
        subfolder = rawFolder;
      }

      if (!file) {
        return NextResponse.json(
          { success: false, error: "No image file provided in form data." },
          { status: 400 }
        );
      }

      fileName = file.name;
      mimeType = file.type || "image/jpeg";
      const buffer = Buffer.from(await file.arrayBuffer());
      base64Data = buffer.toString("base64");
    } else {
      const json = await req.json();
      base64Data = json.base64Data || json.base64 || "";
      fileName = json.fileName || json.name || "image.jpg";
      mimeType = json.mimeType || "image/jpeg";
      folderId = json.folderId || "";
      if (json.folder === "players" || json.folder === "teams" || json.folder === "league") {
        subfolder = json.folder;
      }
    }

    if (!base64Data) {
      return NextResponse.json(
        { success: false, error: "Image data is empty." },
        { status: 400 }
      );
    }

    // 2. Upload to Google Drive via Apps Script Bridge
    if (!isAppsScriptConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "Apps Script persistence bridge is not configured. Configure APPS_SCRIPT_WEB_APP_URL and APPS_SCRIPT_SHARED_SECRET."
        },
        { status: 503 }
      );
    }

    const result = await callAppsScript<{
      success: boolean;
      fileId: string;
      url: string;
      fileName: string;
      error?: string;
    }>("UPLOAD_IMAGE", {
      base64Data,
      fileName,
      mimeType,
      folderId: folderId || undefined,
      subfolder,
    });

    if (!result || !result.fileId || !result.url) {
      return NextResponse.json(
        { success: false, error: result?.error || "Drive upload returned an invalid response." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      fileId: result.fileId,
      url: result.url,
      fileName: result.fileName || fileName,
    });
  } catch (error: unknown) {
    console.error("[MediaUpload] Error handling upload:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Failed to upload image to Google Drive." },
      { status: 500 }
    );
  }
}
