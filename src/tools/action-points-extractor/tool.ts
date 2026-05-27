import { Tool, TriggerEvent } from '../../core/Tool';
import { createActionPointsHomepage } from './cards';
import { validateActionPointsConfig } from './config';
import { ACTION_POINTS_SETTINGS } from './settings';

const tool: Tool = {
  id: 'actionPointsExtractor',
  name: 'Action Points',
  icon: CardService.Icon.STORE,
  info: 'Scan and sync action items.',
  settings: ACTION_POINTS_SETTINGS,
  validateSettings: (formInput: Record<string, any>) => {
    return validateActionPointsConfig(formInput);
  },
  triggers: [
    {
      event: TriggerEvent.DOCS_HOMEPAGE,
      createCard: createActionPointsHomepage,
      enabled: (e) => e.commonEventObject.hostApp === 'DOCS',
    },
  ],
};

export function getActionPointsExtractorTool(): Tool {
  return tool;
}
