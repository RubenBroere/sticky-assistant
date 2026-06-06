import { SyncConfig } from './types';
import { resolveCalendarName } from './names';

const JOBS_LIST_KEY = 'calendarSync__jobsList';
const JOB_PREFIX_KEY = 'calendarSync__job__';

/**
 * Loads all calendar sync configurations from user properties.
 */
export function loadAllSyncConfigs(): SyncConfig[] {
  const props = PropertiesService.getUserProperties();
  const jobsListRaw = props.getProperty(JOBS_LIST_KEY);
  if (!jobsListRaw) return [];

  try {
    const ids: string[] = JSON.parse(jobsListRaw);
    const configs: SyncConfig[] = [];
    ids.forEach((id) => {
      const configRaw = props.getProperty(`${JOB_PREFIX_KEY}${id}`);
      if (configRaw) {
        configs.push(JSON.parse(configRaw));
      }
    });
    return configs;
  } catch (err) {
    console.error('Failed to parse sync configurations:', err);
    return [];
  }
}

/**
 * Saves a calendar sync configuration.
 */
export function saveSyncConfig(config: SyncConfig): void {
  const props = PropertiesService.getUserProperties();

  // Save individual configuration
  props.setProperty(`${JOB_PREFIX_KEY}${config.id}`, JSON.stringify(config));

  // Update master ID list
  const configs = loadAllSyncConfigs();
  const ids = configs.map((c) => c.id);
  if (!ids.includes(config.id)) {
    ids.push(config.id);
    props.setProperty(JOBS_LIST_KEY, JSON.stringify(ids));
  }
}

/**
 * Deletes a calendar sync configuration and optionally cleans up target events.
 */
export function deleteSyncConfig(id: string, deleteOption: string, targetCalendarId: string): void {
  const configs = loadAllSyncConfigs();
  const config = configs.find((c) => c.id === id);
  if (config) {
    cleanupTriggers(config);
  }

  // Remove configuration from storage
  const props = PropertiesService.getUserProperties();
  props.deleteProperty(`${JOB_PREFIX_KEY}${id}`);

  const updatedIds = configs.filter((c) => c.id !== id).map((c) => c.id);
  props.setProperty(JOBS_LIST_KEY, JSON.stringify(updatedIds));

  // Enqueue background deletion if we are not keeping everything
  if (deleteOption !== 'keep_all') {
    enqueueBackgroundDeletion(id, targetCalendarId, deleteOption);
  }
}

/**
 * Removes all synced events associated with a sync job from the target calendar.
 */
export function cleanupTargetEventsById(jobId: string, targetCalendarId: string): void {
  const targetCal = CalendarApp.getCalendarById(targetCalendarId);
  if (!targetCal) return;

  const now = new Date();
  // Wide sweep: clean up 12 months back and 24 months forward to ensure all synced events are wiped
  const startTime = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000);
  const endTime = new Date(now.getTime() + 24 * 30 * 24 * 60 * 60 * 1000);

  const targetEvents = targetCal.getEvents(startTime, endTime);
  targetEvents.forEach((event) => {
    if (event.getTag('syncJobId') === jobId) {
      try {
        event.deleteEvent();
      } catch (err) {
        console.warn(`Failed to delete target event ${event.getId()}:`, err);
      }
    }
  });
}

/**
 * Sets up the background execution triggers (real-time or hourly) for a sync configuration.
 */
export function setupTriggers(config: SyncConfig): void {
  // Clear any legacy triggers for safety
  cleanupTriggers(config);

  const triggers = ScriptApp.getProjectTriggers();
  const hasHourly = triggers.some((t) => t.getHandlerFunction() === 'handleHourlySync');
  if (!hasHourly) {
    try {
      ScriptApp.newTrigger('handleHourlySync').timeBased().everyHours(1).create();
    } catch (err: any) {
      console.error('Failed to create hourly trigger:', err);
      throw new Error(`Failed to create hourly trigger: ${err?.message || err}`, { cause: err });
    }
  }
}

