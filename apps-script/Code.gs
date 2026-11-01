// ==============================================================================
// BLANK, ADMIN-CONFIGURABLE CRICKET AUCTION PLATFORM — APPS SCRIPT PERSISTENCE BRIDGE
// Google Apps Script Web App providing zero-GCP-cost persistence & Drive image storage.
// Features: LockService serialization, DriveApp image uploads, and dynamic configuration.
// ==============================================================================

/**
 * Returns the configured shared secret from Script Properties.
 * MUST be set in Project Settings -> Script Properties -> APPS_SCRIPT_SHARED_SECRET
 */
function getSharedSecret() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const secret = scriptProperties.getProperty("APPS_SCRIPT_SHARED_SECRET");
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }
  return null;
}

/**
 * Standard JSON response helper with CORS headers
 */
function jsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Health check & read-only status endpoint.
 * Never leaks the shared secret or internal spreadsheet ID to unauthenticated callers.
 */
function doGet(e) {
  return jsonResponse({
    status: "ok",
    service: "Cricket-Auction-Persistence-Bridge",
    version: "2.0.0",
    timestamp: new Date().toISOString()
  });
}

/**
 * Primary transactional router for all mutating actions.
 * Enforces mandatory secret authentication.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: "Missing POST body" }, 400);
    }

    const payload = JSON.parse(e.postData.contents);
    const { secret, action, data } = payload;

    // Verify Shared Secret (MANDATORY)
    const expectedSecret = getSharedSecret();
    if (!expectedSecret) {
      return jsonResponse({
        success: false,
        error: "Configuration Error: APPS_SCRIPT_SHARED_SECRET is not configured in Script Properties. Configure it in Project Settings -> Script Properties."
      }, 500);
    }

    if (!secret || typeof secret !== "string" || secret.trim() !== expectedSecret.trim()) {
      return jsonResponse({ success: false, error: "Unauthorized: Invalid or missing shared secret" }, 401);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    switch (action) {
      case "PING":
        return jsonResponse({ success: true, message: "Pong from Auction Apps Script Bridge", spreadsheetId: ss.getId() });

      case "INIT_WORKBOOK":
        return handleInitWorkbook(ss, data);

      case "GET_ALL_DATA":
        return handleGetAllData(ss);

      case "GET_AUCTION_STATE":
        return handleGetAuctionState(ss);

      case "SAVE_AUCTION_STATE":
        return handleSaveAuctionState(ss, data);

      case "SAVE_LEAGUE_CONFIG":
        return handleSaveLeagueConfig(ss, data);

      case "SAVE_TEAMS":
        return handleSaveTeams(ss, data);

      case "SAVE_PLAYERS":
        return handleSavePlayers(ss, data);

      case "UPLOAD_IMAGE":
        return handleUploadImage(ss, data);

      case "PLACE_BID":
        return handlePlaceBid(ss, data);

      case "HAMMER_SOLD":
        return handleHammerSold(ss, data);

      case "HAMMER_UNSOLD":
        return handleHammerUnsold(ss, data);

      case "UNDO_ACTION":
        return handleUndoAction(ss, data);

      case "RESET_AUCTION":
        return handleResetAuction(ss, data);

      case "RESET_WORKBOOK":
        return handleResetWorkbook(ss, data);

      default:
        return jsonResponse({ success: false, error: "Unknown action: " + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString(), stack: err.stack }, 500);
  }
}

// ------------------------------------------------------------------------------
// TAB HEADERS & SCHEMAS
// ------------------------------------------------------------------------------
const TABS = {
  LEAGUE_CONFIG: "League_Config",
  TEAMS: "Teams",
  PLAYERS: "Players",
  AUCTION_STATE: "Auction_State",
  BID_HISTORY: "Bid_History",
  PURCHASES: "Purchases",
  AUDIT_LOG: "Audit_Log",
};

function ensureSheet(ss, tabName, headers) {
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

// ------------------------------------------------------------------------------
// 1. INIT_WORKBOOK — PROVISION BLANK TABS WITH SCHEMAS (NO HARDCODED SEEDING)
// ------------------------------------------------------------------------------
function handleInitWorkbook(ss, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    ensureSheet(ss, TABS.LEAGUE_CONFIG, [
      "id", "slug", "name", "description", "logoUrl", "matchDate", "matchVenue",
      "auctionDate", "auctionTime", "timezone", "googleSheetsUrl", "googleDriveFolderUrl",
      "primaryColor", "secondaryColor", "brandingPaletteJson", "auctionRulesJson", "updatedAt"
    ]);

    ensureSheet(ss, TABS.TEAMS, [
      "id", "seasonId", "name", "shortCode", "logoUrl", "primaryColor", "secondaryColor",
      "ownerName", "ownerPhotoUrl", "iconPlayerName", "iconPlayerPhotoUrl",
      "totalPurse", "remainingPurse", "spentPurse", "minPlayers", "maxPlayers", "reservedPurse",
      "squadCount", "isCompleted", "updatedAt"
    ]);

    ensureSheet(ss, TABS.PLAYERS, [
      "id", "seasonId", "name", "category", "primaryRole", "battingStyle", "bowlingStyle",
      "photoUrl", "basePrice", "status", "teamId", "soldPrice", "soldTime",
      "isIcon", "sortOrder", "updatedAt"
    ]);

    const stateSheet = ensureSheet(ss, TABS.AUCTION_STATE, [
      "id", "seasonId", "status", "currentPlayerId", "currentHighestBid", "currentLeadingTeamId",
      "timerSeconds", "timerExpiresAt", "round", "roundStage", "round2QueueJson", "round1Completed",
      "bidCount", "bidExtensionSeconds", "version", "updatedAt", "lastActionType", "lastActionPayloadJson",
      "consecutiveBidsJson", "pausedRemainingSeconds", "announcementJson"
    ]);

    ensureSheet(ss, TABS.BID_HISTORY, [
      "id", "seasonId", "playerId", "teamId", "amount", "bidTime", "round", "isWinning"
    ]);

    ensureSheet(ss, TABS.PURCHASES, [
      "id", "seasonId", "teamId", "playerId", "amount", "round", "timestamp"
    ]);

    ensureSheet(ss, TABS.AUDIT_LOG, [
      "id", "seasonId", "action", "details", "actor", "timestamp"
    ]);

    // Initialize clean state row if empty
    if (stateSheet.getLastRow() <= 1) {
      stateSheet.getRange(2, 1, 1, 21).setValues([[
        "auction-main", "league-main", "IDLE", "", 0, "", 45, "", 1,
        "MAIN", "[]", "FALSE", 0, 10, 1, new Date().toISOString(),
        "", "{}", "{}", "", ""
      ]]);
    }

    return jsonResponse({ success: true, message: "Workbook initialized with empty schemas." });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------------
// 2. GET_ALL_DATA — ATOMIC READ OF ALL TABS
// ------------------------------------------------------------------------------
function handleGetAllData(ss) {
  const configSheet = ss.getSheetByName(TABS.LEAGUE_CONFIG);
  const teamsSheet = ss.getSheetByName(TABS.TEAMS);
  const playersSheet = ss.getSheetByName(TABS.PLAYERS);
  const stateSheet = ss.getSheetByName(TABS.AUCTION_STATE);
  const bidsSheet = ss.getSheetByName(TABS.BID_HISTORY);
  const purchasesSheet = ss.getSheetByName(TABS.PURCHASES);

  let config = null;
  if (configSheet && configSheet.getLastRow() >= 2) {
    const r = configSheet.getRange(2, 1, 1, 17).getValues()[0];
    let brandingPalette = undefined;
    let rules = undefined;
    try { if (r[14]) brandingPalette = JSON.parse(r[14]); } catch {}
    try { if (r[15]) rules = JSON.parse(r[15]); } catch {}

    config = {
      league: {
        id: r[0] || "league-main",
        slug: r[1] || "cricket-auction",
        name: r[2] || "Cricket Auction",
        description: r[3] || "",
        logoUrl: r[4] || "",
        matchDate: r[5] || "",
        matchVenue: r[6] || "",
        auctionDate: r[7] || "",
        auctionTime: r[8] || "",
        timezone: r[9] || "Asia/Kolkata",
        googleSheetsUrl: r[10] || "",
        googleDriveFolderUrl: r[11] || "",
        primaryColor: r[12] || "#059669",
        secondaryColor: r[13] || "#F59E0B",
        brandingPalette,
      },
      rules: rules || {
        id: "rules-" + (r[0] || "league-main"),
        seasonId: r[0] || "league-main",
        totalPurse: 100000,
        basePrice: 2000,
        minBidIncrement: 500,
        initialTimerSeconds: 45,
        bidExtensionSeconds: 10,
        minimumSquadSize: 8,
        maximumSquadSize: 8,
      }
    };
  }

  let state = null;
  if (stateSheet && stateSheet.getLastRow() >= 2) {
    const row = stateSheet.getRange(2, 1, 1, 21).getValues()[0];
    state = {
      id: row[0],
      seasonId: row[1],
      status: row[2],
      currentPlayerId: row[3] || null,
      currentHighestBid: Number(row[4]) || 0,
      currentLeadingTeamId: row[5] || null,
      timerSeconds: Number(row[6]) || 45,
      timerExpiresAt: row[7] || null,
      round: Number(row[8]) || 1,
      roundStage: row[9] || "MAIN",
      round2QueueJson: row[10] || "[]",
      round1Completed: String(row[11]).toUpperCase() === "TRUE",
      bidCount: Number(row[12]) || 0,
      bidExtensionSeconds: Number(row[13]) || 10,
      version: Number(row[14]) || 1,
      updatedAt: row[15] || new Date().toISOString(),
      lastActionType: row[16] || undefined,
      lastActionPayloadJson: row[17] || undefined,
      consecutiveBidsJson: row[18] || undefined,
      pausedRemainingSeconds: row[19] ? Number(row[19]) : undefined,
      announcementJson: row[20] || undefined,
    };
  }

  let teams = [];
  if (teamsSheet && teamsSheet.getLastRow() >= 2) {
    const rows = teamsSheet.getRange(2, 1, teamsSheet.getLastRow() - 1, 20).getValues();
    teams = rows.map(r => ({
      id: r[0],
      seasonId: r[1],
      name: r[2],
      shortCode: r[3],
      logoUrl: r[4] || "",
      primaryColor: r[5] || "#059669",
      secondaryColor: r[6] || "#F59E0B",
      ownerName: r[7] || "",
      ownerPhotoUrl: r[8] || "",
      iconPlayerName: r[9] || "",
      iconPlayerPhotoUrl: r[10] || "",
      purse: {
        totalBudget: Number(r[11]) || 100000,
        totalPurse: Number(r[11]) || 100000,
        remainingAmount: Number(r[12]) || 100000,
        spentAmount: Number(r[13]) || 0,
        minPlayers: Number(r[14]) || 8,
        maxPlayers: Number(r[15]) || 8,
        reservedForSquad: Number(r[16]) || 12000,
        reservedPurse: Number(r[16]) || 12000,
      },
      squadCount: Number(r[17]) || 0,
      isCompleted: String(r[18]).toUpperCase() === "TRUE",
      completionStatus: String(r[18]).toUpperCase() === "TRUE" ? "COMPLETED" : "INCOMPLETE",
    }));
  }

  let players = [];
  if (playersSheet && playersSheet.getLastRow() >= 2) {
    const rows = playersSheet.getRange(2, 1, playersSheet.getLastRow() - 1, 16).getValues();
    players = rows.map(r => ({
      id: r[0],
      seasonId: r[1],
      name: r[2],
      fullName: r[2],
      registrationNo: r[0],
      category: r[3] || "SILVER",
      primaryRole: r[4] || "ALL_ROUNDER",
      battingStyle: r[5] || "Right-Hand Bat",
      bowlingStyle: r[6] || "Right-Arm Medium",
      photoUrl: r[7] || "",
      basePrice: Number(r[8]) || 2000,
      status: r[9] || "AVAILABLE",
      teamId: r[10] || undefined,
      soldToTeamId: r[10] || undefined,
      soldPrice: r[11] ? Number(r[11]) : undefined,
      soldTime: r[12] || undefined,
      isIcon: String(r[13]).toUpperCase() === "TRUE",
      sortOrder: Number(r[14]) || 1,
    }));
  }

  let recentBids = [];
  if (bidsSheet && bidsSheet.getLastRow() >= 2) {
    const numRows = Math.min(bidsSheet.getLastRow() - 1, 30);
    const startRow = bidsSheet.getLastRow() - numRows + 1;
    const rows = bidsSheet.getRange(startRow, 1, numRows, 8).getValues();
    recentBids = rows.map(r => ({
      id: r[0],
      seasonId: r[1],
      playerId: r[2],
      teamId: r[3],
      amount: Number(r[4]),
      bidTime: r[5],
      round: Number(r[6]),
      isWinning: String(r[7]).toUpperCase() === "TRUE",
    })).reverse();
  }

  return jsonResponse({
    success: true,
    data: {
      config,
      state,
      teams,
      players,
      recentBids,
      timestamp: new Date().toISOString(),
    }
  });
}

// ------------------------------------------------------------------------------
// 3. SAVE_LEAGUE_CONFIG — PERSIST LEAGUE & AUCTION RULES
// ------------------------------------------------------------------------------
function handleSaveLeagueConfig(ss, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = ensureSheet(ss, TABS.LEAGUE_CONFIG, [
      "id", "slug", "name", "description", "logoUrl", "matchDate", "matchVenue",
      "auctionDate", "auctionTime", "timezone", "googleSheetsUrl", "googleDriveFolderUrl",
      "primaryColor", "secondaryColor", "brandingPaletteJson", "auctionRulesJson", "updatedAt"
    ]);

    const league = data.league || {};
    const rules = data.rules || {};

    const row = [
      league.id || "league-main",
      league.slug || "cricket-auction",
      league.name || "Cricket Auction",
      league.description || "",
      league.logoUrl || "",
      league.matchDate || "",
      league.matchVenue || "",
      league.auctionDate || "",
      league.auctionTime || "",
      league.timezone || "Asia/Kolkata",
      league.googleSheetsUrl || "",
      league.googleDriveFolderUrl || "",
      league.primaryColor || "#059669",
      league.secondaryColor || "#F59E0B",
      league.brandingPalette ? JSON.stringify(league.brandingPalette) : "",
      JSON.stringify(rules),
      new Date().toISOString()
    ];

    sheet.getRange(2, 1, 1, 17).setValues([row]);
    return jsonResponse({ success: true, message: "League configuration saved successfully." });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------------
// 4. SAVE_TEAMS — REPLACES TEAMS TAB
// ------------------------------------------------------------------------------
function handleSaveTeams(ss, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = ensureSheet(ss, TABS.TEAMS, [
      "id", "seasonId", "name", "shortCode", "logoUrl", "primaryColor", "secondaryColor",
      "ownerName", "ownerPhotoUrl", "iconPlayerName", "iconPlayerPhotoUrl",
      "totalPurse", "remainingPurse", "spentPurse", "minPlayers", "maxPlayers", "reservedPurse",
      "squadCount", "isCompleted", "updatedAt"
    ]);

    // Clear existing data rows
    if (sheet.getLastRow() >= 2) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 20).clearContent();
    }

    const teams = data.teams || [];
    if (teams.length > 0) {
      const rows = teams.map(t => {
        const totalPurse = t.purse?.totalBudget ?? t.purse?.totalPurse ?? 100000;
        const remainingPurse = t.purse?.remainingAmount ?? totalPurse;
        const spentPurse = t.purse?.spentAmount ?? 0;
        const minPlayers = t.purse?.minPlayers ?? 8;
        const maxPlayers = t.purse?.maxPlayers ?? 8;
        const reservedPurse = t.purse?.reservedForSquad ?? t.purse?.reservedPurse ?? 0;

        return [
          t.id, t.seasonId || "league-main", t.name, t.shortCode || t.name.substring(0, 3).toUpperCase(),
          t.logoUrl || "", t.primaryColor || "#059669", t.secondaryColor || "#F59E0B",
          t.ownerName || "", t.ownerPhotoUrl || "", t.iconPlayerName || "", t.iconPlayerPhotoUrl || "",
          totalPurse, remainingPurse, spentPurse, minPlayers, maxPlayers, reservedPurse,
          t.squadCount || 0, t.isCompleted ? "TRUE" : "FALSE", new Date().toISOString()
        ];
      });

      sheet.getRange(2, 1, rows.length, 20).setValues(rows);
    }

    return jsonResponse({ success: true, message: "Teams updated successfully", count: teams.length });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------------
// 5. SAVE_PLAYERS — REPLACES PLAYERS TAB
// ------------------------------------------------------------------------------
function handleSavePlayers(ss, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = ensureSheet(ss, TABS.PLAYERS, [
      "id", "seasonId", "name", "category", "primaryRole", "battingStyle", "bowlingStyle",
      "photoUrl", "basePrice", "status", "teamId", "soldPrice", "soldTime",
      "isIcon", "sortOrder", "updatedAt"
    ]);

    // Clear existing data rows
    if (sheet.getLastRow() >= 2) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 16).clearContent();
    }

    const players = data.players || [];
    if (players.length > 0) {
      const rows = players.map((p, idx) => [
        p.id, p.seasonId || "league-main", p.fullName || p.name,
        p.category || "SILVER", p.primaryRole || "ALL_ROUNDER",
        p.battingStyle || "Right-Hand Bat", p.bowlingStyle || "Right-Arm Medium",
        p.photoUrl || "", Number(p.basePrice) || 2000, p.status || "AVAILABLE",
        p.soldToTeamId || p.teamId || "", p.soldPrice || "", p.soldTime || "",
        p.isIcon ? "TRUE" : "FALSE", p.sortOrder || (idx + 1), new Date().toISOString()
      ]);

      sheet.getRange(2, 1, rows.length, 16).setValues(rows);
    }

    return jsonResponse({ success: true, message: "Players updated successfully", count: players.length });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------------
// 6. UPLOAD_IMAGE — DRIVE STORAGE VIA NATIVE DRIVEAPP (ZERO GCP COSTS)
// ------------------------------------------------------------------------------
function handleUploadImage(ss, data) {
  try {
    const { base64Data, fileName, mimeType, folderId, subfolder } = data;
    if (!base64Data) {
      return jsonResponse({ success: false, error: "Missing base64Data" }, 400);
    }

    // Resolve Destination Drive Folder
    let folder = null;
    if (folderId && typeof folderId === "string" && folderId.trim().length > 5) {
      try {
        folder = DriveApp.getFolderById(folderId.trim());
      } catch (fErr) {
        // Fall back to sheet folder if invalid folderId passed
      }
    }

    if (!folder) {
      try {
        const sheetFile = DriveApp.getFileById(ss.getId());
        const parents = sheetFile.getParents();
        const parentFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
        const rootFolders = parentFolder.getFoldersByName("Auction_Images");
        const rootImgFolder = rootFolders.hasNext() ? rootFolders.next() : parentFolder.createFolder("Auction_Images");

        // Target subfolder if specified (e.g. players, teams, league)
        const subName = (subfolder && typeof subfolder === "string") ? subfolder.trim().toLowerCase() : "";
        if (subName === "players" || subName === "teams" || subName === "league") {
          const subQuery = rootImgFolder.getFoldersByName(subName);
          folder = subQuery.hasNext() ? subQuery.next() : rootImgFolder.createFolder(subName);
        } else {
          folder = rootImgFolder;
        }
      } catch (driveErr) {
        folder = DriveApp.getRootFolder();
      }
    }

    // Decode base64
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
    const decodedBytes = Utilities.base64Decode(cleanBase64);
    const safeName = (fileName || ("image_" + Date.now() + ".jpg")).replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeMime = mimeType || "image/jpeg";
    const blob = Utilities.newBlob(decodedBytes, safeMime, safeName);

    // Create file & set public read permissions
    const file = folder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch {}

    const fileId = file.getId();
    const directUrl = "https://lh3.googleusercontent.com/d/" + fileId;

    return jsonResponse({
      success: true,
      fileId: fileId,
      url: directUrl,
      fileName: safeName,
      size: file.getSize()
    });
  } catch (err) {
    return jsonResponse({ success: false, error: "Image upload failed: " + err.toString() }, 500);
  }
}

// ------------------------------------------------------------------------------
// 7. PLACE_BID
// ------------------------------------------------------------------------------
function handlePlaceBid(ss, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const { teamId, amount, playerId, bidTime } = data;
    const stateSheet = ss.getSheetByName(TABS.AUCTION_STATE);
    const bidsSheet = ss.getSheetByName(TABS.BID_HISTORY);

    if (!stateSheet || stateSheet.getLastRow() < 2) {
      return jsonResponse({ success: false, error: "Auction state not initialized" }, 400);
    }

    const stateRow = stateSheet.getRange(2, 1, 1, 21).getValues()[0];
    const currentStatus = stateRow[2];
    const currentHighestBid = Number(stateRow[4]) || 0;
    const currentPlayerId = stateRow[3];
    let version = Number(stateRow[14]) || 1;
    let bidCount = Number(stateRow[12]) || 0;

    if (currentStatus !== "IN_PROGRESS") {
      return jsonResponse({ success: false, error: "Auction is not in progress (Current: " + currentStatus + ")" }, 400);
    }
    if (playerId && currentPlayerId && playerId !== currentPlayerId) {
      return jsonResponse({ success: false, error: "Lot player mismatch" }, 400);
    }
    if (amount <= currentHighestBid) {
      return jsonResponse({ success: false, error: "Bid amount must be higher than " + currentHighestBid }, 400);
    }

    const now = Date.now();
    const expiryTime = now + 15000;

    version++;
    bidCount++;

    stateSheet.getRange(2, 5, 1, 4).setValues([[
      amount,
      teamId,
      15,
      new Date(expiryTime).toISOString()
    ]]);
    stateSheet.getRange(2, 13).setValue(bidCount);
    stateSheet.getRange(2, 15).setValue(version);
    stateSheet.getRange(2, 16).setValue(new Date().toISOString());

    const bidId = "bid-" + now + "-" + Math.floor(Math.random() * 1000);
    bidsSheet.appendRow([
      bidId, "league-main", currentPlayerId, teamId, amount,
      bidTime || new Date().toISOString(), Number(stateRow[8]) || 1, "FALSE"
    ]);

    return jsonResponse({
      success: true,
      data: {
        bidId,
        amount,
        teamId,
        version,
        timerExpiresAt: new Date(expiryTime).toISOString(),
      }
    });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------------
// 8. HAMMER_SOLD
// ------------------------------------------------------------------------------
function handleHammerSold(ss, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const { playerId, teamId, amount, announcement } = data;
    const stateSheet = ss.getSheetByName(TABS.AUCTION_STATE);
    const playersSheet = ss.getSheetByName(TABS.PLAYERS);
    const teamsSheet = ss.getSheetByName(TABS.TEAMS);
    const purchasesSheet = ss.getSheetByName(TABS.PURCHASES);
    const auditSheet = ss.getSheetByName(TABS.AUDIT_LOG);

    // 1. Update Player to SOLD
    if (playersSheet && playersSheet.getLastRow() >= 2) {
      const pData = playersSheet.getRange(2, 1, playersSheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < pData.length; i++) {
        if (pData[i][0] === playerId) {
          playersSheet.getRange(i + 2, 10, 1, 3).setValues([[
            "SOLD", teamId, amount
          ]]);
          playersSheet.getRange(i + 2, 13).setValue(new Date().toISOString());
          break;
        }
      }
    }

    // 2. Update Team purse and squad count
    if (teamsSheet && teamsSheet.getLastRow() >= 2) {
      const tData = teamsSheet.getRange(2, 1, teamsSheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < tData.length; i++) {
        if (tData[i][0] === teamId) {
          const rowVals = teamsSheet.getRange(i + 2, 12, 1, 8).getValues()[0];
          const rem = Math.max(0, Number(rowVals[1]) - amount);
          const spent = Number(rowVals[2]) + amount;
          const count = Number(rowVals[6]) + 1;
          const minSquad = Number(rowVals[3]) || 8;
          const isComp = count >= minSquad;

          teamsSheet.getRange(i + 2, 13, 1, 2).setValues([[rem, spent]]);
          teamsSheet.getRange(i + 2, 18, 1, 2).setValues([[count, isComp ? "TRUE" : "FALSE"]]);
          break;
        }
      }
    }

    // 3. Record in Purchases
    purchasesSheet.appendRow([
      "pur-" + Date.now(), "league-main", teamId, playerId, amount, 1, new Date().toISOString()
    ]);

    // 4. Update Announcement in State
    if (stateSheet && stateSheet.getLastRow() >= 2) {
      const version = (Number(stateSheet.getRange(2, 15).getValue()) || 1) + 1;
      stateSheet.getRange(2, 15).setValue(version);
      stateSheet.getRange(2, 16).setValue(new Date().toISOString());
      if (announcement) {
        stateSheet.getRange(2, 21).setValue(JSON.stringify(announcement));
      }
    }

    // 5. Audit Log
    auditSheet.appendRow([
      "audit-" + Date.now(), "league-main", "HAMMER_SOLD",
      JSON.stringify({ playerId, teamId, amount }), "Admin", new Date().toISOString()
    ]);

    return jsonResponse({ success: true, message: "Player hammered SOLD." });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------------
// 9. HAMMER_UNSOLD
// ------------------------------------------------------------------------------
function handleHammerUnsold(ss, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const { playerId, announcement } = data;
    const stateSheet = ss.getSheetByName(TABS.AUCTION_STATE);
    const playersSheet = ss.getSheetByName(TABS.PLAYERS);
    const auditSheet = ss.getSheetByName(TABS.AUDIT_LOG);

    if (playersSheet && playersSheet.getLastRow() >= 2) {
      const pData = playersSheet.getRange(2, 1, playersSheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < pData.length; i++) {
        if (pData[i][0] === playerId) {
          playersSheet.getRange(i + 2, 10).setValue("UNSOLD");
          playersSheet.getRange(i + 2, 13).setValue(new Date().toISOString());
          break;
        }
      }
    }

    if (stateSheet && stateSheet.getLastRow() >= 2) {
      const version = (Number(stateSheet.getRange(2, 15).getValue()) || 1) + 1;
      stateSheet.getRange(2, 15).setValue(version);
      stateSheet.getRange(2, 16).setValue(new Date().toISOString());
      if (announcement) {
        stateSheet.getRange(2, 21).setValue(JSON.stringify(announcement));
      }
    }

    auditSheet.appendRow([
      "audit-" + Date.now(), "league-main", "HAMMER_UNSOLD",
      JSON.stringify({ playerId }), "Admin", new Date().toISOString()
    ]);

    return jsonResponse({ success: true, message: "Player hammered UNSOLD." });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------------
// 10. UNDO_ACTION
// ------------------------------------------------------------------------------
function handleUndoAction(ss, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const stateSheet = ss.getSheetByName(TABS.AUCTION_STATE);
    const playersSheet = ss.getSheetByName(TABS.PLAYERS);
    const teamsSheet = ss.getSheetByName(TABS.TEAMS);
    const purchasesSheet = ss.getSheetByName(TABS.PURCHASES);
    const bidsSheet = ss.getSheetByName(TABS.BID_HISTORY);

    if (!stateSheet || stateSheet.getLastRow() < 2) {
      return jsonResponse({ success: false, error: "Auction state not found" }, 400);
    }

    const stateRow = stateSheet.getRange(2, 1, 1, 21).getValues()[0];
    const lastActionType = stateRow[16];
    let lastPayload = {};
    try { lastPayload = JSON.parse(stateRow[17] || "{}"); } catch {}

    if (!lastActionType) {
      return jsonResponse({ success: false, error: "No undoable action recorded" }, 400);
    }

    if (lastActionType === "HAMMER_SOLD") {
      const { playerId, teamId, amount } = lastPayload;
      // Revert player to ON_AUCTION
      if (playersSheet && playersSheet.getLastRow() >= 2) {
        const pData = playersSheet.getRange(2, 1, playersSheet.getLastRow() - 1, 1).getValues();
        for (let i = 0; i < pData.length; i++) {
          if (pData[i][0] === playerId) {
            playersSheet.getRange(i + 2, 10, 1, 3).setValues([["ON_AUCTION", "", ""]]);
            break;
          }
        }
      }

      // Revert team purse & squad
      if (teamsSheet && teamsSheet.getLastRow() >= 2) {
        const tData = teamsSheet.getRange(2, 1, teamsSheet.getLastRow() - 1, 1).getValues();
        for (let i = 0; i < tData.length; i++) {
          if (tData[i][0] === teamId) {
            const rowVals = teamsSheet.getRange(i + 2, 12, 1, 8).getValues()[0];
            const rem = Number(rowVals[1]) + (amount || 0);
            const spent = Math.max(0, Number(rowVals[2]) - (amount || 0));
            const count = Math.max(0, Number(rowVals[6]) - 1);
            teamsSheet.getRange(i + 2, 13, 1, 2).setValues([[rem, spent]]);
            teamsSheet.getRange(i + 2, 18, 1, 2).setValues([[count, "FALSE"]]);
            break;
          }
        }
      }

      // Remove last purchase row
      if (purchasesSheet && purchasesSheet.getLastRow() >= 2) {
        purchasesSheet.deleteRow(purchasesSheet.getLastRow());
      }
    } else if (lastActionType === "PLACE_BID") {
      if (bidsSheet && bidsSheet.getLastRow() >= 2) {
        bidsSheet.deleteRow(bidsSheet.getLastRow());
      }
    }

    const version = (Number(stateRow[14]) || 1) + 1;
    stateSheet.getRange(2, 15).setValue(version);
    stateSheet.getRange(2, 16).setValue(new Date().toISOString());
    stateSheet.getRange(2, 17, 1, 2).setValues([["", "{}"]]);

    return jsonResponse({ success: true, message: "Last action successfully undone." });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------------
// 11. SAVE_AUCTION_STATE — ATOMIC BATCH PERSISTENCE FOR STATE, TEAMS, PLAYERS, BIDS & PURCHASES
// ------------------------------------------------------------------------------
function handleSaveAuctionState(ss, payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const stateSheet = ss.getSheetByName(TABS.AUCTION_STATE);
    if (!stateSheet) {
      return jsonResponse({ success: false, error: "State sheet missing" }, 500);
    }

    const stateData = (payload && payload.state) ? payload.state : (payload || {});

    const row = [
      stateData.id || "auction-main",
      stateData.seasonId || "league-main",
      stateData.status || "IDLE",
      stateData.currentPlayerId || "",
      stateData.currentHighestBid || 0,
      stateData.currentLeadingTeamId || "",
      stateData.timerSeconds || 45,
      stateData.timerExpiresAt || "",
      stateData.round || 1,
      stateData.roundStage || "MAIN",
      stateData.round2QueueJson || "[]",
      stateData.round1Completed ? "TRUE" : "FALSE",
      stateData.bidCount || 0,
      stateData.bidExtensionSeconds || 10,
      (Number(stateData.version) || 1) + 1,
      new Date().toISOString(),
      stateData.lastActionType || "",
      stateData.lastActionPayloadJson || "{}",
      stateData.consecutiveBidsJson || "{}",
      stateData.pausedRemainingSeconds || "",
      stateData.announcementJson || ""
    ];

    if (stateSheet.getLastRow() >= 2) {
      stateSheet.getRange(2, 1, 1, 21).setValues([row]);
    } else {
      stateSheet.getRange(2, 1, 1, 21).setValues([row]);
    }

    // Persist updated teams if included
    if (payload && Array.isArray(payload.teams) && payload.teams.length > 0) {
      const teamsSheet = ensureSheet(ss, TABS.TEAMS, [
        "id", "seasonId", "name", "shortCode", "logoUrl", "primaryColor", "secondaryColor",
        "ownerName", "ownerPhotoUrl", "iconPlayerName", "iconPlayerPhotoUrl",
        "totalPurse", "remainingPurse", "spentPurse", "minPlayers", "maxPlayers", "reservedPurse",
        "squadCount", "isCompleted", "updatedAt"
      ]);
      if (teamsSheet.getLastRow() >= 2) {
        teamsSheet.getRange(2, 1, teamsSheet.getLastRow() - 1, 20).clearContent();
      }
      const teamRows = payload.teams.map(t => {
        const totalPurse = t.purse?.totalBudget ?? t.purse?.totalPurse ?? 100000;
        const remainingPurse = t.purse?.remainingAmount ?? totalPurse;
        const spentPurse = t.purse?.spentAmount ?? 0;
        const minPlayers = t.purse?.minPlayers ?? 8;
        const maxPlayers = t.purse?.maxPlayers ?? 8;
        const reservedPurse = t.purse?.reservedForSquad ?? t.purse?.reservedPurse ?? 0;
        return [
          t.id, t.seasonId || "league-main", t.name, t.shortCode || t.name.substring(0, 3).toUpperCase(),
          t.logoUrl || "", t.primaryColor || "#059669", t.secondaryColor || "#F59E0B",
          t.ownerName || "", t.ownerPhotoUrl || "", t.iconPlayerName || "", t.iconPlayerPhotoUrl || "",
          totalPurse, remainingPurse, spentPurse, minPlayers, maxPlayers, reservedPurse,
          t.squadCount || 0, t.isCompleted ? "TRUE" : "FALSE", new Date().toISOString()
        ];
      });
      teamsSheet.getRange(2, 1, teamRows.length, 20).setValues(teamRows);
    }

    // Persist updated players if included
    if (payload && Array.isArray(payload.players) && payload.players.length > 0) {
      const playersSheet = ensureSheet(ss, TABS.PLAYERS, [
        "id", "seasonId", "name", "category", "primaryRole", "battingStyle", "bowlingStyle",
        "photoUrl", "basePrice", "status", "teamId", "soldPrice", "soldTime",
        "isIcon", "sortOrder", "updatedAt"
      ]);
      if (playersSheet.getLastRow() >= 2) {
        playersSheet.getRange(2, 1, playersSheet.getLastRow() - 1, 16).clearContent();
      }
      const playerRows = payload.players.map((p, idx) => [
        p.id, p.seasonId || "league-main", p.fullName || p.name,
        p.category || "SILVER", p.primaryRole || "ALL_ROUNDER",
        p.battingStyle || "Right-Hand Bat", p.bowlingStyle || "Right-Arm Medium",
        p.photoUrl || "", Number(p.basePrice) || 2000, p.status || "AVAILABLE",
        p.soldToTeamId || p.teamId || "", p.soldPrice || "", p.soldTime || "",
        p.isIcon ? "TRUE" : "FALSE", p.sortOrder || (idx + 1), new Date().toISOString()
      ]);
      playersSheet.getRange(2, 1, playerRows.length, 16).setValues(playerRows);
    }

    // Persist new bid if included
    if (payload && payload.newBid) {
      const bidsSheet = ensureSheet(ss, TABS.BID_HISTORY, [
        "id", "seasonId", "playerId", "teamId", "amount", "bidTime", "round", "isWinning"
      ]);
      const b = payload.newBid;
      bidsSheet.appendRow([
        b.id || ("bid-" + Date.now()),
        b.seasonId || "league-main",
        b.playerId || "",
        b.teamId || "",
        b.amount || 0,
        b.placedAt || b.bidTime || new Date().toISOString(),
        b.round || stateData.round || 1,
        b.isWinning ? "TRUE" : "FALSE"
      ]);
    }

    // Persist new purchase record if included
    if (payload && payload.newPurchase) {
      const purchasesSheet = ensureSheet(ss, TABS.PURCHASES, [
        "id", "seasonId", "teamId", "playerId", "amount", "round", "timestamp"
      ]);
      const p = payload.newPurchase;
      purchasesSheet.appendRow([
        p.id || ("pur-" + Date.now()),
        p.seasonId || "league-main",
        p.teamId || "",
        p.playerId || "",
        p.soldPrice || p.amount || 0,
        p.round || stateData.round || 1,
        p.soldAt || p.timestamp || new Date().toISOString()
      ]);
    }

    // Persist audit entry if included
    if (payload && payload.auditEntry) {
      const auditSheet = ensureSheet(ss, TABS.AUDIT_LOG, [
        "id", "seasonId", "action", "details", "actor", "timestamp"
      ]);
      const a = payload.auditEntry;
      auditSheet.appendRow([
        a.id || ("audit-" + Date.now()),
        a.seasonId || "league-main",
        a.actionType || a.action || "AUCTION_ACTION",
        a.detailsJson || a.details || "{}",
        a.actor || "AUCTIONEER",
        a.timestamp || new Date().toISOString()
      ]);
    }

    return jsonResponse({ success: true, version: row[14], updatedAt: row[15] });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------------
// 12. RESET_AUCTION — RESTORES ALL PLAYERS & TEAMS TO INITIAL PURSES
// ------------------------------------------------------------------------------
function handleResetAuction(ss, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const playersSheet = ss.getSheetByName(TABS.PLAYERS);
    const teamsSheet = ss.getSheetByName(TABS.TEAMS);
    const stateSheet = ss.getSheetByName(TABS.AUCTION_STATE);
    const bidsSheet = ss.getSheetByName(TABS.BID_HISTORY);
    const purchasesSheet = ss.getSheetByName(TABS.PURCHASES);
    const auditSheet = ss.getSheetByName(TABS.AUDIT_LOG);

    // Reset all players to AVAILABLE
    if (playersSheet && playersSheet.getLastRow() >= 2) {
      const numPlayers = playersSheet.getLastRow() - 1;
      for (let i = 0; i < numPlayers; i++) {
        playersSheet.getRange(i + 2, 10, 1, 4).setValues([["AVAILABLE", "", "", ""]]);
      }
    }

    // Reset each team's remaining purse to its total purse
    if (teamsSheet && teamsSheet.getLastRow() >= 2) {
      const numTeams = teamsSheet.getLastRow() - 1;
      for (let i = 0; i < numTeams; i++) {
        const totalPurse = Number(teamsSheet.getRange(i + 2, 12).getValue()) || 100000;
        teamsSheet.getRange(i + 2, 13, 1, 2).setValues([[totalPurse, 0]]);
        teamsSheet.getRange(i + 2, 18, 1, 2).setValues([[0, "FALSE"]]);
      }
    }

    // Clear bids & purchases
    if (bidsSheet && bidsSheet.getLastRow() >= 2) {
      bidsSheet.getRange(2, 1, bidsSheet.getLastRow() - 1, bidsSheet.getLastColumn()).clearContent();
    }
    if (purchasesSheet && purchasesSheet.getLastRow() >= 2) {
      purchasesSheet.getRange(2, 1, purchasesSheet.getLastRow() - 1, purchasesSheet.getLastColumn()).clearContent();
    }

    // Reset state
    if (stateSheet && stateSheet.getLastRow() >= 2) {
      const firstPlayerId = (playersSheet && playersSheet.getLastRow() >= 2)
        ? playersSheet.getRange(2, 1).getValue()
        : "";
      stateSheet.getRange(2, 1, 1, 21).setValues([[
        "auction-main", "league-main", "IDLE", firstPlayerId, 0, "", 45,
        "", 1, "MAIN", "[]", "FALSE", 0, 10, 1,
        new Date().toISOString(), "RESET", "{}", "{}", "", ""
      ]]);
    }

    auditSheet.appendRow([
      "audit-" + Date.now(), "league-main", "RESET_AUCTION",
      "Full auction reset to IDLE", "Admin", new Date().toISOString()
    ]);

    return jsonResponse({ success: true, message: "Auction completely reset to initial state." });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------------
// 13. RESET_WORKBOOK — COMPLETE WIPE OF ALL DATA (LEAVES HEADERS ONLY)
// ------------------------------------------------------------------------------
function handleResetWorkbook(ss, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const tabsToClear = [TABS.TEAMS, TABS.PLAYERS, TABS.BID_HISTORY, TABS.PURCHASES, TABS.AUDIT_LOG];
    for (let tab of tabsToClear) {
      const sheet = ss.getSheetByName(tab);
      if (sheet && sheet.getLastRow() >= 2) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
      }
    }

    // Re-initialize state sheet to blank
    const stateSheet = ss.getSheetByName(TABS.AUCTION_STATE);
    if (stateSheet && stateSheet.getLastRow() >= 2) {
      stateSheet.getRange(2, 1, 1, 21).setValues([[
        "auction-main", "league-main", "IDLE", "", 0, "", 45,
        "", 1, "MAIN", "[]", "FALSE", 0, 10, 1,
        new Date().toISOString(), "RESET_WORKBOOK", "{}", "{}", "", ""
      ]]);
    }

    return jsonResponse({ success: true, message: "Workbook cleared to blank state." });
  } finally {
    lock.releaseLock();
  }
}
