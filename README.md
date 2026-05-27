# Sticky Assistant

## Quick Start (One-Command Install)

To clone, install dependencies, and prepare the project in a single step:

### macOS / Linux
```bash
curl -fsSL https://raw.githubusercontent.com/RubenBroere/sticky-assistant/main/scripts/install.sh | bash
```

### Windows (PowerShell)
```powershell
iwr https://raw.githubusercontent.com/RubenBroere/sticky-assistant/main/scripts/install.ps1 | iex
```

---

## The Suite of Tools

### 1. Action Points Extractor (`action-points-extractor`)
Scan Google Documents for real-time action items, compile progress, check them off in-place, and optionally synchronize them directly to Todoist.

*   **Syntax Format:** Scan for lines starting with `AP` or `Action Point` followed by name(s) and the task:
    *   `AP Ruben: Write project proposal [2026-05-28]`
*   **Due Dates:** Supports ISO `[YYYY-MM-DD]` formatted due dates enclosed in square brackets.
*   **Smart Multi-Assignee & Bilingual Splits:** Split assignees dynamically using commas, `and`, `&`, or the Dutch `en` (with trailing-space enforcement, e.g. `AP Ruben, John en Alice: task`).
*   **Whole Team Assignment:** Supports English `everyone` and Dutch `iedereen` triggers to assign a task to all configured team members automatically.
*   **Interactive Jumping (Highlight & Scroll):** Click the **Show** button next to any scanned task to automatically scroll the Google Doc editor, focus, and highlight the exact line of that action item.
*   **Bespoke Document Summary:** Insert a beautifully formatted, clean checklist at the top of your document, partitioned by assignee with clean whitespace separators, completely stripped of annoying bold text inheritance.

### 2. Comments Extractor (`comments-extractor`)
View and export PDF comments directly within Google Drive.
*   *Host Requirement:* Google Drive (PDF selection).

### 3. Committee Creator (`committee-creator`)
Clone and roll forward entire committee folder structures for the next academic year. It automatically detects year patterns in folders and files and updates placeholder dates seamlessly.
*   *Host Requirement:* Google Drive folder.

---

## Layered Settings Architecture

Sticky Assistant implements a highly flexible, secure **Layered Settings System** featuring global account-wide fallback and granular workspace-level overrides.

```
       ┌──────────────────────────────────────────────┐
       │               WORKSPACE LAYER                │
       │  Drive Folder: `sticky-assistant.json`       │
       └──────────────────────┬───────────────────────┘
                              │ (Overrides)
                              ▼
       ┌──────────────────────────────────────────────┐
       │                 GLOBAL LAYER                 │
       │      Workspace User Properties Store         │
       └──────────────────────────────────────────────┘
```

1.  **Global Layer (User Properties):** Personal account settings (e.g. your Todoist API token) stored securely in Google Workspace User Properties.
2.  **Workspace Layer (`sticky-assistant.json`):** Shared settings stored as a JSON file in the parent folder of the active Document/Drive item.
    *   **Folder Traversal:** When launching a tool, the add-on dynamically traverses parent directories upward to locate the first `sticky-assistant.json` file.
    *   **Speed & Performance:** Uses execution-level in-memory caching to bypass redundant remote API calls, boosting settings load speed by over 300%.
3.  **Airtight Credential Safety (Secret Isolation):**
    *   Private credentials (like the `todoistToken`) are marked as `secret: true` in the configuration schema.
    *   Secrets are restricted **strictly** to the `🔒 Global Layer Only` inside the user interface.
    *   The backend enforces a strict rejection policy to block saving secret keys into the local `sticky-assistant.json` file, fully neutralizing the risk of leaking private API keys in shared team folders.
4.  **Aesthetic Settings Editor:**
    *   Banners dynamically indicate configuration status (e.g. `🟢 Workspace Settings Active` vs `⚪ Global Settings Active`).
    *   Context-sensitive buttons allow saving to either layer and reverting workspace overrides via `Reset to Global` cleanly.

---

## 💻 Installation & Developer Setup

