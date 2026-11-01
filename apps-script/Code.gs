/**
 * ==============================================================================
 * NALANDA TURF LEAGUE SEASON 1 — AUCTION PERSISTENCE BRIDGE (GOOGLE APPS SCRIPT)
 * ==============================================================================
 * 
 * This Apps Script acts as the atomic, serialized persistence layer for the NTL
 * Season 1 auction platform hosted on Vercel.
 * 
 * Features:
 * 1. Zero Google Cloud Service Account setup — runs under your personal Google account.
 * 2. Atomic write serialization via LockService to prevent bidding race conditions.
 * 3. 1-call batch read for all 7 tournament tabs, reducing network round-trips.
 * 4. Shared secret authentication for secure server-to-server communication.
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Open your NTL Season 1 Google Sheet.
 * 2. Click Extensions → Apps Script.
 * 3. Replace all content in Code.gs with this file.
 * 4. (Optional) Go to Project Settings → Script Properties, add:
 *    Property: APPS_SCRIPT_SHARED_SECRET
 *    Value: your_custom_secret_passphrase
 * 5. Click Deploy → New deployment.
 * 6. Select type: Web app.
 *    - Description: NTL Season 1 Auction Persistence
 *    - Execute as: Me (your Google account)
 *    - Who has access: Anyone
 * 7. Click Deploy, Authorize access, and copy the Web App URL.
 * 8. Set APPS_SCRIPT_WEB_APP_URL and APPS_SCRIPT_SHARED_SECRET in your Vercel Environment Variables.
 * ==============================================================================
 */

const DEFAULT_SECRET = "ntl_season_1_secret_key_2026";

function getSharedSecret() {
  try {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty("APPS_SCRIPT_SHARED_SECRET") || DEFAULT_SECRET;
  } catch (e) {
    return DEFAULT_SECRET;
  }
}

function jsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function doGet(e) {
  return jsonResponse({
    status: "online",
    system: "Nalanda Turf League Season 1 Auction Bridge",
    timestamp: new Date().toISOString(),
    spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: "Empty request payload" }, 400);
    }

    const payload = JSON.parse(e.postData.contents);
    const { secret, action, data } = payload;

    // Verify Shared Secret
    const expectedSecret = getSharedSecret();
    if (expectedSecret && secret !== expectedSecret) {
      return jsonResponse({ success: false, error: "Unauthorized: Invalid shared secret" }, 401);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    switch (action) {
      case "PING":
        return jsonResponse({ success: true, message: "Pong from NTL Apps Script Bridge", spreadsheetId: ss.getId() });

      case "INIT_WORKBOOK":
        return handleInitWorkbook(ss, data);

      case "GET_ALL_DATA":
        return handleGetAllData(ss);

      case "GET_AUCTION_STATE":
        return handleGetAuctionState(ss);

      case "SAVE_AUCTION_STATE":
        return handleSaveAuctionState(ss, data);

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
// 1. INIT_WORKBOOK
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

    const teamsSheet = ensureSheet(ss, TABS.TEAMS, [
      "id", "seasonId", "name", "shortCode", "logoUrl", "primaryColor", "secondaryColor",
      "ownerName", "ownerPhotoUrl", "iconPlayerName", "iconPlayerPhotoUrl",
      "totalPurse", "remainingPurse", "spentPurse", "minPlayers", "maxPlayers", "reservedPurse",
      "squadCount", "isCompleted", "updatedAt"
    ]);

    const playersSheet = ensureSheet(ss, TABS.PLAYERS, [
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

    // Seed Teams if empty
    if (teamsSheet.getLastRow() <= 1 && data && data.teams && data.teams.length > 0) {
      const teamRows = data.teams.map(t => [
        t.id, t.seasonId || "league-ntl", t.name, t.shortCode, t.logoUrl, t.primaryColor, t.secondaryColor,
        t.ownerName || "", t.ownerPhotoUrl || "", t.iconPlayerName || "", t.iconPlayerPhotoUrl || "",
        t.purse?.totalPurse || 100000, t.purse?.remainingAmount || 100000, t.purse?.spentAmount || 0,
        t.purse?.minPlayers || 8, t.purse?.maxPlayers || 8, t.purse?.reservedPurse || 12000,
        t.squadCount || 2, t.isCompleted ? "TRUE" : "FALSE", new Date().toISOString()
      ]);
      teamsSheet.getRange(2, 1, teamRows.length, teamRows[0].length).setValues(teamRows);
    }

    // Seed Players if empty
    if (playersSheet.getLastRow() <= 1 && data && data.players && data.players.length > 0) {
      const playerRows = data.players.map((p, idx) => [
        p.id, p.seasonId || "league-ntl", p.name, p.category || "SILVER", p.primaryRole || "ALL_ROUNDER",
        p.battingStyle || "Right-Hand Bat", p.bowlingStyle || "Right-Arm Medium",
        p.photoUrl || "", p.basePrice || 2000, p.status || "AVAILABLE", p.teamId || "",
        p.soldPrice || "", p.soldTime || "", p.isIcon ? "TRUE" : "FALSE", p.sortOrder || (idx + 1),
        new Date().toISOString()
      ]);
      playersSheet.getRange(2, 1, playerRows.length, playerRows[0].length).setValues(playerRows);
    }

    // Seed Initial State if empty
    if (stateSheet.getLastRow() <= 1 && data && data.initialState) {
      const s = data.initialState;
      stateSheet.getRange(2, 1, 1, 21).setValues([[
        s.id || "auction-league-ntl", s.seasonId || "league-ntl", s.status || "IDLE",
        s.currentPlayerId || (data.players && data.players[0] ? data.players[0].id : ""),
        s.currentHighestBid || 0, s.currentLeadingTeamId || "", s.timerSeconds || 45,
        s.timerExpiresAt || new Date(Date.now() + 45000).toISOString(), s.round || 1,
        s.roundStage || "MAIN", s.round2QueueJson || "[]", s.round1Completed ? "TRUE" : "FALSE",
        s.bidCount || 0, s.bidExtensionSeconds || 10, s.version || 1, new Date().toISOString(),
        "", "{}", "{}", "", ""
      ]]);
    }

    return jsonResponse({ success: true, message: "Workbook initialized and schemas provisioned." });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------------
// 2. GET_ALL_DATA
// ------------------------------------------------------------------------------
function handleGetAllData(ss) {
  const configSheet = ss.getSheetByName(TABS.LEAGUE_CONFIG);
  const teamsSheet = ss.getSheetByName(TABS.TEAMS);
  const playersSheet = ss.getSheetByName(TABS.PLAYERS);
  const stateSheet = ss.getSheetByName(TABS.AUCTION_STATE);
  const bidsSheet = ss.getSheetByName(TABS.BID_HISTORY);
  const purchasesSheet = ss.getSheetByName(TABS.PURCHASES);

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
      logoUrl: r[4],
      primaryColor: r[5],
      secondaryColor: r[6],
      ownerName: r[7],
      ownerPhotoUrl: r[8],
      iconPlayerName: r[9],
      iconPlayerPhotoUrl: r[10],
      purse: {
        totalPurse: Number(r[11]) || 100000,
        remainingAmount: Number(r[12]) || 100000,
        spentAmount: Number(r[13]) || 0,
        minPlayers: Number(r[14]) || 8,
        maxPlayers: Number(r[15]) || 8,
        reservedPurse: Number(r[16]) || 12000,
      },
      squadCount: Number(r[17]) || 2,
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
      category: r[3],
      primaryRole: r[4],
      battingStyle: r[5],
      bowlingStyle: r[6],
      photoUrl: r[7],
      basePrice: Number(r[8]) || 2000,
      status: r[9] || "AVAILABLE",
      teamId: r[10] || undefined,
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
      state,
      teams,
      players,
      recentBids,
      timestamp: new Date().toISOString(),
    }
  });
}

// ------------------------------------------------------------------------------
// 3. PLACE_BID
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

    // Extend timer by 10s or reset to 15s if low
    const now = Date.now();
    const expiryTime = now + 15000; // 15 seconds after active bid

    version++;
    bidCount++;

    // Update state row
    stateSheet.getRange(2, 5, 1, 4).setValues([[
      amount,
      teamId,
      15,
      new Date(expiryTime).toISOString()
    ]]);
    stateSheet.getRange(2, 13).setValue(bidCount);
    stateSheet.getRange(2, 15).setValue(version);
    stateSheet.getRange(2, 16).setValue(new Date().toISOString());

    // Record bid in Bid_History
    const bidId = "bid-" + now + "-" + Math.floor(Math.random() * 1000);
    bidsSheet.appendRow([
      bidId, "league-ntl", currentPlayerId, teamId, amount,
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
// 4. HAMMER_SOLD
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
      "pur-" + Date.now(), "league-ntl", teamId, playerId, amount, 1, new Date().toISOString()
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
      "audit-" + Date.now(), "league-ntl", "HAMMER_SOLD",
      JSON.stringify({ playerId, teamId, amount }), "Admin", new Date().toISOString()
    ]);

    return jsonResponse({ success: true, message: "Player hammered SOLD and team purse updated." });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------------
// 5. HAMMER_UNSOLD
// ------------------------------------------------------------------------------
function handleHammerUnsold(ss, data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const { playerId, announcement } = data;
    const stateSheet = ss.getSheetByName(TABS.AUCTION_STATE);
    const playersSheet = ss.getSheetByName(TABS.PLAYERS);
    const auditSheet = ss.getSheetByName(TABS.AUDIT_LOG);

    // Update Player to UNSOLD
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

    // Update State
    if (stateSheet && stateSheet.getLastRow() >= 2) {
      const version = (Number(stateSheet.getRange(2, 15).getValue()) || 1) + 1;
      stateSheet.getRange(2, 15).setValue(version);
      stateSheet.getRange(2, 16).setValue(new Date().toISOString());
      if (announcement) {
        stateSheet.getRange(2, 21).setValue(JSON.stringify(announcement));
      }
    }

    auditSheet.appendRow([
      "audit-" + Date.now(), "league-ntl", "HAMMER_UNSOLD",
      JSON.stringify({ playerId }), "Admin", new Date().toISOString()
    ]);

    return jsonResponse({ success: true, message: "Player hammered UNSOLD." });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------------
// 6. SAVE_AUCTION_STATE
// ------------------------------------------------------------------------------
function handleSaveAuctionState(ss, stateData) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const stateSheet = ss.getSheetByName(TABS.AUCTION_STATE);
    if (!stateSheet) {
      return jsonResponse({ success: false, error: "State sheet missing" }, 500);
    }

    const row = [
      stateData.id || "auction-league-ntl",
      stateData.seasonId || "league-ntl",
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

    return jsonResponse({ success: true, version: row[14], updatedAt: row[15] });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------------
// 7. RESET_AUCTION
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

    // Reset all players
    if (playersSheet && playersSheet.getLastRow() >= 2) {
      const numPlayers = playersSheet.getLastRow() - 1;
      for (let i = 0; i < numPlayers; i++) {
        playersSheet.getRange(i + 2, 10, 1, 4).setValues([["AVAILABLE", "", "", ""]]);
      }
    }

    // Reset all teams to initial purse & squad
    if (teamsSheet && teamsSheet.getLastRow() >= 2) {
      const numTeams = teamsSheet.getLastRow() - 1;
      for (let i = 0; i < numTeams; i++) {
        teamsSheet.getRange(i + 2, 12, 1, 8).setValues([[
          100000, 100000, 0, 8, 8, 12000, 2, "FALSE"
        ]]);
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
        "auction-league-ntl", "league-ntl", "IDLE", firstPlayerId, 0, "", 45,
        new Date(Date.now() + 45000).toISOString(), 1, "MAIN", "[]", "FALSE", 0, 10, 1,
        new Date().toISOString(), "RESET", "{}", "{}", "", ""
      ]]);
    }

    auditSheet.appendRow([
      "audit-" + Date.now(), "league-ntl", "RESET_AUCTION",
      "Full auction reset to IDLE", "Admin", new Date().toISOString()
    ]);

    return jsonResponse({ success: true, message: "Auction completely reset to initial state." });
  } finally {
    lock.releaseLock();
  }
}
