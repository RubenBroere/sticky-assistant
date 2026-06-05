import { buildToolCard, buildToolFooter } from '../../core/cardTemplate';
import { COLORS } from '../../core/branding';
import { SyncConfig } from './types';
import {
  loadAllSyncConfigs,
  saveSyncConfig,
  deleteSyncConfig,
  runSyncJob,
  setupTriggers,
  enqueueBackgroundSync,
} from './sync';
import { getCalendarNamesMap, resolveCalendarName } from './names';

const TOOL_META = {
  id: 'calendarSync',
  name: 'Calendar Sync',
  icon: CardService.Icon.CLOCK,
};

/**
 * Renders the home dashboard card listing all active sync jobs.
 */
export function createCalendarSyncHomepage(e: any): GoogleAppsScript.Card_Service.Card {
  const builder = buildToolCard(TOOL_META, 'Combine multiple calendars into one target calendar and keep them synchronized.');

  const configs = loadAllSyncConfigs();

  const syncSection = CardService.newCardSection().setHeader('Your Combined Calendars');

  if (configs.length === 0) {
    syncSection.addWidget(
      CardService.newDecoratedText()
        .setText('<b>No Combined Calendars Configured Yet</b>')
        .setBottomLabel('Combine your personal and shared calendars into a unified view.')
        .setWrapText(true)
    );
  } else {
    configs.forEach((config) => {
      let statusStr = '';
      if (config.status === 'active') {
        const lastSync = config.lastSyncedAt
          ? new Date(config.lastSyncedAt).toLocaleTimeString()
          : 'never';
        statusStr = `<font color="${COLORS.SUCCESS}">🟢 Active</font> (Last sync: ${lastSync})`;
      } else if (config.status === 'error') {
        statusStr = `<font color="${COLORS.ERROR}">🔴 Error</font>: ${config.statusMessage || 'Sync failed'}`;
      } else {
        statusStr = '<font color="#5f6368">⚪ Pending Initial Sync</font>';
      }

      const detailText = `<b>${config.name}</b>\n` +
        `Target: ${getCalendarNameSafely(config.targetCalendarId)}\n` +
        `Sources: ${config.sourceCalendarIds.length} calendars\n` +
        `Status: ${statusStr}`;

      const editAction = CardService.newAction()
        .setFunctionName('openEditJobCard')
        .setParameters({ jobId: config.id });

      const deleteAction = CardService.newAction()
        .setFunctionName('openDeleteJobConfirmCard')
        .setParameters({ jobId: config.id });

      const syncAction = CardService.newAction()
        .setFunctionName('triggerSyncManual')
        .setParameters({ jobId: config.id });

      const buttonSet = CardService.newButtonSet()
        .addButton(
          CardService.newTextButton()
            .setText('Sync')
            .setOnClickAction(syncAction)
        )
        .addButton(
          CardService.newTextButton()
            .setText('Edit')
            .setOnClickAction(editAction)
        )
        .addButton(
          CardService.newTextButton()
            .setText('Delete')
            .setOnClickAction(deleteAction)
        );

      syncSection.addWidget(
        CardService.newDecoratedText()
          .setText(detailText)
          .setWrapText(true)
      );
      syncSection.addWidget(buttonSet);
    });
  }

  // Create Combined Calendar button
  const createAction = CardService.newAction().setFunctionName('openCreateJobCard');
  syncSection.addWidget(
    CardService.newTextButton()
      .setText('➕ Create Combined Calendar')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(createAction)
  );

  builder.addSection(syncSection);
  builder.addSection(buildToolFooter('calendarSync', false));

  return builder.build();
}

/**
 * Returns the name of a calendar, or its ID as fallback.
 */
function getCalendarNameSafely(calendarId: string): string {
  return resolveCalendarName(calendarId);
}

/**
 * Navigates to the Create configuration card.
 */
export function openCreateJobCard(e: any): GoogleAppsScript.Card_Service.Card {
  return createEditSyncJobCard(null);
}

/**
 * Navigates to the Edit configuration card.
 */
