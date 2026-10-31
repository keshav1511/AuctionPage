// ==============================================================================
// NTL AUCTION PLATFORM - WORKBOOK SETUP & MANAGER
// Automates creation, header population, and schema initialization for Google Sheets
// ==============================================================================

import { sheets_v4 } from "googleapis";
import { getGoogleSheetsClient } from "./google-sheets-client";
import {
  ALL_SHEET_TABS,
  TAB_LEAGUE_CONFIG,
  TAB_TEAMS,
  TAB_PLAYERS,
  TAB_AUCTION_STATE,
  TAB_BID_HISTORY,
  TAB_PURCHASES,
  TAB_AUDIT_LOG,
  LEAGUE_CONFIG_HEADERS,
  TEAMS_HEADERS,
  PLAYERS_HEADERS,
  AUCTION_STATE_HEADERS,
  BID_HISTORY_HEADERS,
  PURCHASES_HEADERS,
  AUDIT_LOG_HEADERS,
  serializeLeagueConfig,
  serializeAuctionState,
  serializeTeam,
  serializePlayer,
} from "./tab-definitions";
import { League, Team, Player, AuctionRules } from "@/types";

export interface WorkbookInitResult {
  success: boolean;
  spreadsheetId: string;
  tabsCreated: string[];
  tabsExisting: string[];
  message: string;
}

/**
 * Ensures all 7 required tabs exist with standardized headers and initial rows
 */
export async function initializeLeagueWorkbook(
  spreadsheetId: string,
  initialData?: {
    league?: League;
    rules?: AuctionRules;
    teams?: Team[];
    players?: Player[];
  }
): Promise<WorkbookInitResult> {
  const sheets = getGoogleSheetsClient();
  if (!sheets) {
    return {
      success: false,
      spreadsheetId,
      tabsCreated: [],
      tabsExisting: [],
      message: "Google Sheets API client is not configured. Check environment variables.",
    };
  }

  try {
    // 1. Fetch current workbook metadata
    const metaResponse = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const existingSheets = metaResponse.data.sheets || [];
    const existingTitles = new Set(
      existingSheets.map((s) => s.properties?.title).filter((t): t is string => Boolean(t))
    );

    const tabsToCreate: string[] = [];
    ALL_SHEET_TABS.forEach((tab) => {
      if (!existingTitles.has(tab)) {
        tabsToCreate.push(tab);
      }
    });

    // 2. Create missing tabs in batch
    if (tabsToCreate.length > 0) {
      const requests: sheets_v4.Schema$Request[] = tabsToCreate.map((title) => ({
        addSheet: {
          properties: {
            title,
            gridProperties: {
              frozenRowCount: 1, // Freeze header row for readability
            },
          },
        },
      }));

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests,
        },
      });
    }

    // 3. Populate headers and initial state for each tab if blank
    const headerUpdates: sheets_v4.Schema$ValueRange[] = [];

    // Helper to check and append header update
    const ensureHeaders = async (tabName: string, headers: string[], initialRows?: string[][]) => {
      const rangeCheck = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${tabName}!A1:Z2`,
      });

      const currentValues = rangeCheck.data.values || [];
      if (currentValues.length === 0) {
        // Tab is completely empty, write headers + optional initial rows
        const valuesToWrite: string[][] = [headers];
        if (initialRows && initialRows.length > 0) {
          valuesToWrite.push(...initialRows);
        }
        headerUpdates.push({
          range: `${tabName}!A1`,
          values: valuesToWrite,
        });
      }
    };

    // League_Config initial row
    let initialLeagueRows: string[][] | undefined;
    if (initialData?.league) {
      initialLeagueRows = [serializeLeagueConfig(initialData.league, initialData.rules)];
    }

    // Auction_State initial row
    const initialAuctionRows: string[][] = [
      serializeAuctionState({
        id: `auction-${initialData?.league?.id || "league-ntl"}`,
        seasonId: initialData?.league?.id || "league-ntl",
        status: "IDLE",
        currentPlayerId: initialData?.players?.[0]?.id || null,
        currentHighestBid: 0,
        currentLeadingTeamId: null,
        timerSeconds: initialData?.rules?.initialTimerSeconds || 45,
        timerExpiresAt: new Date(Date.now() + 45000).toISOString(),
        round: 1,
        bidCount: 0,
        bidExtensionSeconds: initialData?.rules?.bidExtensionSeconds || 10,
        version: 1,
      }),
    ];

    // Teams initial rows
    let initialTeamRows: string[][] | undefined;
    if (initialData?.teams && initialData.teams.length > 0) {
      initialTeamRows = initialData.teams.map(serializeTeam);
    }

    // Players initial rows
    let initialPlayerRows: string[][] | undefined;
    if (initialData?.players && initialData.players.length > 0) {
      initialPlayerRows = initialData.players.map(serializePlayer);
    }

    await ensureHeaders(TAB_LEAGUE_CONFIG, LEAGUE_CONFIG_HEADERS, initialLeagueRows);
    await ensureHeaders(TAB_TEAMS, TEAMS_HEADERS, initialTeamRows);
    await ensureHeaders(TAB_PLAYERS, PLAYERS_HEADERS, initialPlayerRows);
    await ensureHeaders(TAB_AUCTION_STATE, AUCTION_STATE_HEADERS, initialAuctionRows);
    await ensureHeaders(TAB_BID_HISTORY, BID_HISTORY_HEADERS);
    await ensureHeaders(TAB_PURCHASES, PURCHASES_HEADERS);
    await ensureHeaders(TAB_AUDIT_LOG, AUDIT_LOG_HEADERS);

    if (headerUpdates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: headerUpdates,
        },
      });
    }

    return {
      success: true,
      spreadsheetId,
      tabsCreated: tabsToCreate,
      tabsExisting: Array.from(existingTitles),
      message: `Successfully verified and initialized ${ALL_SHEET_TABS.length} tabs in workbook.`,
    };
  } catch (error) {
    console.error("Error initializing Google Sheets workbook:", error);
    return {
      success: false,
      spreadsheetId,
      tabsCreated: [],
      tabsExisting: [],
      message: (error as Error).message || "Unknown error initializing workbook tabs.",
    };
  }
}

/**
 * Checks which of the required tabs exist in the specified workbook
 */
export async function verifyWorkbookTabs(spreadsheetId: string): Promise<{
  configured: boolean;
  allPresent: boolean;
  missingTabs: string[];
  existingTabs: string[];
}> {
  const sheets = getGoogleSheetsClient();
  if (!sheets) {
    return {
      configured: false,
      allPresent: false,
      missingTabs: [...ALL_SHEET_TABS],
      existingTabs: [],
    };
  }

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existing = (meta.data.sheets || [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t));

    const existingSet = new Set(existing);
    const missing = ALL_SHEET_TABS.filter((tab) => !existingSet.has(tab));

    return {
      configured: true,
      allPresent: missing.length === 0,
      missingTabs: missing,
      existingTabs: existing,
    };
  } catch {
    return {
      configured: true,
      allPresent: false,
      missingTabs: [...ALL_SHEET_TABS],
      existingTabs: [],
    };
  }
}