export function cleanupTriggers(config: SyncConfig): void {
  const triggers = ScriptApp.getProjectTriggers();

  // If no other configs exist, remove the hourly trigger
  const allConfigs = loadAllSyncConfigs();
  const anyOtherConfig = allConfigs.some((c) => c.id !== config.id);
  if (!anyOtherConfig) {
    triggers.forEach((t) => {
      if (t.getHandlerFunction() === 'handleHourlySync') {
        try {
          ScriptApp.deleteTrigger(t);
        } catch (err) {
          console.warn('Failed to delete hourly trigger:', err);
        }
      }
    });
  }
}

/**
 * Runs the sync process for a combined calendar configuration.
 */
export function runSyncJob(config: SyncConfig): { ok: boolean; message?: string } {
  console.log(`[Job ${config.id}] Starting runSyncJob execution.`);
  try {
    let targetCalId = config.targetCalendarId;
    if (targetCalId === 'CREATE_NEW') {
      try {
        console.log(
          `[Job ${config.id}] Creating new target calendar named: ${config.calendar_name}`
        );
        const newCal = CalendarApp.createCalendar(config.calendar_name, {
          summary: `Target calendar created by Sticky Assistant for combined calendar: ${config.calendar_name}`,
        });
        targetCalId = newCal.getId();
        config.targetCalendarId = targetCalId;
        saveSyncConfig(config); // Save the resolved calendar ID
      } catch (calErr: any) {
        throw new Error(
          `Failed to create new calendar '${config.calendar_name}': ${calErr?.message || calErr}`,
          { cause: calErr }
        );
      }
    }

    const targetCal = CalendarApp.getCalendarById(targetCalId);
    if (!targetCal) {
      throw new Error(`Target calendar with ID '${targetCalId}' not found.`);
    }

    // Rename target calendar if name does not match configuration name (and it's not the primary calendar)
    try {
      const defaultCal = CalendarApp.getDefaultCalendar();
      if (
        targetCal.getName() !== config.calendar_name &&
        (!defaultCal || targetCal.getId() !== defaultCal.getId())
      ) {
        console.log(
          `[Job ${config.id}] Renaming target calendar to match sync config name: ${config.calendar_name}`
        );
        targetCal.setName(config.calendar_name);
      }
    } catch (renameErr) {
      console.warn(`[Job ${config.id}] Failed to rename target calendar:`, renameErr);
    }

    const now = new Date();
    const startTime = new Date(
      now.getTime() - config.syncRangeMonthsBack * 30 * 24 * 60 * 60 * 1000
    );
    const endTime = new Date(
      now.getTime() + config.syncRangeMonthsForward * 30 * 24 * 60 * 60 * 1000
    );

    // Initialize sync progress if not already in progress
    if (!config.syncProgress || !config.syncProgress.inProgress) {
      config.syncProgress = {
        lastProcessedIndex: -1,
        inProgress: true,
      };
      console.log(`[Job ${config.id}] Initialized new sync progress state.`);
    }

    const calService = (globalThis as any).Calendar;
    if (!calService || !calService.Events) {
      throw new Error('Calendar advanced service is not enabled. Please enable it in settings.');
    }

    const startTimeLimit = new Date().getTime();

    const sourceCalendarIds = Object.keys(config.sourceCalendars || {});
    // Process all remaining source calendars in a single execution
    while (
      config.syncProgress &&
      config.syncProgress.lastProcessedIndex + 1 < sourceCalendarIds.length
    ) {
      // Check elapsed time to prevent abrupt execution timeout (GAS limit is 6 minutes)
      const elapsed = new Date().getTime() - startTimeLimit;
      if (elapsed > 300000) {
        console.warn(
          `[Job ${config.id}] Sync job is close to timing out (elapsed: ${Math.round(
            elapsed / 1000
          )}s). Yielding to background trigger.`
        );
        enqueueBackgroundSync(config.id);
        return { ok: true, message: 'Yielded due to execution time limit.' };
      }

      const nextIndex: number = config.syncProgress.lastProcessedIndex + 1;
      const sourceCalId = sourceCalendarIds[nextIndex];
      const sourceCalName = resolveCalendarName(sourceCalId);
      config.statusMessage = `Syncing calendar ${nextIndex + 1}/${sourceCalendarIds.length}...`;
      saveSyncConfig(config);

      try {
        syncSingleSourceCalendar(
          config,
          sourceCalId,
          sourceCalName,
          targetCal,
          startTime,
          endTime,
          calService
        );
      } catch (syncErr: any) {
        console.error(`[Job ${config.id}] Error syncing calendar ${sourceCalName}:`, syncErr);
        throw syncErr;
      }

      // Update progress index
      if (config.syncProgress) {
        config.syncProgress.lastProcessedIndex = nextIndex;
      }
      saveSyncConfig(config);
    }

    // All source calendars processed successfully, mark done
    if (config.syncProgress) {
      config.syncProgress.inProgress = false;
    }
    config.status = 'active';
    config.lastSyncedAt = new Date().toISOString();
    delete config.statusMessage;
    saveSyncConfig(config);

    console.info(`[Job ${config.id}] runSyncJob completed successfully.`);
    return { ok: true };
  } catch (err: any) {
    console.error(`[Job ${config.id}] Sync failed:`, err);
    config.status = 'error';
    config.statusMessage = err?.message || String(err);
    if (config.syncProgress) {
      config.syncProgress.inProgress = false; // Reset progress on failure
    }
    saveSyncConfig(config);
    return { ok: false, message: err?.message || String(err) };
  }
}

