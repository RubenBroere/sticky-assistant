import { Tool, TriggerEvent } from '../../core/Tool';
import { createCalendarSyncHomepage } from './cards';

const tool: Tool = {
  id: 'calendarSync',
  name: 'Calendar Sync',
  icon: CardService.Icon.CLOCK,
  info: 'Combine multiple personal and shared calendars into a single auto-syncing calendar.',
  triggers: [
    {
      event: TriggerEvent.DEFAULT_HOMEPAGE,
      createCard: createCalendarSyncHomepage,
    },
    {
      event: TriggerEvent.CALENDAR_HOMEPAGE,
      createCard: createCalendarSyncHomepage,
    },
  ],
};

export function getCalendarSyncTool(): Tool {
  return tool;
}
