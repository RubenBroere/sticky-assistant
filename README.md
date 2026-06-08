# Sticky Assistant

Sticky Assistant is a modular Google Workspace Add-on suite designed to integrate across Google Docs, Google Drive, and Google Calendar. Built with TypeScript, bundled via Rollup, and managed through Clasp, it provides a structured workspace toolchain for teams.

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

## Project Directory Structure

```
├── .github/                  # GitHub workflows, issue templates, and PR configurations
│   ├── ISSUE_TEMPLATE/       # Structured bug and feature templates
│   └── workflows/            # CI/CD Actions (Lint, Typecheck, Test verification)
├── dist/                     # Rollup build output (ignored in git, deployed to Apps Script)
├── src/
│   ├── core/                 # Shared core framework and utilities
│   ├── tools/                # Specialized tools in the Sticky Assistant suite
│   │   ├── action-points-extractor/
│   │   ├── calendar-sync/
│   │   ├── comments-extractor/
│   │   ├── committee-creator/
│   │   └── properties-debugger/
│   ├── index.ts              # Root entry point exporting all trigger and action callbacks
│   └── triggers.ts           # Entry point homepage trigger definitions
├── tsconfig.json             # TypeScript compiler settings
├── rollup.config.mjs         # Bundle compiler configurations
└── appsscript.json           # Google Apps Script configuration manifest
```

---

## The Suite of Tools

### 1. [Action Points Extractor](./src/tools/action-points-extractor/README.md)

Scan Google Documents for real-time action items, compile progress, check them off in-place, and optionally synchronize them directly to Todoist.

- **Highlight & Scroll Navigation:** Automatically focus and highlight the exact line of a scanned action item from the sidebar.
- **Bespoke Document Summary:** Insert a formatted checklist at the top of your document, partitioned by assignee with clean whitespace separators.

### 2. [Calendar Sync](./src/tools/calendar-sync/README.md)

Combine multiple personal and shared calendars into a single, auto-syncing calendar.

- **Privacy Overrides:** Choose between copying full event details or masking title/description under custom nicknames.
- **Hourly Background Sync:** Enqueues a project-wide hourly trigger to run background synchronizations.

### 3. [Comments Extractor](./src/tools/comments-extractor/README.md)

View and export comments and annotations from PDF files directly within Google Drive to styled Google Sheets.

### 4. [Committee Creator](./src/tools/committee-creator/README.md)

Clone and roll forward entire committee folder structures, automatically updating academic year patterns in folders and files.

### 5. [Properties Debugger](./src/tools/properties-debugger/README.md)

Inspect, add, edit, and delete raw User Properties stored in the Google Apps Script database (`PropertiesService`).

---

## Architecture & Development Workflow

### 1. Bundling and the "GAS Unroller"

Google Apps Script executes code in a flat, global namespace. Variables and functions must be declared top-level in the global scope (e.g. `function onOpen() { ... }`).

- **Module Bundler:** We write modular TypeScript and compile it into a single bundle (`dist/index.js`) using Rollup.
- **GAS Unplugin:** We use `@gas-plugin/unplugin` in `rollup.config.mjs` to automatically extract the bundle's exports and redefine them as global wrapper functions.
- **Entry Point Manifest (src/index.ts):** Any trigger or Card UI callback function (such as `saveJobAction` or `openEditPropertyCard`) must be exported from `src/index.ts` so that Rollup includes it in the bundle and the unplugin exposes it globally to Apps Script.

### 2. Layered Settings Architecture

Sticky Assistant implements a flexible Layered Settings System featuring global account-wide fallbacks and granular workspace-level overrides.

- **Global Layer (User Properties):** Personal account settings (e.g. API tokens) stored securely in Google Workspace User Properties.
- **Workspace Layer (sticky-assistant.json):** Shared settings stored as a JSON file in the parent folder of the active Document/Drive item.
- **Secret Isolation:** Private credentials marked as `secret: true` in the configuration schema are strictly locked to the Global Layer, preventing accidental leaks in shared workspace folders.

---

## Developer Installation & Setup

### 1. Environment Setup

Make sure you have Node.js (v20+) installed.

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
    This compiles the TypeScript source code into `dist/index.js` and copies `appsscript.json` into the `dist/` build directory.

### 2. Clasp Setup & Apps Script Linking

Sticky Assistant uses `@google/clasp` to manage and push code to Google Apps Script.

1.  **Enable the Google Apps Script API:**
    Toggle **Google Apps Script API** to **On** at your Google account's [Apps Script Settings page](https://script.google.com/home/settings).
2.  **Log in to Clasp:**
    ```bash
    npx clasp login
    ```
3.  **Link to a Script Project:**
    Open `.clasp.json` and replace the `scriptId` with your Google Apps Script project ID:
    ```json
    {
      "scriptId": "YOUR_APPS_SCRIPT_ID_HERE",
      "rootDir": "dist"
    }
    ```

### 3. Deploying & Testing

- **Pushing Code:** Run `npm run push` to compile and upload your code to the Apps Script editor.
- **Test Deployments:** In the Apps Script editor, click **Deploy** -> **Test Deployments**, install the head deployment, and open Google Docs/Drive in the same account to run the add-on in the sidebar.

---

## Testing

We use Vitest for running unit tests. Mocks are configured to simulate the Google Apps Script runtime (such as `PropertiesService` and `CacheService`) locally.

- Run tests:
  ```bash
  npm run test
  ```
- Run tests in watch mode:
  ```bash
  npx vitest
  ```

---

## Contributing & Code of Conduct

Please review our [Contributing Guidelines](./CONTRIBUTING.md) and [Code of Conduct](./CODE_OF_CONDUCT.md) before submitting pull requests.

## Security

To report a security vulnerability, please review our [Security Policy](./SECURITY.md).