/**
 * Safely retrieves the custom calendar name, checking both the direct ID (e.g. email) and fallback "primary".
 */
function getCustomCalendarName(
  config: SyncConfig,
  sourceCalId: string,
  defaultName: string
): string {
  if (!config.sourceCalendars) return defaultName;
  const calConf = config.sourceCalendars[sourceCalId];
  if (calConf && calConf.nickname) {
    return calConf.nickname;
  }
  if (sourceCalId === 'primary') {
    try {
      const primaryEmail = CalendarApp.getDefaultCalendar().getId();
      const primaryConf = config.sourceCalendars[primaryEmail];
      if (primaryConf && primaryConf.nickname) {
        return primaryConf.nickname;
      }
    } catch {
      // Ignore
    }
  } else {
    try {
      const primaryEmail = CalendarApp.getDefaultCalendar().getId();
      if (sourceCalId === primaryEmail) {
        const primaryConf = config.sourceCalendars['primary'];
        if (primaryConf && primaryConf.nickname) {
          return primaryConf.nickname;
        }
      }
    } catch {
      // Ignore
    }
  }
  return defaultName;
}

/**
 * Synchronizes events from a single source calendar to the target calendar.
 */
function syncSingleSourceCalendar(
  config: SyncConfig,
  sourceCalId: string,
  sourceCalName: string,
  targetCal: GoogleAppsScript.Calendar.Calendar,
  startTime: Date,
  endTime: Date,
  calService: any
): void {
  const sourceCalDisplayName = getCustomCalendarName(config, sourceCalId, sourceCalName);
  console.log(
    `[Job ${config.id}] Starting sync for source calendar: ${sourceCalDisplayName} (${sourceCalId})`
  );

  // 1. Fetch all existing target events in the time range
  const targetEvents = targetCal.getEvents(startTime, endTime);

  // 2. Map existing target events by their source key
  // Optimization: Only map target events that originate from this specific source calendar
  const targetEventsBySourceKey: Record<string, GoogleAppsScript.Calendar.CalendarEvent[]> = {};
  targetEvents.forEach((event) => {
    if (
      event.getTag('syncJobId') === config.id &&
      event.getTag('syncSourceCalendarId') === sourceCalId
    ) {
      const sourceKey = event.getTag('syncSourceEventId');
      if (sourceKey) {
        if (!targetEventsBySourceKey[sourceKey]) {
          targetEventsBySourceKey[sourceKey] = [];
        }
        targetEventsBySourceKey[sourceKey].push(event);
      }
    }
  });

  const targetMappedCount = Object.keys(targetEventsBySourceKey).length;
  console.log(
    `[Job ${config.id}] Target calendar: found ${targetEvents.length} total events in range, ${targetMappedCount} mapped to this source.`
  );

  const processedSourceKeys = new Set<string>();
  config.syncTokens = config.syncTokens || {};

  // 3. Sync events from this specific source calendar
  let lastSyncToken: string | undefined = config.syncTokens[sourceCalId];
  let pageToken: string | undefined = undefined;
  let items: any[] = [];
  let nextSyncToken: string | undefined = undefined;
  let isFullSync = !lastSyncToken;

  console.log(`[Job ${config.id}] Sync type: ${isFullSync ? 'Full Sync' : 'Incremental Sync'}`);

  do {
    const options: any = {
      singleEvents: true,
      maxResults: 250,
    };
    if (pageToken) {
      options.pageToken = pageToken;
    }

    if (isFullSync) {
      options.timeMin = startTime.toISOString();
      options.timeMax = endTime.toISOString();
      options.showDeleted = false;
    } else {
      options.syncToken = lastSyncToken;
      options.showDeleted = true;
    }

    let response: any;
    try {
      response = calService.Events.list(sourceCalId, options);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (
        errMsg.includes('410') ||
        errMsg.includes('Gone') ||
        errMsg.includes('syncToken') ||
        !isFullSync
      ) {
        console.warn(
          `[Job ${config.id}] Sync token expired or invalid for calendar ${sourceCalId}. Re-running full sync.`,
          err
        );
        isFullSync = true;
        pageToken = undefined;
        items = [];
        lastSyncToken = undefined;
        continue;
      } else {
        throw err;
      }
    }

    if (response.items) {
      items = items.concat(response.items);
    }
    pageToken = response.nextPageToken;
    nextSyncToken = response.nextSyncToken;
  } while (pageToken);

  if (nextSyncToken) {
    config.syncTokens[sourceCalId] = nextSyncToken;
  }

  console.log(`[Job ${config.id}] Retrieved ${items.length} events from source calendar.`);

  const stats = { created: 0, updated: 0, unchanged: 0, deleted: 0 };

  // Process fetched events
  items.forEach((sourceEvent) => {
    processSourceEvent(
      sourceEvent,
      config,
      sourceCalId,
      sourceCalDisplayName,
      targetCal,
      targetEvents,
      startTime,
      endTime,
      targetEventsBySourceKey,
      processedSourceKeys,
      isFullSync,
      stats
    );
  });

  // 4. Delete target events that were deleted in source calendars
  // (ONLY for the specific source calendar if it performed a Full Sync)
  if (isFullSync) {
    Object.keys(targetEventsBySourceKey).forEach((key) => {
      if (!processedSourceKeys.has(key)) {
        const eventsToDelete = targetEventsBySourceKey[key];
        eventsToDelete.forEach((event) => {
          try {
            event.deleteEvent();
            stats.deleted++;
          } catch (deleteErr) {
            console.error(
              `[Job ${config.id}] Failed to delete obsolete target event for ${key}:`,
              deleteErr
            );
          }
        });
      }
    });
  }

  console.info(
    `[Job ${config.id}] Completed calendar sync for: ${sourceCalDisplayName}. ` +
      `Created: ${stats.created}, Updated: ${stats.updated}, Unchanged: ${stats.unchanged}, Deleted: ${stats.deleted}`
  );
}

