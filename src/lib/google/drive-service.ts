import { drive_v3 } from "googleapis";
import { listDriveFolderAssets, extractFolderId } from "./dynamic-image-resolver";

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  webContentLink?: string;
  directUrl?: string;
}

export interface DriveSyncResult {
  status: "configured_and_verified" | "awaiting_credentials";
  message: string;
  folderId: string;
  totalFiles: number;
  files: DriveFileMetadata[];
}

export class GoogleDriveService {
  private drive: drive_v3.Drive | null = null;
  private isLiveConfigured: boolean = false;

  constructor() {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    this.isLiveConfigured = Boolean(
      clientEmail && privateKey && !clientEmail.includes("your-project")
    );
  }

  /**
   * Parses Google Drive folder ID from full URL or returns raw ID
   */
  public static extractFolderId(urlOrId: string): string {
    return extractFolderId(urlOrId);
  }

  public isConfigured(): boolean {
    return this.isLiveConfigured;
  }

  /**
   * Retrieves files from the configured folder using dynamic image resolver
   * (official API or public folder indexer with zero hardcoded snapshots)
   */
  public async listFolderFiles(
    folderId: string,
    _pageToken?: string
  ): Promise<DriveSyncResult> {
    const cleanFolderId = GoogleDriveService.extractFolderId(folderId);

    if (!cleanFolderId) {
      return {
        status: "awaiting_credentials",
        message: "Invalid or missing Google Drive folder ID/URL.",
        folderId: "",
        totalFiles: 0,
        files: [],
      };
    }

    const result = await listDriveFolderAssets(cleanFolderId);

    const mappedFiles: DriveFileMetadata[] = result.files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType || "image/jpeg",
      directUrl: f.directUrl,
    }));

    const isSuccess = result.status === "AUTHENTICATED" || result.status === "PUBLIC_ACCESSIBLE";

    return {
      status: isSuccess ? "configured_and_verified" : "awaiting_credentials",
      message: result.message || (isSuccess ? "Drive assets synchronized" : "Drive folder unavailable"),
      folderId: cleanFolderId,
      totalFiles: mappedFiles.length,
      files: mappedFiles,
    };
  }

  /**
   * Downloads authorized image content as Buffer using official Google Drive API
   */
  public async downloadFileBuffer(fileId: string): Promise<Buffer | null> {
    if (!this.drive || !this.isLiveConfigured) {
      return null;
    }

    try {
      const response = await this.drive.files.get(
        { fileId, alt: "media" },
        { responseType: "arraybuffer" }
      );
      return Buffer.from(response.data as ArrayBuffer);
    } catch {
      return null;
    }
  }
}