export function openEditJobCard(e: any): GoogleAppsScript.Card_Service.Card {
  const jobId = e.parameters.jobId;
  const configs = loadAllSyncConfigs();
  const config = configs.find((c) => c.id === jobId);
  return createEditSyncJobCard(config || null);
}

/**
 * Form to create/edit sync jobs.
 */
function createEditSyncJobCard(config: SyncConfig | null): GoogleAppsScript.Card_Service.Card {
  const isNew = !config;
  const builder = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle(isNew ? 'Create Combined Calendar' : 'Edit Combined Calendar')
        .setSubtitle(isNew ? 'Define sync sources and targets' : `Modify ${config.name}`)
    );

  const section = CardService.newCardSection();

  // Name Input
  section.addWidget(
    CardService.newTextInput()
      .setFieldName('name')
      .setTitle('Sync Name')
      .setHint('e.g. Work & Personal Sync')
      .setValue(config ? config.name : '')
  );

  const namesMap = getCalendarNamesMap();

  // Source Calendars
  const sourcesSelect = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setFieldName('sourceCalendarIds')
    .setTitle('Source Calendars (Select to sync FROM)');

  const calendars = CalendarApp.getAllCalendars();
  calendars.forEach((cal) => {
    const id = cal.getId();
    const displayName = namesMap[id] || cal.getName() || id;
    const isSelected = config ? config.sourceCalendarIds.includes(id) : false;
    sourcesSelect.addItem(displayName, id, isSelected);
  });
  section.addWidget(sourcesSelect);

  // Target Calendar
  const targetSelect = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('targetCalendarId')
    .setTitle('Target Calendar (Select to sync TO)');

  targetSelect.addItem('[Create New Dedicated Calendar]', 'CREATE_NEW', isNew || config?.targetCalendarId === 'CREATE_NEW');

  const ownCalendars = CalendarApp.getAllOwnedCalendars();
  ownCalendars.forEach((cal) => {
    try {
      const id = cal.getId();
      const displayName = namesMap[id] || cal.getName() || id;
      targetSelect.addItem(displayName, id, config ? config.targetCalendarId === id : false);
    } catch (err) {
      console.warn(`Error adding calendar ${cal.getId()} to target dropdown:`, err);
    }
  });
  section.addWidget(targetSelect);

  // Title Prefix
  section.addWidget(
    CardService.newTextInput()
      .setFieldName('prefix')
      .setTitle('Title Prefix (Optional)')
      .setHint('e.g. [Work] or [Shared] ')
      .setValue(config ? config.prefix : '')
  );

  // Privacy Mode
  const privacySelect = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('syncPrivacy')
    .setTitle('Privacy Masking Mode')
    .addItem('Sync as Calendar Name (Mask details) [Default]', 'calendarName', !config || config.syncPrivacy === 'calendarName')
    .addItem('Sync full details (Title, description, location)', 'full', config?.syncPrivacy === 'full')
    .addItem("Sync as 'Busy' blocks only (Mask details)", 'busy', config?.syncPrivacy === 'busy');
  section.addWidget(privacySelect);

  // Filter Out Free events
  const busyOnlySelect = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setFieldName('syncOnlyBusyEvents')
    .addItem('Filter out Free/Optional availability events', 'true', isNew ? true : config.syncOnlyBusyEvents);
  section.addWidget(busyOnlySelect);

  // Sync range dropdown
  const rangeSelect = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('syncRange')
    .setTitle('Time Sync Window')
    .addItem('1 month back, 6 months forward', '1_6', !config || (config.syncRangeMonthsBack === 1 && config.syncRangeMonthsForward === 6))
    .addItem('3 months back, 12 months forward', '3_12', config?.syncRangeMonthsBack === 3 && config?.syncRangeMonthsForward === 12);
  section.addWidget(rangeSelect);



  // Action Buttons
  const saveAction = CardService.newAction()
    .setFunctionName('saveJobAction')
    .setParameters(config ? { jobId: config.id } : {});

  const cancelAction = CardService.newAction().setFunctionName('openTool').setParameters({ toolId: 'calendarSync' });

  const footerButtons = CardService.newButtonSet()
    .addButton(
      CardService.newTextButton()
        .setText('Save & Sync')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(saveAction)
    )
    .addButton(
      CardService.newTextButton()
        .setText('Cancel')
        .setOnClickAction(cancelAction)
    );

  section.addWidget(footerButtons);
  builder.addSection(section);

  return builder.build();
}

