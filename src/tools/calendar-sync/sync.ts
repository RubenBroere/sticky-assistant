import { SyncConfig } from './types';

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
      throw new Error(`Failed to create hourly trigger: ${err?.message || err}`);
    }
  }
}

export function cleanupTriggers(config: SyncConfig): void {
  const triggers = ScriptApp.getProjectTriggers();

  // Cleanup legacy individual triggers if they exist in the config
  if (config.triggerIds) {
    const triggerIdsToDelete = new Set(Object.values(config.triggerIds));
    triggers.forEach((t) => {
      if (triggerIdsToDelete.has(t.getUniqueId())) {
        try {
          ScriptApp.deleteTrigger(t);
        } catch (err) {
          console.warn(`Failed to delete legacy trigger ${t.getUniqueId()}:`, err);
        }
      }
    });
  }

  config.triggerIds = {};

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
  try {
    let targetCalId = config.targetCalendarId;
    if (targetCalId === 'CREATE_NEW') {
      try {
        const newCal = CalendarApp.createCalendar(config.name, {
          summary: `Target calendar created by Sticky Assistant for combined calendar: ${config.name}`,
        });
        targetCalId = newCal.getId();
        config.targetCalendarId = targetCalId;
        saveSyncConfig(config); // Save the resolved calendar ID
      } catch (calErr: any) {
        throw new Error(`Failed to create new calendar '${config.name}': ${calErr?.message || calErr}`);
      }
    }

    const targetCal = CalendarApp.getCalendarById(targetCalId);
    if (!targetCal) {
      throw new Error(`Target calendar with ID '${targetCalId}' not found.`);
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
    }

    const nextIndex = config.syncProgress.lastProcessedIndex + 1;
    if (nextIndex >= config.sourceCalendarIds.length) {
      // All calendars processed, mark done
      config.syncProgress.inProgress = false;
      config.status = 'active';
      config.lastSyncedAt = new Date().toISOString();
      delete config.statusMessage;
      saveSyncConfig(config);
      return { ok: true };
    }

    const sourceCalId = config.sourceCalendarIds[nextIndex];
    config.statusMessage = `Syncing calendar ${nextIndex + 1}/${config.sourceCalendarIds.length}...`;
    saveSyncConfig(config);

    // 1. Fetch all existing target events in the time range
    const targetEvents = targetCal.getEvents(startTime, endTime);

    // 2. Map existing target events by their source key
    // Optimization: Only map target events that originate from this specific source calendar
    const targetEventsBySourceKey: Record<string, GoogleAppsScript.Calendar.CalendarEvent[]> = {};
    targetEvents.forEach((event) => {
      if (event.getTag('syncJobId') === config.id && event.getTag('syncSourceCalendarId') === sourceCalId) {
        const sourceKey = event.getTag('syncSourceEventId');
        if (sourceKey) {
          if (!targetEventsBySourceKey[sourceKey]) {
            targetEventsBySourceKey[sourceKey] = [];
          }
          targetEventsBySourceKey[sourceKey].push(event);
        }
      }
    });

    const processedSourceKeys = new Set<string>();
    config.syncTokens = config.syncTokens || {};

    const calService = (globalThis as any).Calendar;
    if (!calService || !calService.Events) {
      throw new Error('Calendar advanced service is not enabled. Please enable it in settings.');
    }

    // 3. Sync events from this specific source calendar
    let lastSyncToken = config.syncTokens ? config.syncTokens[sourceCalId] : undefined;
    let pageToken: string | undefined = undefined;
    let items: any[] = [];
    let nextSyncToken: string | undefined = undefined;
    let isFullSync = !lastSyncToken;

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
        if (errMsg.includes('410') || errMsg.includes('Gone') || errMsg.includes('syncToken') || !isFullSync) {
          console.warn(`Sync token expired or invalid for calendar ${sourceCalId}. Re-running full sync.`, err);
          isFullSync = true;
          pageToken = undefined;
          items = [];
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

    if (nextSyncToken && config.syncTokens) {
      config.syncTokens[sourceCalId] = nextSyncToken;
    }

    // Process fetched events
    items.forEach((sourceEvent) => {
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
          } catch (delErr) {
            console.warn(`Failed to delete cancelled event ${e.getId()}:`, delErr);
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
          } catch (delErr) {
            console.warn(`Failed to delete out-of-bounds event ${e.getId()}:`, delErr);
          }
        });
        return;
      }

      if (isFullSync) {
        processedSourceKeys.add(uniqueSourceKey);
      }

      const title =
        config.prefix +
        (config.syncPrivacy === 'busy' ? 'Busy' : sourceEvent.summary || 'Untitled Event');
      const description = config.syncPrivacy === 'busy' ? '' : sourceEvent.description || '';
      const location = config.syncPrivacy === 'busy' ? '' : sourceEvent.location || '';

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
            if (isAllDay) {
              targetEvent.setAllDayDates(start, end);
            } else {
              targetEvent.setTime(start, end);
            }
            targetEvent.setTitle(title);
            targetEvent.setDescription(description);
            targetEvent.setLocation(location);
            targetEvent.setTag('syncSourceCalendarId', sourceCalId);
          } catch (updateErr) {
            console.error(`Failed to update target event for ${uniqueSourceKey}:`, updateErr);
          }
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
        } catch (createErr) {
          console.error(`Failed to create target event for ${uniqueSourceKey}:`, createErr);
        }
      }
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
            } catch (deleteErr) {
              console.error(`Failed to delete obsolete target event for ${key}:`, deleteErr);
            }
          });
        }
      });
    }

    // Update progress index
    config.syncProgress.lastProcessedIndex = nextIndex;

    // Check if we are done with all source calendars
    if (nextIndex === config.sourceCalendarIds.length - 1) {
      config.syncProgress.inProgress = false;
      config.status = 'active';
      config.lastSyncedAt = new Date().toISOString();
      delete config.statusMessage;
      saveSyncConfig(config);
    } else {
      // Continue next source calendar in background
      saveSyncConfig(config);
      enqueueBackgroundSync(config.id);
    }

    return { ok: true };
  } catch (err: any) {
    console.error(`Sync failed for job ${config.id}:`, err);
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
function executeDeletionLogic(
  jobId: string,
  targetCalendarId: string,
  deleteOption: string
): void {
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
