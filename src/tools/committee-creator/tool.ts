import { Tool, TriggerEvent } from '../../core/Tool';
import { onCommitteeHomepage } from './cards';
import { onDriveSelection } from './editing';
import { validateCommitteeConfig } from './config';
import { COMMITTEE_CREATOR_SETTINGS } from './settings';

const tool: Tool = {
  id: 'committeeCreator',
  name: 'Committee Creator',
  icon: CardService.Icon.BOOKMARK,
  info: 'Roll forward folder structures.',
  settings: COMMITTEE_CREATOR_SETTINGS,
  validateSettings: validateCommitteeConfig,
  triggers: [
    {
      event: TriggerEvent.DEFAULT_HOMEPAGE,
      createCard: onCommitteeHomepage,
      enabled: (e) => e.commonEventObject.hostApp === 'DRIVE',
    },
    {
      event: TriggerEvent.ITEMS_SELECTED,
      createCard: onDriveSelection,
      enabled: (e) => {
        if (e.commonEventObject.hostApp !== 'DRIVE') return false;

        // Only enable if a single folder is selected
        const selectedItems = e.drive?.selectedItems ?? [];
        return (
          selectedItems &&
          selectedItems.length === 1 &&
          selectedItems[0].mimeType === 'application/vnd.google-apps.folder'
        );
      },
    },
  ],
};

export function getCommitteeCreatorTool(): Tool {
  return tool;
}
