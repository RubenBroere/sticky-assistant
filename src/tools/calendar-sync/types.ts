export interface SyncConfig {
  id: string;                          // Unique ID for the sync job
  name: string;                        // User-friendly name of the job
  sourceCalendarIds: string[];         // Source calendar IDs to sync from
  targetCalendarId: string;            // Target calendar ID to sync to
  prefix: string;                      // Prefix prepended to event titles (e.g. "[Work]")
  syncPrivacy: 'full' | 'busy';         // Sync mode: full detail vs busy block only
  syncOnlyBusyEvents: boolean;         // If true, skip events marked transparent/free
  syncRangeMonthsBack: number;         // Time range: months in past to look back
  syncRangeMonthsForward: number;      // Time range: months in future to look forward
  syncMethod: 'realtime' | 'hourly';     // Execution strategy: realtime trigger vs hourly batch
  triggerIds: Record<string, string>;   // Map of sourceCalendarId -> script trigger UID
  lastSyncedAt?: string;               // ISO Timestamp of the last sync run
  status?: 'active' | 'error';         // Status of sync job
  statusMessage?: string;              // Error detail message if status is 'error'
  syncTokens?: Record<string, string>;  // Maps sourceCalendarId -> lastSyncToken for incremental sync
  syncProgress?: {
    lastProcessedIndex: number;
    inProgress: boolean;
  };
}
