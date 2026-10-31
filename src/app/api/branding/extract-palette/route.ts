import { NextRequest, NextResponse } from "next/server";
import { extractDominantColor } from "@/lib/media/image-normalizer";
import { generateSportsBrandingPalette } from "@/lib/branding/theme-generator";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let dominantHex = "#059669";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("logo") as File | null;
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await extractDominantColor(Buffer.from(arrayBuffer));
        dominantHex = result.hex;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      if (body.primaryColor) {
        dominantHex = body.primaryColor;
      } else if (body.logoUrl) {
        const res = await fetch(body.logoUrl);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const result = await extractDominantColor(Buffer.from(arrayBuffer));
          dominantHex = result.hex;
        }
      }
    }

    const palette = generateSportsBrandingPalette(dominantHex);

    return NextResponse.json({
      success: true,
      dominantHex,
      palette,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to extract logo color";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
