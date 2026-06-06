# Comments Extractor

View and export comments and annotations from PDF files directly within Google Drive.

## Architecture & Code Structure

The tool consists of:

- [tool.ts](./tool.ts): Registers the tool triggers in the core layout:
  - `DEFAULT_HOMEPAGE`: General homepage selector.
  - `ITEMS_SELECTED`: Enables only when a single file is selected in Drive.
- [cards.ts](./cards.ts): Renders the main comments checklist, summary metrics, export parameters, and final sheet links.
- [scanning.ts](./scanning.ts): Resolves PDF binary structures and extracts annotations, comments, highlights, and author properties.
- [editing.ts](./editing.ts): Integrates with Google Sheets to create new files, format grids, and populate them with comments data.
- [config.ts](./config.ts): Configuration parser.
- [settings.ts](./settings.ts): Schema definition for the Comments Extractor.

## Core Mechanisms

### 1. File Selection Filter

The tool is built to operate exclusively on single PDF files inside Google Drive. The `enabled` trigger validation verifies:

```typescript
const selectedItems = e.drive?.selectedItems ?? [];
return selectedItems.length === 1 && selectedItems[0].mimeType === 'application/pdf';
```

### 2. Annotation Parsing

Using standard Google Apps Script properties, the tool fetches the PDF binary stream and extracts comments, highlights, and annotations including metadata like:

- Comment Author / Creator
- Creation Date / Time
- Comment Text / Content

### 3. Google Sheets Exporter

The export button executes `exportCommentsToSheet` which:

1. Creates a new Spreadsheet using `SpreadsheetApp.create()`.
2. Automatically styles header cells with custom theme colors.
3. Appends all extracted comments.
4. Generates an interactive success card link to directly open the sheet in a new tab.
