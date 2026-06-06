# Action Points Extractor

Scan Google Documents for real-time action items, compile progress, check them off in-place, and optionally synchronize them directly to Todoist.

## Architecture & Code Structure

The tool is organized into modular files:

- [tool.ts](./tool.ts): Registers the tool in the Sticky Assistant ecosystem and binds it to the Google Docs homepage trigger (`TriggerEvent.DOCS_HOMEPAGE`).
- [cards.ts](./cards.ts): Renders the main scanned list, configuration overrides editor, and people setup overlays.
- [scanning.ts](./scanning.ts): Parsers and scans the document structure. It reads paragraphs, tables, list items, and list styles to extract tasks.
- [editing.ts](./editing.ts): Applies modifications back to the active Google Doc. It inserts/appends the checklist summary at the top of the document.
- [config.ts](./config.ts): Handles loading, saving, and type-checking of settings schemas.
- [settings.ts](./settings.ts): Schema definition for Action Points configurations (e.g. assignee names, Todoist tokens, project mappings).

## Core Mechanisms

### 1. Action Point Detection (Regex Pattern)

We scan paragraph, table-cell, and list-item contents using regex matching:

```typescript
/^(?:ap|action\s*point)\s+([^:]+):\s*(.+)$/i;
```

- **Split assignee list**: Split assignees dynamically using commas, `and`, `&`, or the Dutch `en` (e.g. `AP Ruben, John en Alice: task`).
- **Whole Team Assignment**: Triggered by English `everyone` or Dutch `iedereen` keywords to automatically map the task to all active assignees.
- **Due Dates**: Parsed from trailing `[YYYY-MM-DD]` patterns inside the task description.

### 2. Document Highlighting & Navigation

When a user clicks the **Show** button next to a scanned task in the Card UI, the add-on runs `jumpToTask` which:

1. Locates the paragraph matching the task text.
2. Creates a new selection range focusing on that element.
3. Sets the user's cursor position in the Google Doc editor, triggering an automatic scroll to highlight the item.

### 3. Todoist Integration

If `Todoist Sync` is enabled in settings:

- We use `UrlFetchApp` to execute REST API requests to the Todoist API (`/v2/tasks`).
- Secrets (such as the `todoistToken`) are stored securely on the Global Layer and are blocked from being saved to local workspace override files.