/**
 * Processes a single event from the source calendar and updates/creates the target event.
 */
function processSourceEvent(
  sourceEvent: any,
  config: SyncConfig,
  sourceCalId: string,
  sourceCalName: string,
  targetCal: GoogleAppsScript.Calendar.Calendar,
  targetEvents: GoogleAppsScript.Calendar.CalendarEvent[],
  startTime: Date,
  endTime: Date,
  targetEventsBySourceKey: Record<string, GoogleAppsScript.Calendar.CalendarEvent[]>,
  processedSourceKeys: Set<string>,
  isFullSync: boolean,
  stats: { created: number; updated: number; unchanged: number; deleted: number }
): void {
  const isDeleted = sourceEvent.status === 'cancelled';
  const shouldSkip = config.syncOnlyBusyEvents && sourceEvent.transparency === 'transparent';

  if (isDeleted || shouldSkip) {
    // Deletion handling: remove matching target events
    const targetEventsToDelete = targetEvents.filter((e) => {
      if (e.getTag('syncJobId') !== config.id) return false;
      if (e.getTag('syncSourceCalendarId') !== sourceCalId) return false;
      const sourceKey = e.getTag('syncSourceEventId') || '';
      return sourceKey === sourceEvent.id || sourceKey.startsWith(sourceEvent.id + '_');
    });

    targetEventsToDelete.forEach((e) => {
      try {
        e.deleteEvent();
        stats.deleted++;
      } catch (delErr) {
        console.warn(`[Job ${config.id}] Failed to delete cancelled event ${e.getId()}:`, delErr);
      }
    });
    return;
  }

  // Determine start & end times
  let start: Date;
  let end: Date;
  let isAllDay = false;

  if (sourceEvent.start.date) {
    start = new Date(sourceEvent.start.date);
    end = new Date(sourceEvent.end.date);
    isAllDay = true;
  } else if (sourceEvent.start.dateTime) {
    start = new Date(sourceEvent.start.dateTime);
    end = new Date(sourceEvent.end.dateTime);
  } else {
    return; // Skip invalid events
  }

  const uniqueSourceKey = `${sourceEvent.id}_${start.getTime()}`;

  // Verify if event is within our sync window
  const inWindow = start >= startTime && start <= endTime;

  if (!inWindow) {
    // If event is shifted out of window, delete any existing target event
    const existingEvents = targetEventsBySourceKey[uniqueSourceKey] || [];
    existingEvents.forEach((e) => {
      try {
        e.deleteEvent();
        stats.deleted++;
      } catch (delErr) {
        console.warn(
          `[Job ${config.id}] Failed to delete out-of-bounds event ${e.getId()}:`,
          delErr
        );
      }
    });
    return;
  }

  if (isFullSync) {
    processedSourceKeys.add(uniqueSourceKey);
  }

  const isMasked = config.syncPrivacy === 'calendarName';
  const eventTitle =
    config.syncPrivacy === 'calendarName' ? sourceCalName : sourceEvent.summary || 'Untitled Event';
  const title = formatPrefix(config.event_prefix) + eventTitle;
  const description = isMasked ? '' : sourceEvent.description || '';
  const location = isMasked ? '' : sourceEvent.location || '';

  const existingEvents = targetEventsBySourceKey[uniqueSourceKey] || [];

  if (existingEvents.length > 0) {
    const targetEvent = existingEvents[0];
    let needsUpdate = false;

    if (targetEvent.getTitle() !== title) needsUpdate = true;
    if (targetEvent.getDescription() !== description) needsUpdate = true;
    if (targetEvent.getLocation() !== location) needsUpdate = true;
    if (targetEvent.getStartTime().getTime() !== start.getTime()) needsUpdate = true;
    if (targetEvent.getEndTime().getTime() !== end.getTime()) needsUpdate = true;
    if (targetEvent.isAllDayEvent() !== isAllDay) needsUpdate = true;
    if (targetEvent.getTag('syncSourceCalendarId') !== sourceCalId) needsUpdate = true;

    if (needsUpdate) {
      try {
        // Only update time if it has changed
        if (targetEvent.isAllDayEvent() !== isAllDay) {
          if (isAllDay) {
            targetEvent.setAllDayDates(start, end);
          } else {
            targetEvent.setTime(start, end);
          }
        } else if (
          targetEvent.getStartTime().getTime() !== start.getTime() ||
          targetEvent.getEndTime().getTime() !== end.getTime()
        ) {
          if (isAllDay) {
            targetEvent.setAllDayDates(start, end);
          } else {
            targetEvent.setTime(start, end);
          }
        }

        // Only update text properties that have changed
        if (targetEvent.getTitle() !== title) {
          targetEvent.setTitle(title);
        }
        if (targetEvent.getDescription() !== description) {
          targetEvent.setDescription(description);
        }
        if (targetEvent.getLocation() !== location) {
          targetEvent.setLocation(location);
        }
        if (targetEvent.getTag('syncSourceCalendarId') !== sourceCalId) {
          targetEvent.setTag('syncSourceCalendarId', sourceCalId);
        }

        stats.updated++;
      } catch (updateErr) {
        console.error(
          `[Job ${config.id}] Failed to update target event for ${uniqueSourceKey}:`,
          updateErr
        );
      }
    } else {
      stats.unchanged++;
    }
  } else {
    // Create new target event
    try {
      let newEvent: GoogleAppsScript.Calendar.CalendarEvent;
      if (isAllDay) {
        newEvent = targetCal.createAllDayEvent(title, start, end, {
          description,
          location,
        });
      } else {
        newEvent = targetCal.createEvent(title, start, end, {
          description,
          location,
        });
      }
      newEvent.setTag('syncJobId', config.id);
      newEvent.setTag('syncSourceEventId', uniqueSourceKey);
      newEvent.setTag('syncSourceCalendarId', sourceCalId);
      stats.created++;
    } catch (createErr) {
      console.error(
        `[Job ${config.id}] Failed to create target event for ${uniqueSourceKey}:`,
        createErr
      );
    }
  }
}

