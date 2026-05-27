import { getSelectedPdfItem } from './scanning';
import { exportCommentsToSheetLogic } from './editing';
import { buildToolCard, buildToolFooter } from '../../core/cardTemplate';
import { COMMENTS_EXTRACTOR_SETTINGS } from './settings';
import { buildStatusCard } from '../../core/cards';
import { COLORS } from '../../core/branding';

const TOOL_META = {
  id: 'commentsExtractor',
  name: 'PDF Comment Viewer',
  icon: CardService.Icon.DESCRIPTION,
  settings: COMMENTS_EXTRACTOR_SETTINGS,
};

export function createCommentsExtractorHomepage(e: any): GoogleAppsScript.Card_Service.Card {
  const item = getSelectedPdfItem(e);
  if (!item) {
    return buildStatusCard(
      'Select a PDF',
      'Please select a PDF file in Google Drive to view and export its comments.',
      'info'
    );
  }

  const builder = buildToolCard(TOOL_META, 'Export comments from PDFs.');

  const section = CardService.newCardSection()
    .addWidget(
      CardService.newDecoratedText()
        .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.DESCRIPTION))
        .setText(`Selected PDF: <b>${item.title}</b>`)
        .setWrapText(true)
    )
    .addWidget(
      CardService.newTextButton()
        .setText('Export Comments')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('exportCommentsToSheet')
            .setParameters({ itemId: item.id, itemName: item.title })
        )
    );

  builder.addSection(section);
  builder.addSection(buildToolFooter('commentsExtractor', true));
  return builder.build();
}

export function exportCommentsToSheet(e: any): GoogleAppsScript.Card_Service.Card {
  const result = exportCommentsToSheetLogic(e);

  if (!result.ok) {
    return buildStatusCard(
      'Export Failed',
      result.message || 'An error occurred during comment export.',
      'error'
    );
  }

  const builder = CardService.newCardBuilder();
  builder.setHeader(
    CardService.newCardHeader().setTitle(
      `<font color="${COLORS.SUCCESS}"><b>Export Complete</b></font>`
    )
  );

  const section = CardService.newCardSection()
    .addWidget(
      CardService.newDecoratedText()
        .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.STAR))
        .setText(`<font color="${COLORS.SUCCESS}"><b>Comments Exported Successfully</b></font>`)
        .setBottomLabel(result.message)
        .setWrapText(true)
    )
    .addWidget(
      CardService.newTextButton()
        .setText('Open Google Sheet')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOpenLink(CardService.newOpenLink().setUrl(result.sheetUrl || ''))
    );

  const backAction = CardService.newAction()
    .setFunctionName('openTool')
    .setParameters({ toolId: 'commentsExtractor' });

  section.addWidget(CardService.newTextButton().setText('Back').setOnClickAction(backAction));

  builder.addSection(section);
  return builder.build();
}
