export interface SourceCalendarConf {
  nickname?: string;
}

export interface SyncConfig {
  id: string; // Unique ID for the sync job
  calendar_name: string; // Calendar name for display purposes
  sourceCalendars: Record<string, SourceCalendarConf>; // Map of source calendar ID -> calendar sync config
  targetCalendarId: string; // Target calendar ID to sync to
  event_prefix: string; // Prefix prepended to event titles
  syncPrivacy: 'full' | 'calendarName'; // Sync mode: full detail vs calendar name
  syncOnlyBusyEvents: boolean; // If true, skip events marked transparent/free
  syncRangeMonthsBack: number; // Time range: months in past to look back
  syncRangeMonthsForward: number; // Time range: months in future to look forward
  lastSyncedAt?: string; // ISO Timestamp of the last sync run
  status?: 'active' | 'error'; // Status of sync job
  statusMessage?: string; // Error detail message if status is 'error'
  syncTokens?: Record<string, string>; // Maps sourceCalendarId -> lastSyncToken for incremental sync
  syncProgress?: {
    lastProcessedIndex: number;
    inProgress: boolean;
  };
}