/**
 * Periodic entry point for hourly calendar updates.
 */
export function handleHourlySync(): void {
  const configs = loadAllSyncConfigs();
  configs.forEach((config) => {
    runSyncJob(config);
  });
}

const PENDING_QUEUE_KEY = 'calendarSync__pendingQueue';

/**
 * Enqueues a sync job for background execution and schedules a one-off trigger.
 */
export function enqueueBackgroundSync(jobId: string): boolean {
  const props = PropertiesService.getUserProperties();
  let queue: string[] = [];
  try {
    const rawQueue = props.getProperty(PENDING_QUEUE_KEY);
    if (rawQueue) queue = JSON.parse(rawQueue);
  } catch (err) {
    console.warn('Failed to parse pending sync queue:', err);
  }

  if (!queue.includes(jobId)) {
    queue.push(jobId);
    props.setProperty(PENDING_QUEUE_KEY, JSON.stringify(queue));
  }

  // Schedule one-off trigger to process the queue
  try {
    ScriptApp.newTrigger('handleBackgroundInitialSync')
      .timeBased()
      .after(1000) // 1 second
      .create();
    return true;
  } catch (err) {
    console.warn('Failed to register background initial sync trigger:', err);
    return false; // Trigger limit reached or permission issue, fallback to sync
  }
}

