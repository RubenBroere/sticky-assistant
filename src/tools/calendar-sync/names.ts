/**
 * Fetches user-configured display names for all calendars using summaryOverride from CalendarList.
 */
export function getCalendarNamesMap(): Record<string, string> {
  const nameMap: Record<string, string> = {};
  try {
    const calService = (globalThis as any).Calendar;
    if (calService && calService.CalendarList) {
      const listResponse = calService.CalendarList.list();
      if (listResponse && listResponse.items) {
        listResponse.items.forEach((item: any) => {
          const name = item.summaryOverride || item.summary || item.id;
          nameMap[item.id] = name;
          if (item.primary) {
            nameMap['primary'] = name;
          }
        });
      }
    }
  } catch (err) {
    console.warn('Failed to fetch calendar list via Advanced API:', err);
  }
  return nameMap;
}

/**
 * Resolves a single calendar name safely, checking summaryOverride first.
 */
export function resolveCalendarName(calendarId: string): string {
  if (calendarId === 'CREATE_NEW') return '[Create New Calendar]';
  try {
    const calService = (globalThis as any).Calendar;
    if (calService && calService.CalendarList) {
      const entry = calService.CalendarList.get(calendarId);
      return entry.summaryOverride || entry.summary || calendarId;
    }
  } catch {
    // Fallback
  }
  try {
    let resolvedId = calendarId;
    if (resolvedId === 'primary') {
      try {
        resolvedId = CalendarApp.getDefaultCalendar().getId();
      } catch {
        // Ignore
      }
    }
    const cal = CalendarApp.getCalendarById(resolvedId);
    return cal ? cal.getName() : calendarId;
  } catch {
    return calendarId;
  }
}
