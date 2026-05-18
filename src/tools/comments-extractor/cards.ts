import { getSelectedPdfItem } from './scanning';
import { exportCommentsToSheetLogic } from './editing';
import { buildToolCard } from '../../core/cardTemplate';
import { COMMENTS_EXTRACTOR_SETTINGS } from './settings';

const TOOL_META = {
  id: 'commentsExtractor',
  name: 'PDF Comment Viewer',
  icon: CardService.Icon.DESCRIPTION,
  settings: COMMENTS_EXTRACTOR_SETTINGS,
};

export function buildEmptyCard(text: string) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('PDF Comment Viewer'))
    .addSection(
      CardService.newCardSection().addWidget(CardService.newTextParagraph().setText(text))
    )
    .build();
}

export function createCommentsExtractorHomepage(e: any) {
  const item = getSelectedPdfItem(e);
  if (!item) {
    return buildEmptyCard('Select a PDF file to view comments.');
  }

  const builder = buildToolCard(TOOL_META, 'Select a PDF file to view inline Drive comments.');

  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(`**Selected:** ${item.title}`))
    .addWidget(
      CardService.newTextParagraph().setText(
        'Click below to view comments directly in this sidebar.'
      )
    )
    .addWidget(
      CardService.newTextButton()
        .setText('View Comments')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('exportCommentsToSheet')
            .setParameters({ itemId: item.id, itemName: item.title })
        )
    );

  builder.addSection(section);
  return builder.build();
}

export function exportCommentsToSheet(e: any) {
  const result = exportCommentsToSheetLogic(e);

  if (!result.ok) {
    return buildEmptyCard(result.message);
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Export Complete'))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText(result.message))
        .addWidget(
          CardService.newTextButton()
            .setText('Open Google Sheet')
            .setOpenLink(CardService.newOpenLink().setUrl(result.sheetUrl || ''))
        )
    )
    .build();
}