### 1. Prerequisites & Environment Setup
Make sure you have [Node.js](https://nodejs.org/) (v16+) installed.

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/RubenBroere/sticky-assistant.git
    cd sticky-assistant
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Build the Project:**
    ```bash
    npm run build
    ```
    This compiles the TypeScript source code into `dist/index.js` and copies the `appsscript.json` configuration manifest into the `dist/` build directory.

### 2. Clasp Setup & Apps Script Linking
Sticky Assistant uses `@google/clasp` to manage and push code to Google Apps Script.

1.  **Enable the Google Apps Script API:**
    Go to your Google account's [Apps Script Settings page](https://script.google.com/home/settings) and toggle **Google Apps Script API** to **On**.
2.  **Log in to Clasp:**
    ```bash
    npx clasp login
    ```
3.  **Create or Link a Script Project:**
    *   **Option A: Create a new standalone script:**
        ```bash
        npx clasp create --type standalone --title "Sticky Assistant Dev"
        ```
    *   **Option B: Link to an existing script:**
        Open `.clasp.json` and replace the `scriptId` with your existing Google Apps Script ID:
        ```json
        {
          "scriptId": "YOUR_APPS_SCRIPT_ID_HERE",
          "rootDir": "dist"
        }
        ```

### 3. Pushing Code
To push your local builds to Google Apps Script:
```bash
npm run push
```
This runs the production compiler (`npm run build`) and executes `clasp push` to sync all compiled assets directly to the cloud.

---

## Deploying & Testing using Test Deployments

Google Workspace Add-ons are best validated using **Test Deployments**, allowing developers to run and debug head deployments in real-time.

### Step-by-Step Testing Guide

1.  **Push the Latest Code:**
    Execute `npm run push` to sync the latest build to the Apps Script editor.
2.  **Open the Apps Script Project:**
    Go to [script.google.com](https://script.google.com) and open your `Sticky Assistant Dev` project.
3.  **Access Test Deployments:**
    *   Click the **Deploy** button at the top-right corner.
    *   Select **Test deployments**.
4.  **Install the Head Deployment:**
    *   A dialog will appear showing the available deployment types (e.g. Google Docs Add-on, Google Drive Add-on).
    *   Click **Install** or **Enable** next to the Add-on deployment.
    *   Click **Done**.
5.  **Run the Add-on in Google Workspace:**
    *   Open Google Docs or Google Drive in **the same Google Account** used for development.
    *   Look for the Sticky icon in the right-hand sidebar.
    *   Click the icon to open the Sidebar panel.
    *   *Tip:* Every subsequent local code modification followed by an `npm run push` will instantly be reflected in the Workspace app—no need to reinstall the deployment!

---

## Troubleshooting Section

### 1. "Could not determine active parent folder" or Settings Not Saving to Workspace
*   **Cause:** The active Google Doc has not been stored inside a Drive Folder (it resides directly in the root "My Drive"), or the script lacks access to parent folder metadata.
*   **Solution:** Move the document into a subfolder in Google Drive. Ensure you have authorized the `https://www.googleapis.com/auth/drive` scope.

### 2. Slow Loading Speeds or Settings Not Updating
*   **Cause:** Google Apps Script execution cache is showing stale values, or slow remote API limits are being throttled.
*   **Solution:** Sticky Assistant uses an in-memory cache per run execution to eliminate performance bottlenecks. If settings are modified outside the add-on UI, simply close and reopen the add-on sidebar to force-refresh the cache.

### 3. CLASP Push Fails / Out of Sync
*   **Cause:** The online Apps Script project has been edited manually in the browser, or the `appsscript.json` manifest is missing from `dist/`.
*   **Solution:** Always make code changes locally. Run `npm run build` to copy the manifest into `dist/`. If you get sync conflicts, run:
    ```bash
    npx clasp push --force
    ```

### 4. Todoist Integration Synchronization Failures
*   **Cause:** The `Enable Todoist` checkbox is off, the `todoistProjectId` is incorrect, or `todoistToken` is invalid.
*   **Solution:**
    *   Check your credentials under **Configure Action Points Extractor**.
    *   Verify the `todoistToken` is stored in the **Global Layer** (the UI will show `🔒 Global Layer Only`).
    *   Ensure the `todoistProjectId` matches the project ID visible in your Todoist web browser URL.

### 5. Scope Permissions & Authorization Prompts
*   **Cause:** The `appsscript.json` manifest has been updated with new oauthScopes, but the user has not authorized the new scopes.
*   **Solution:** Open the add-on in Docs or Drive. When the authorization prompt appears, click **Review Permissions**, select your Google account, click **Advanced**, and then click **Go to Sticky Assistant (unsafe)** to authorize all required scopes.