/**
 * Form save callback logic.
 */
export function saveJobAction(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  const form = e.formInput || {};
  const formInputs = e.formInputs || {};
  const name = form.name ? form.name.trim() : '';
  const sourceCalendarIds = formInputs.sourceCalendarIds || [];
  let targetCalendarId = form.targetCalendarId;
  const prefix = form.prefix || '';
  const syncPrivacy = form.syncPrivacy || 'full';
  const syncOnlyBusyEvents = !!(formInputs.syncOnlyBusyEvents && formInputs.syncOnlyBusyEvents.includes('true'));
  const rangeVal = form.syncRange || '1_6';
  const syncMethod = 'hourly';

  // Extract range values
  let syncRangeMonthsBack = 1;
  let syncRangeMonthsForward = 6;
  if (rangeVal === '3_12') {
    syncRangeMonthsBack = 3;
    syncRangeMonthsForward = 12;
  }

  const existingJobId = e.parameters.jobId;

  // 1. Validations
  if (!name) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error: Sync Name is required.'))
      .build();
  }

  if (sourceCalendarIds.length === 0) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error: Please select at least one source calendar.'))
      .build();
  }

  // Prevent circular sync mapping
  if (targetCalendarId !== 'CREATE_NEW' && sourceCalendarIds.includes(targetCalendarId)) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error: The Target Calendar cannot be one of the Source Calendars.'))
      .build();
  }

  try {
    const jobId = existingJobId || `job_${new Date().getTime()}`;

    // Load original config to check if sync method or source calendars changed (to rebuild triggers)
    const configs = loadAllSyncConfigs();
    const originalConfig = configs.find((c) => c.id === jobId);

    const newConfig: SyncConfig = {
      id: jobId,
      name,
      sourceCalendarIds,
      targetCalendarId,
      prefix,
      syncPrivacy,
      syncOnlyBusyEvents,
      syncRangeMonthsBack,
      syncRangeMonthsForward,
      syncMethod,
      triggerIds: originalConfig ? originalConfig.triggerIds : {},
      status: originalConfig ? originalConfig.status : undefined,
      lastSyncedAt: originalConfig ? originalConfig.lastSyncedAt : undefined,
    };

    // Determine if trigger rebuild is required
    const sourcesChanged = !originalConfig ||
      JSON.stringify(originalConfig.sourceCalendarIds.sort()) !== JSON.stringify(sourceCalendarIds.sort());
    const methodChanged = !originalConfig || originalConfig.syncMethod !== syncMethod;

    if (sourcesChanged || methodChanged) {
      setupTriggers(newConfig);
    }

    // Save configurations
    saveSyncConfig(newConfig);

    // Run initial sync job in background (or defer to next hourly check if triggers are limited)
    const isEnqueued = enqueueBackgroundSync(jobId);
    const toastMsg = isEnqueued
      ? 'Configuration saved! Initial sync is starting in the background.'
      : 'Configuration saved! Initial sync will run on the next hourly schedule.';

    // Refresh homepage
    const homeCard = createCalendarSyncHomepage(e);
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().popToRoot().updateCard(homeCard))
      .setNotification(CardService.newNotification().setText(toastMsg))
      .build();
  } catch (err: any) {
    console.error('Failed to save calendar sync job:', err);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(`Error: ${err?.message || err}`))
      .build();
  }
}

/**
 * Triggers sync manually from the Dashboard page.
 */
