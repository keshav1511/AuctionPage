// ==============================================================================
// NALANDA TURF LEAGUE SEASON 1 — APPS SCRIPT PERSISTENCE CLIENT
// Server-side HTTP client connecting Next.js API routes to Google Apps Script Web App
// Enables 100% Google Sheets persistence with ZERO Google Cloud Service Accounts
// ==============================================================================

export interface AppsScriptResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  version?: number;
  updatedAt?: string;
}

export function isAppsScriptConfigured(): boolean {
  const url = process.env.APPS_SCRIPT_WEB_APP_URL;
  const secret = process.env.APPS_SCRIPT_SHARED_SECRET;
  if (!url || !secret) return false;
  if (url.includes("your-script-id") || url.includes("example.com")) return false;
  if (secret.trim().length === 0 || secret === "ntl_season_1_secret_key_2026") return false;
  return url.startsWith("https://script.google.com/macros/s/");
}

export async function callAppsScript<T = unknown>(
  action: string,
  data?: unknown
): Promise<T> {
  const url = process.env.APPS_SCRIPT_WEB_APP_URL;
  const secret = process.env.APPS_SCRIPT_SHARED_SECRET;

  if (!url || !secret || !isAppsScriptConfigured()) {
    throw new Error(
      "[AppsScriptClient] Both APPS_SCRIPT_WEB_APP_URL and a strong APPS_SCRIPT_SHARED_SECRET must be configured in environment variables. Default or blank secrets are rejected."
    );
  }

  const payload = {
    action,
    secret,
    data,
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      redirect: "follow",
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown network error");
      throw new Error(`Apps Script responded with HTTP ${res.status}: ${errText}`);
    }

    const json = (await res.json()) as AppsScriptResponse<T>;
    if (!json.success) {
      throw new Error(json.error || `Apps Script action "${action}" failed without specific error`);
    }

    return (json.data !== undefined ? json.data : (json as unknown)) as T;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[AppsScriptClient] Error executing action "${action}":`, errMsg);
    throw error;
  }
}
