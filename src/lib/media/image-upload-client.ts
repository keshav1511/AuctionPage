// ==============================================================================
// CLIENT-SIDE IMAGE VALIDATION, COMPRESSION & SAFE UPLOAD UTILITY
// Guarantees reliable Google Drive uploads via Apps Script without 413 errors
// ==============================================================================

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  file?: File;
}

export interface UploadImageResult {
  success: boolean;
  url: string;
  fileId: string;
  fileName: string;
  error?: string;
}

const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const MAX_RAW_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB max raw input

/**
 * Validates file format and reasonable size boundaries before processing
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (!file) {
    return { valid: false, error: "No image file provided." };
  }

  if (file.size === 0) {
    return { valid: false, error: "The selected file is empty (0 bytes)." };
  }

  if (file.size > MAX_RAW_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Image file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size before compression is 25MB.`,
    };
  }

  const mime = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const hasSupportedExt =
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp");

  if (!SUPPORTED_MIME_TYPES.includes(mime) && !hasSupportedExt) {
    return {
      valid: false,
      error: "Unsupported file format. Please upload a JPG, JPEG, PNG, or WebP photograph.",
    };
  }

  return { valid: true, file };
}

/**
 * Compresses and resizes high-resolution camera/phone photos in the browser
 * Reduces multi-megabyte photos down to ~100KB-300KB while preserving clarity.
 */
export async function compressImageInBrowser(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {}
): Promise<File> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.85 } = options;

  // If running in non-browser environment or image is already under 250KB and a standard format, pass through
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  if (file.size <= 250 * 1024 && (file.type === "image/jpeg" || file.type === "image/webp")) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(file); // Safe fallback to original on reader failure
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => resolve(file); // Safe fallback to original on image decode failure
      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale down if dimensions exceed bounds
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }

          // Use high quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          // Use WebP if supported, otherwise JPEG
          const outputMime = file.type === "image/png" ? "image/jpeg" : file.type || "image/jpeg";
          canvas.toBlob(
            (blob) => {
              if (!blob || blob.size >= file.size) {
                // If compression didn't reduce size, keep original
                resolve(file);
                return;
              }

              const cleanBaseName = file.name.replace(/\.[^/.]+$/, "");
              const ext = outputMime === "image/jpeg" ? ".jpg" : ".webp";
              const compressedFile = new File([blob], `${cleanBaseName}${ext}`, {
                type: outputMime,
                lastModified: Date.now(),
              });

              resolve(compressedFile);
            },
            outputMime,
            quality
          );
        } catch {
          resolve(file);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Safely executes the image upload flow:
 * 1. Validates file
 * 2. Compresses in browser
 * 3. Sends to /api/media/upload
 * 4. Safely parses response without blind response.json()
 * 5. Returns friendly errors on 413, HTML, or server failures
 */
export async function uploadImageSafely(
  file: File,
  folder: "players" | "teams" | "league" = "players"
): Promise<UploadImageResult> {
  // 1. Validation
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid image file");
  }

  // 2. Browser Compression
  let fileToUpload = file;
  try {
    fileToUpload = await compressImageInBrowser(file, {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 0.85,
    });
  } catch (compErr) {
    console.warn("[ImageUploadClient] Browser compression skipped, using original file:", compErr);
  }

  // 3. Build multipart form data
  const formData = new FormData();
  formData.append("file", fileToUpload);
  formData.append("folder", folder);
  formData.append("folderId", "");

  // 4. Send request
  let res: Response;
  try {
    res = await fetch("/api/media/upload", {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      "Network connection failure. Please check your internet connection and try uploading again."
    );
  }

  // 5. Read response text safely
  const responseText = await res.text().catch(() => "");
  const contentType = res.headers.get("content-type") || "";

  // 6. Handle HTTP 413 Request Entity Too Large
  if (
    res.status === 413 ||
    responseText.toLowerCase().includes("request entity too large") ||
    responseText.startsWith("Request En")
  ) {
    throw new Error(
      "Image upload failed: The image file is too large for serverless upload. Please try again with a smaller image."
    );
  }

  // 7. Handle non-JSON responses (e.g. plain text or HTML error pages from Vercel / Google)
  if (!contentType.includes("application/json")) {
    let cleanSnippet = responseText.replace(/<[^>]*>?/gm, " ").trim().substring(0, 150);
    if (!cleanSnippet) cleanSnippet = `HTTP ${res.status} ${res.statusText}`;
    throw new Error(
      `Image upload failed (Server returned HTTP ${res.status}): ${cleanSnippet}`
    );
  }

  // 8. Parse JSON response
  let data: { success?: boolean; url?: string; fileId?: string; fileName?: string; error?: string };
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Image upload failed: Server returned an invalid response (HTTP ${res.status}).`
    );
  }

  if (!res.ok || !data.success) {
    const errorMsg = data?.error || `Upload failed with HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  if (!data.url) {
    throw new Error("Google Drive did not return an image URL. Please try uploading again.");
  }

  return {
    success: true,
    url: data.url,
    fileId: data.fileId || "",
    fileName: data.fileName || fileToUpload.name,
  };
}
