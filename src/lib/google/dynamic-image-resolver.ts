// ==============================================================================
// NTL CRICKET AUCTION PLATFORM - DYNAMIC GOOGLE DRIVE IMAGE RESOLVER
// Zero-hardcoded resolution of photo links and Drive filenames to CDN URLs
// ==============================================================================

import https from "https";
import { google } from "googleapis";

export interface DriveItem {
  id: string;
  name: string;
  mimeType?: string;
  directUrl: string;
}

export interface FolderListResult {
  folderId: string;
  status: "AUTHENTICATED" | "PUBLIC_ACCESSIBLE" | "RESTRICTED" | "EMPTY" | "ERROR";
  files: DriveItem[];
  totalFiles: number;
  message?: string;
}

/**
 * Extracts clean Google Drive folder ID from full URL or raw ID
 */
export function extractFolderId(urlOrId: string | null | undefined): string {
  if (!urlOrId) return "";
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/folders\/([a-zA-Z0-9_-]{20,60})/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{20,60}$/.test(trimmed)) return trimmed;
  return "";
}

/**
 * Normalizes a filename by removing extension, spaces, and punctuation for fuzzy matching
 */
export function normalizeFilenameStem(filename: string): string {
  return (filename || "")
    .toLowerCase()
    .replace(/\.(jpeg|jpg|png|webp|heic|bmp|tiff)$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Scrapes public Google Drive folder HTML for embedded file IDs and names
 */
async function scrapePublicDriveFolder(folderId: string): Promise<DriveItem[]> {
  const url = `https://drive.google.com/drive/folders/${folderId}`;

  return new Promise((resolve) => {
    https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          const filesMap = new Map<string, DriveItem>();

          // Match patterns where file name and its ID appear in Google Drive HTML
          // e.g., ["33_char_id",["33_char_id"],..."filename.ext"...]
          const extensionPattern = /([a-zA-Z0-9_\-\s()]{2,60}\.(?:jpe?g|png|webp|heic))/gi;
          const matches = body.match(extensionPattern) || [];

          for (const rawFilename of matches) {
            const cleanName = rawFilename.trim();
            if (cleanName.length < 4 || filesMap.has(cleanName)) continue;

            const idx = body.indexOf(cleanName);
            if (idx === -1) continue;

            // Search surrounding 500 characters for a 33-char Google Drive file ID
            const start = Math.max(0, idx - 450);
            const end = Math.min(body.length, idx + 450);
            const snippet = body.substring(start, end);

            const idMatches = snippet.match(/[a-zA-Z0-9_-]{33}/g) || [];
            const validId = idMatches.find(
              (id) => !id.includes("http") && !id.includes("drive") && !id.includes("google")
            );

            if (validId) {
              filesMap.set(cleanName, {
                id: validId,
                name: cleanName,
                directUrl: `https://lh3.googleusercontent.com/d/${validId}`,
              });
            }
          }

          resolve(Array.from(filesMap.values()));
        });
      }
    ).on("error", () => resolve([]));
  });
}

/**
 * Lists files residing in a Google Drive folder using either official API or public access
 */
export async function listDriveFolderAssets(folderUrlOrId: string): Promise<FolderListResult> {
  const folderId = extractFolderId(folderUrlOrId);

  if (!folderId) {
    return {
      folderId: "",
      status: "ERROR",
      files: [],
      totalFiles: 0,
      message: "Invalid or missing Google Drive folder ID/URL.",
    };
  }

  // 1. Try official Drive API v3 if service account credentials exist
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (clientEmail && privateKey && !clientEmail.includes("your-project")) {
    try {
      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: [
          "https://www.googleapis.com/auth/drive.readonly",
          "https://www.googleapis.com/auth/drive.metadata.readonly",
        ],
      });
      const drive = google.drive({ version: "v3", auth });

      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
        fields: "files(id, name, mimeType)",
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const items = response.data.files || [];
      const files: DriveItem[] = items.map((f) => ({
        id: f.id || "",
        name: f.name || "",
        mimeType: f.mimeType || "image/jpeg",
        directUrl: `https://lh3.googleusercontent.com/d/${f.id}`,
      }));

      return {
        folderId,
        status: files.length > 0 ? "AUTHENTICATED" : "EMPTY",
        files,
        totalFiles: files.length,
        message: `Successfully indexed ${files.length} images via Google Drive API v3.`,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Drive API error";
      // Fall through to public scraping if API call failed
      console.warn(`[DriveResolver] Official Drive API failed (${errMsg}), testing public access.`);
    }
  }

  // 2. Fallback: Parse publicly accessible Drive folder web page
  try {
    const scrapedFiles = await scrapePublicDriveFolder(folderId);
    if (scrapedFiles.length > 0) {
      return {
        folderId,
        status: "PUBLIC_ACCESSIBLE",
        files: scrapedFiles,
        totalFiles: scrapedFiles.length,
        message: `Publicly indexed ${scrapedFiles.length} images from Google Drive folder.`,
      };
    }
  } catch {}

  // 3. Unreachable or restricted
  return {
    folderId,
    status: "RESTRICTED",
    files: [],
    totalFiles: 0,
    message: "Google Drive folder is restricted. Ensure it is shared as 'Anyone with the link can view' or configure service account credentials.",
  };
}

/**
 * Dynamically resolves a photo reference (direct URL, drive link, or filename)
 * against available Google Drive files.
 */
export function resolveDynamicPhotoUrl(
  photoRef: string | null | undefined,
  driveFiles: DriveItem[] = []
): { resolvedUrl: string; isMatched: boolean; matchedDriveFileId?: string } {
  const fallback = "/mock/default-player.png";

  if (!photoRef || !photoRef.trim()) {
    return { resolvedUrl: fallback, isMatched: false };
  }

  const cleanRef = photoRef.trim();

  // Case 1: Direct Google Drive Share URL
  const driveFileMatch = cleanRef.match(/(?:file\/d\/|open\?id=|id=)([a-zA-Z0-9_-]{25,50})/);
  if (driveFileMatch && driveFileMatch[1]) {
    const fileId = driveFileMatch[1];
    return {
      resolvedUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
      isMatched: true,
      matchedDriveFileId: fileId,
    };
  }

  // Case 2: Direct HTTP/HTTPS Web Image URL
  if (cleanRef.startsWith("http://") || cleanRef.startsWith("https://")) {
    return { resolvedUrl: cleanRef, isMatched: true };
  }

  // Case 3: Filename matching against Drive folder assets
  const refStem = normalizeFilenameStem(cleanRef);

  if (refStem && driveFiles.length > 0) {
    // 3a. Exact stem match
    const exactMatch = driveFiles.find((f) => normalizeFilenameStem(f.name) === refStem);
    if (exactMatch) {
      return {
        resolvedUrl: exactMatch.directUrl,
        isMatched: true,
        matchedDriveFileId: exactMatch.id,
      };
    }

    // 3b. Partial/stem containment match (e.g. "1000147764 - Ashwin Pai.jpeg" contains "ashwin pai")
    const partialMatch = driveFiles.find((f) => {
      const fStem = normalizeFilenameStem(f.name);
      return fStem.includes(refStem) || refStem.includes(fStem);
    });
    if (partialMatch) {
      return {
        resolvedUrl: partialMatch.directUrl,
        isMatched: true,
        matchedDriveFileId: partialMatch.id,
      };
    }
  }

  // Unmatched filename
  return { resolvedUrl: fallback, isMatched: false };
}
