import { Tool, TriggerEvent } from '../../core/Tool';
import { createCommentsExtractorHomepage } from './cards';
import { validateCommentsExtractorConfig } from './config';
import { COMMENTS_EXTRACTOR_SETTINGS } from './settings';

const tool: Tool = {
  id: 'commentsExtractor',
  name: 'Comments Extractor',
  icon: CardService.Icon.DESCRIPTION,
  info: 'Export comments from PDFs.',
  settings: COMMENTS_EXTRACTOR_SETTINGS,
  validateSettings: (formInput: Record<string, unknown>) => {
    return validateCommentsExtractorConfig(formInput);
  },
  triggers: [
    {
      event: TriggerEvent.DEFAULT_HOMEPAGE,
      createCard: createCommentsExtractorHomepage,
      enabled: (e) => e.commonEventObject.hostApp === 'DRIVE',
    },
    {
      event: TriggerEvent.ITEMS_SELECTED,
      createCard: createCommentsExtractorHomepage,
      enabled: (e) => {
        if (e.commonEventObject.hostApp !== 'DRIVE') return false;

        // Only enable if a single PDF file is selected
        const selectedItems = e.drive?.selectedItems ?? [];
        return (
          selectedItems &&
          selectedItems.length === 1 &&
          selectedItems[0].mimeType === 'application/pdf'
        );
      },
    },
  ],
};

export function getCommentsExtractorTool(): Tool {
  return tool;
}
