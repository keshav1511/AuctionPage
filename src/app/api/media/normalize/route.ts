import { NextRequest, NextResponse } from "next/server";
import { normalizePlayerImage } from "@/lib/media/image-normalizer";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let buffer: Buffer;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "Missing file in form-data" }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      const body = await req.json().catch(() => ({}));
      const imageUrl = body.imageUrl;
      if (!imageUrl) {
        return NextResponse.json({ error: "Missing imageUrl in request body" }, { status: 400 });
      }
      const res = await fetch(imageUrl);
      if (!res.ok) {
        return NextResponse.json({ error: "Failed to download image from provided URL" }, { status: 400 });
      }
      const arrayBuffer = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    const normalized = await normalizePlayerImage(buffer);

    return NextResponse.json({
      success: true,
      format: normalized.format,
      aspectRatio: normalized.aspectRatio,
      width: normalized.width,
      height: normalized.height,
      wasRotated: normalized.wasRotated,
      wasLandscape: normalized.wasLandscape,
      dataUrl: normalized.base64,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to normalize image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
