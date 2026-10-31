# GOOGLE SHEETS & GOOGLE CLOUD INTEGRATION SETUP GUIDE

This guide provides step-by-step instructions to configure Google Cloud and Google Sheets as the authoritative database for the NTL Cricket Auction Platform.

---

## Step 1: Create Google Cloud Project
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar and select **New Project**.
3. Name the project `ntl-auction-platform` (or your preferred name).
4. Click **Create** and ensure the project is selected.

---

## Step 2: Enable Required APIs
You must enable two Google Workspace APIs:
1. Navigate to **APIs & Services > Library**.
2. Search for **Google Sheets API** and click **Enable**.
3. Search for **Google Drive API** and click **Enable**.

---

## Step 3: Create Service Account
1. Navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials > Service Account**.
3. Fill in the details:
   * **Service account name**: `ntl-auction-bot`
   * **Service account ID**: `ntl-auction-bot`
4. Click **Create and Continue**.
5. Role selection:
   * No project-wide administrative roles are needed. Leave blank or select **Project > Viewer** for least-privilege security.
6. Click **Done**.
7. Note down the generated service account email (e.g. `ntl-auction-bot@ntl-auction-platform.iam.gserviceaccount.com`).

---

## Step 4: Generate Service Account Key
1. In the **Credentials** tab, click on the newly created Service Account.
2. Select the **Keys** tab at the top.
3. Click **Add Key > Create new key**.
4. Choose **JSON** format and click **Create**.
5. Save the downloaded `.json` file securely on your computer.

From this downloaded JSON file, you will need two fields:
* `client_email` &rarr; for `GOOGLE_SERVICE_ACCOUNT_EMAIL`
* `private_key` &rarr; for `GOOGLE_PRIVATE_KEY`

---

## Step 5: Create and Share Google Sheets Workbook
1. Open [Google Sheets](https://sheets.new) to create a new blank spreadsheet.
2. Title it `NTL Season 1 - Auction Database`.
3. In the top right corner, click **Share**.
4. Add the service account email (from Step 3) as **Editor**.
5. Uncheck "Notify people" and click **Share**.
6. Copy the Spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/1uC87Sn8KLbAHs9g1ZT63AIyIY85C7LVh-cZF8dvvgo0/edit
                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   ```
7. Note this ID &rarr; for `GOOGLE_SHEETS_DATABASE_ID`.

> **Note on Tabs**: You do not need to create the 7 tabs manually. On first boot, the platform's `initializeLeagueWorkbook` utility automatically creates and formats `League_Config`, `Teams`, `Players`, `Auction_State`, `Bid_History`, `Purchases`, and `Audit_Log` with headers!

---

## Step 6: Share Google Drive Photos Folder
1. Open [Google Drive](https://drive.google.com).
2. Open or create the folder containing player portrait photographs.
3. Click **Share** on the folder.
4. Add the service account email as **Viewer** (or **Editor**).
5. Copy the folder ID from the URL &rarr; for `GOOGLE_DRIVE_FOLDER_ID`.

---

## Step 7: Configure Environment Variables

### Local Development (`.env.local`)
Create `.env.local` in the project root:
```env
# Google Cloud Service Account
GOOGLE_SERVICE_ACCOUNT_EMAIL="ntl-auction-bot@ntl-auction-platform.iam.gserviceaccount.com"

# Paste the private key exactly, including the BEGIN and END lines.
# In .env files, wrap the entire multi-line key in double quotes and preserve \n escapes:
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

# Google Workbooks
GOOGLE_SHEETS_DATABASE_ID="your_google_sheets_auction_database_workbook_id"
GOOGLE_SHEET_ID="your_registration_spreadsheet_id_here"
GOOGLE_DRIVE_FOLDER_ID="your_google_drive_folder_id_for_player_photos"
```

### Production Deployment (Vercel)
1. Go to your Project Dashboard on [Vercel](https://vercel.com).
2. Navigate to **Settings > Environment Variables**.
3. Add the following variables:
   * `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Paste the service account email.
   * `GOOGLE_PRIVATE_KEY`: Paste the full private key string (with `\n` or literal newlines).
   * `GOOGLE_SHEETS_DATABASE_ID`: Paste the auction database spreadsheet ID.
   * `GOOGLE_SHEET_ID`: Paste the registration sheet ID.
   * `GOOGLE_DRIVE_FOLDER_ID`: Paste the Google Drive folder ID.
4. Check **Production**, **Preview**, and **Development** environments.
5. Click **Save**.
