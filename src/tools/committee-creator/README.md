# Committee Creator

Clones and rolls forward entire folder structures in Google Drive for the next academic year. It automatically detects year patterns in folders and files and increments them dynamically (e.g. `2025-2026` becomes `2026-2027`).

## Architecture & Code Structure

- [tool.ts](./tool.ts): Registers the tool in the active list.
  - `ITEMS_SELECTED`: Enabled only when a single folder in Google Drive is selected.
- [cards.ts](./cards.ts): Renders the main roll-forward options, configuration overrides, and folder checklist.
- [scanning.ts](./scanning.ts): Traverses Drive folders recursively to map out the templates structure.
- [editing.ts](./editing.ts): Executes folder copying, year substitutions, permissions copying, and link updates.
- [config.ts](./config.ts) & [settings.ts](./settings.ts): Schema definition and overrides support.

## Core Mechanisms

### 1. Drive Selection Validation

The tool is enabled only when a single folder is selected in Google Drive:

```typescript
const selectedItems = e.drive?.selectedItems ?? [];
return (
  selectedItems.length === 1 && selectedItems[0].mimeType === 'application/vnd.google-apps.folder'
);
```

### 2. Year Substitutions (Roll Forward Algorithm)

The folder cloner searches for academic year strings matching formats like:

- `YYYY-YYYY` (e.g. `2025-2026`)
- `YYYY/YYYY` (e.g. `2025/2026`)
- `YYYY` (e.g. `2025`)
  These matches are parsed, and the years are incremented by 1 (e.g. `2025-2026` -> `2026-2027`) on both the folders and any copied template filenames.

### 3. Recursive Traversal

The cloner traverses subfolders recursively using `DriveApp`:

1. Copies the parent folder structure.
2. Clones all underlying files (like Google Docs, Sheets, and Slides templates).
3. Optionally retains existing user permissions or creates fresh directories.
