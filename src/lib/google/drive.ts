/**
 * Helper to convert various Google Drive share URLs to direct high-res image CDN URLs
 */
export function resolveGoogleDriveImageUrl(urlOrId: string): string {
  if (!urlOrId) return "/mock/default-player.png";

  // If already a standard direct URL or placeholder
  if (urlOrId.startsWith("http") && !urlOrId.includes("drive.google.com")) {
    return urlOrId;
  }

  // Extract Google Drive File ID using regex
  const fileIdMatch = urlOrId.match(
    /(?:https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)|id=)([a-zA-Z0-9_-]+)/
  );

  const fileId = fileIdMatch ? fileIdMatch[1] : urlOrId;

  // Convert to Google Usercontent CDN Direct Preview URL
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}
