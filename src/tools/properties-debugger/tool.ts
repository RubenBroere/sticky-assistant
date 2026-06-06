import { Tool, TriggerEvent } from '../../core/Tool';
import { createPropertiesDebuggerHomepage } from './cards';

const tool: Tool = {
  id: 'propertiesDebugger',
  name: 'Properties Debugger',
  icon: CardService.Icon.DESCRIPTION,
  info: 'Advanced utility to inspect, edit, and delete raw User Properties.',
  triggers: [
    {
      event: TriggerEvent.DEFAULT_HOMEPAGE,
      createCard: createPropertiesDebuggerHomepage,
    },
    {
      event: TriggerEvent.CALENDAR_HOMEPAGE,
      createCard: createPropertiesDebuggerHomepage,
    },
  ],
};

export function getPropertiesDebuggerTool(): Tool {
  return tool;
}
