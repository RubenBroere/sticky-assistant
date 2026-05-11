# Sticky Assistant

A multi-tool Google Workspace add-on suite for Sticky.

## Tools

- Sticky Assistant - Action Points
  - Scan Google Docs for action points and optionally sync to Todoist.
- Sticky Assistant - Committees
  - Clone committee folder structures and update year placeholders.

## Structure

- action-points/ - Action Points tool implementation (ActionPoints*.js)
- committee/ - Committee tool implementation (Committee*.js)
- core/ - Shared utilities (branding, localization)

## Deployment Notes

- The add-on uses combined scopes (Docs + Drive) to support all tools.
- Docs add-on entry point: onHomepage
- Drive selection entry point: onDriveSelection

## Install To Your Own Workspace

This repo supports personal deployments. Each developer uses their own Apps Script project and local .clasp.json.

1. Install clasp:
  - npm install -g @google/clasp
2. Login to Google:
  - clasp login
3. Create a new Apps Script project:
  - clasp create --type standalone --title "Sticky Assistant"
4. Copy the template config and set your script ID:
  - Copy .clasp.json.template to .clasp.json
  - Replace YOUR_SCRIPT_ID with the script ID from the previous step
5. Push files to your project:
  - clasp push
6. Open Apps Script to configure add-on details if needed:
  - clasp open

## One-Click Setup Scripts

- Linux/macOS: scripts/setup-appsscript.sh
- Windows (PowerShell): scripts/setup-appsscript.ps1

Both scripts will:
- Install clasp if missing
- Log in to Google
- Create a new Apps Script project
- Generate .clasp.json from .clasp.json.template
- Push files and open the project

## Multi-User Workflow

- .clasp.json is user-specific and is ignored by git.
- Use .clasp.json.template as a template for new environments.
- Each developer should deploy their own version from their Apps Script project.

## Local Development

- Update appsscript.json after structural changes.
- Keep tool names aligned with core/Branding.js.