/**
 * Handles background initial sync trigger, cleans itself up, and executes pending sync jobs.
 */
export function handleBackgroundInitialSync(e: any): void {
  // Cleanup the trigger that fired
  if (e && e.triggerUid) {
    try {
      const triggers = ScriptApp.getProjectTriggers();
      const currentTrigger = triggers.find((t) => t.getUniqueId() === e.triggerUid);
      if (currentTrigger) {
        ScriptApp.deleteTrigger(currentTrigger);
      }
    } catch (err) {
      console.warn('Failed to delete background sync trigger:', err);
    }
  }

  // Fetch queue
  const props = PropertiesService.getUserProperties();
  let queue: string[] = [];
  try {
    const rawQueue = props.getProperty(PENDING_QUEUE_KEY);
    if (rawQueue) queue = JSON.parse(rawQueue);
  } catch (err) {
    console.warn('Failed to parse queue during execution:', err);
  }

  // Clear queue
  props.deleteProperty(PENDING_QUEUE_KEY);

  // Process each job
  if (queue.length > 0) {
    const configs = loadAllSyncConfigs();
    queue.forEach((jobId) => {
      const config = configs.find((c) => c.id === jobId);
      if (config) {
        runSyncJob(config);
      }
    });
  }
}

const PENDING_DELETION_PREFIX = 'calendarSync__pendingDeletion__';