export function triggerSyncManual(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  const jobId = e.parameters.jobId;
  const configs = loadAllSyncConfigs();
  const config = configs.find((c) => c.id === jobId);

  if (!config) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error: Sync job configuration not found.'))
      .build();
  }

  // Reset progress so that background execution restarts sync cleanly
  if (config.syncProgress) {
    config.syncProgress.inProgress = false;
    config.syncProgress.lastProcessedIndex = -1;
    saveSyncConfig(config);
  }

  const isEnqueued = enqueueBackgroundSync(jobId);
  const homeCard = createCalendarSyncHomepage(e);

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(homeCard))
    .setNotification(
      CardService.newNotification().setText(
        isEnqueued
          ? 'Manual sync started in the background. It may take a few minutes.'
          : 'Failed to schedule background sync. Please try again.'
      )
    )
    .build();
}

/**
 * Opens delete confirmation card.
 */
export function openDeleteJobConfirmCard(e: any): GoogleAppsScript.Card_Service.Card {
  const jobId = e.parameters.jobId;
  const configs = loadAllSyncConfigs();
  const config = configs.find((c) => c.id === jobId);

  const builder = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('Confirm Deletion')
        .setSubtitle(config ? config.name : '')
    );

  const section = CardService.newCardSection()
    .addWidget(
      CardService.newDecoratedText()
        .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.CLOCK))
        .setText('Are you sure you want to delete this Combined Calendar configuration?')
        .setWrapText(true)
    );

  // Determine if the target is the user's primary/default calendar
  let isPrimary = false;
  if (config) {
    try {
      const defaultCalId = CalendarApp.getDefaultCalendar().getId();
      isPrimary = (config.targetCalendarId === defaultCalId || config.targetCalendarId === 'primary');
    } catch (err) {
      console.warn('Failed to identify if target is primary:', err);
    }
  }

  // Cleanup events/calendar option selection input
  const deleteSelect = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.RADIO_BUTTON)
    .setFieldName('deleteOption');

  if (isPrimary) {
    // Primary calendars cannot be deleted, so we don't offer delete_calendar and default to delete_events
    deleteSelect.addItem('Delete all previously synced events (Recommended)', 'delete_events', true);
    deleteSelect.addItem('Keep target calendar and events', 'keep_all', false);
  } else {
    // Dedicated / secondary calendars can be deleted, default to delete_calendar
    deleteSelect.addItem('Delete target calendar completely (Recommended)', 'delete_calendar', true);
    deleteSelect.addItem('Delete all previously synced events only', 'delete_events', false);
    deleteSelect.addItem('Keep target calendar and events', 'keep_all', false);
  }

  section.addWidget(deleteSelect);

  const confirmAction = CardService.newAction()
    .setFunctionName('deleteJobAction')
    .setParameters({ jobId });

  const cancelAction = CardService.newAction()
    .setFunctionName('openTool')
    .setParameters({ toolId: 'calendarSync' });

  const buttonSet = CardService.newButtonSet()
    .addButton(
      CardService.newTextButton()
        .setText('Confirm Delete')
        .setOnClickAction(confirmAction)
    )
    .addButton(
      CardService.newTextButton()
        .setText('Cancel')
        .setOnClickAction(cancelAction)
    );

  section.addWidget(buttonSet);
  builder.addSection(section);

  return builder.build();
}

/**
 * Callback action to execute job deletion.
 */
export function deleteJobAction(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  const jobId = e.parameters.jobId;
  const formInputs = e.formInputs || {};
  const deleteOption = (formInputs.deleteOption && formInputs.deleteOption[0]) || 'keep_all';

  try {
    const configs = loadAllSyncConfigs();
    const config = configs.find((c) => c.id === jobId);
    const targetCalendarId = config ? config.targetCalendarId : '';

    deleteSyncConfig(jobId, deleteOption, targetCalendarId);

    const homeCard = createCalendarSyncHomepage(e);
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().popToRoot().updateCard(homeCard))
      .setNotification(CardService.newNotification().setText('Combined Calendar sync configuration deleted.'))
      .build();
  } catch (err: any) {
    console.error('Failed to delete sync job:', err);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(`Error: ${err?.message || err}`))
      .build();
  }
}
