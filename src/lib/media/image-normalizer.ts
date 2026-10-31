import sharp, { type Sharp } from "sharp";

export interface NormalizedImageResult {
  format: "webp";
  width: number;
  height: number;
  aspectRatio: "3:4";
  buffer: Buffer;
  base64: string;
  originalWidth?: number;
  originalHeight?: number;
  wasRotated: boolean;
  wasLandscape: boolean;
}

export interface DominantColorResult {
  hex: string;
  rgb: { r: number; g: number; b: number };
}

/**
 * Normalizes any uploaded or Drive player image to an authoritative 3:4 portrait WebP image:
 * - Automatically corrects EXIF orientation rotation.
 * - Protects landscape photographs from aggressive crop using smart contain or north-focused cropping.
 * - Produces optimized WebP buffer.
 */
export async function normalizePlayerImage(
  input: Buffer | Uint8Array,
  targetWidth: number = 600,
  targetHeight: number = 800
): Promise<NormalizedImageResult> {
  const inputBuffer = Buffer.isBuffer(input) ? input : Buffer.from(input);

  // 1. Auto-rotate based on EXIF orientation tag
  const rotatedPipeline = sharp(inputBuffer).rotate();
  const metadata = await rotatedPipeline.metadata();

  const originalWidth = metadata.width || targetWidth;
  const originalHeight = metadata.height || targetHeight;
  const isLandscape = originalWidth > originalHeight;

  let processedPipeline: Sharp;

  if (isLandscape) {
    // Landscape photo protection:
    // Create subtle padded contain with dark charcoal background (#11161B)
    // so the athlete is fully visible without chopping off their shoulders or head.
    processedPipeline = rotatedPipeline.resize(targetWidth, targetHeight, {
      fit: "contain",
      background: { r: 17, g: 22, b: 27, alpha: 1 },
    });
  } else {
    // Portrait photo:
    // Crop with top/north focus to keep the face in prominent view
    processedPipeline = rotatedPipeline.resize(targetWidth, targetHeight, {
      fit: "cover",
      position: sharp.gravity.north,
    });
  }

  // 2. Convert to optimized WebP
  const outputBuffer = await processedPipeline
    .webp({ quality: 85, effort: 4 })
    .toBuffer();

  const base64 = `data:image/webp;base64,${outputBuffer.toString("base64")}`;

  return {
    format: "webp",
    width: targetWidth,
    height: targetHeight,
    aspectRatio: "3:4",
    buffer: outputBuffer,
    base64,
    originalWidth,
    originalHeight,
    wasRotated: (metadata.orientation || 0) > 1,
    wasLandscape: isLandscape,
  };
}

/**
 * Extracts the dominant color from a logo image buffer using sharp stats
 */
export async function extractDominantColor(input: Buffer | Uint8Array): Promise<DominantColorResult> {
  const inputBuffer = Buffer.isBuffer(input) ? input : Buffer.from(input);

  // Resize to small thumbnail for fast color analysis
  const { dominant } = await sharp(inputBuffer)
    .resize(100, 100, { fit: "inside" })
    .stats();

  const r = Math.round(dominant.r);
  const g = Math.round(dominant.g);
  const b = Math.round(dominant.b);

  const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`.toUpperCase();

  return {
    hex,
    rgb: { r, g, b },
  };
}