/**
 * Enqueues a sync job deletion task for background execution.
 */
export function enqueueBackgroundDeletion(
  jobId: string,
  targetCalendarId: string,
  deleteOption: string
): void {
  const props = PropertiesService.getUserProperties();
  const data = { targetCalendarId, deleteOption };
  props.setProperty(`${PENDING_DELETION_PREFIX}${jobId}`, JSON.stringify(data));

  try {
    ScriptApp.newTrigger('handleBackgroundDeletion')
      .timeBased()
      .after(1000) // 1 second
      .create();
  } catch (err) {
    console.warn('Failed to register background deletion trigger:', err);
    // Fallback: run synchronously if background scheduling fails
    executeDeletionLogic(jobId, targetCalendarId, deleteOption);
  }
}

/**
 * Handles background deletion trigger, cleans itself up, and executes pending deletions.
 */
export function handleBackgroundDeletion(e: any): void {
  // Cleanup trigger
  if (e && e.triggerUid) {
    try {
      const triggers = ScriptApp.getProjectTriggers();
      const currentTrigger = triggers.find((t) => t.getUniqueId() === e.triggerUid);
      if (currentTrigger) {
        ScriptApp.deleteTrigger(currentTrigger);
      }
    } catch (err) {
      console.warn('Failed to delete background deletion trigger:', err);
    }
  }

  const props = PropertiesService.getUserProperties();
  const keys = props.getKeys();
  const deletionKeys = keys.filter((k) => k.startsWith(PENDING_DELETION_PREFIX));

  deletionKeys.forEach((key) => {
    const jobId = key.substring(PENDING_DELETION_PREFIX.length);
    const rawData = props.getProperty(key);
    props.deleteProperty(key); // Clear from queue

    if (rawData) {
      try {
        const { targetCalendarId, deleteOption } = JSON.parse(rawData);
        executeDeletionLogic(jobId, targetCalendarId, deleteOption);
      } catch (err) {
        console.error(`Failed to execute background deletion for key ${key}:`, err);
      }
    }
  });
}

/**
 * Shared deletion helper.
 */
function executeDeletionLogic(jobId: string, targetCalendarId: string, deleteOption: string): void {
  if (deleteOption === 'delete_calendar') {
    try {
      const targetCal = CalendarApp.getCalendarById(targetCalendarId);
      if (targetCal) {
        // Safe check: do not delete the default primary calendar
        const defaultCal = CalendarApp.getDefaultCalendar();
        if (defaultCal && targetCal.getId() !== defaultCal.getId()) {
          targetCal.deleteCalendar();
        } else {
          // Primary calendar fallback: delete events only
          cleanupTargetEventsById(jobId, targetCalendarId);
        }
      }
    } catch (err) {
      console.error(`Failed to delete target calendar ${targetCalendarId}:`, err);
    }
  } else if (deleteOption === 'delete_events') {
    cleanupTargetEventsById(jobId, targetCalendarId);
  }
}

/**
 * Formats a prefix string to be wrapped in square brackets, with leading/trailing brackets/spaces stripped first.
 */
export function formatPrefix(prefix: string): string {
  if (!prefix) return '';
  let clean = prefix.trim();
  while (clean.startsWith('[')) {
    clean = clean.substring(1).trim();
  }
  while (clean.endsWith(']')) {
    clean = clean.substring(0, clean.length - 1).trim();
  }
  if (!clean) return '';
  return `[${clean}] `;
}
