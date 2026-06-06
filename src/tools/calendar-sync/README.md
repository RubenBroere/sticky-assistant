# Calendar Sync

Combine multiple personal and shared calendars into a single, auto-syncing target calendar with advanced privacy masking and custom nickname overrides.

## Architecture & Code Structure

- [tool.ts](./tool.ts): Registers the tool for calendar-specific triggers (`TriggerEvent.CALENDAR_HOMEPAGE`).
- [cards.ts](./cards.ts): Renders the main sync job list, sync creation forms (including collapsible calendar nickname inputs), edit forms, and delete confirmation cards.
- [sync.ts](./sync.ts): The core sync engine. It fetches calendar events, processes privacy exclusions, masks descriptions, checks for changes, updates events on the target calendar, and manages Apps Script Time Triggers.
- [types.ts](./types.ts): Schema definition for the dictionary-based sync configuration.
- [names.ts](./names.ts): Helper functions to map and resolve system calendar IDs to readable names.

## Core Mechanisms

### 1. Dictionary-Based Configuration Schema

The sync configurations use a dictionary-based structure to map calendar options cleanly:

```typescript
export interface SyncConfig {
  id: string;
  calendar_name: string;
  targetCalendarId: string;
  sourceCalendars: Record<string, { nickname?: string }>; // Dictionary mapping
  event_prefix: string;
  syncPrivacy: 'full' | 'calendarName';
  syncOnlyBusyEvents: boolean;
  syncRangeMonthsBack: number;
  syncRangeMonthsForward: number;
  status: 'active' | 'error';
  lastSyncedAt?: number;
}
```

### 2. Synchronization Engine & State Machine

The sync engine operates by comparing event hashes between the sources and target calendars:

1. **Fetch window**: Queries events in the range defined by `syncRangeMonthsBack` and `syncRangeMonthsForward`.
2. **Privacy Filter**:
   - `full`: Copies description, location, and title.
   - `calendarName`: Replaces title with either the calendar's nickname (e.g. `[Work]`) or a generic `Busy` placeholder, completely clearing descriptions and locations.
3. **Change Detection**: Computes a hash of the event details. Updates or creates target calendar events only if details differ.
4. **Hourly Trigger**: Registers a single, global project-wide time trigger that runs `handleHourlySync()` to synchronize all configurations automatically.

### 3. Circular Mapping Prevention

The save action validates that the target calendar ID is not present in the list of source calendars. This ensures the engine never enters an infinite self-triggering sync loop.
