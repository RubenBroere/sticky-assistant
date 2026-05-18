import { getAppName } from '../../core/branding';
import { COMMITTEE_CONFIG } from './config';
import { buildToolCard } from '../../core/cardTemplate';
import { COMMITTEE_CREATOR_SETTINGS } from './settings';

const TOOL_META = {
  id: 'committeeCreator',
  name: 'Committees',
  icon: CardService.Icon.BOOKMARK,
  settings: COMMITTEE_CREATOR_SETTINGS,
};

export function createCommitteeMessageCard(message: string, isInfo: boolean = true) {
  const icon = isInfo ? COMMITTEE_CONFIG.ICONS.INFO : COMMITTEE_CONFIG.ICONS.ERROR;
  const title = isInfo ? getAppName() : 'Attention';

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(title))
    .addSection(
      CardService.newCardSection().addWidget(
        CardService.newDecoratedText()
          .setText(message)
          .setWrapText(true)
          .setStartIcon(CardService.newIconImage().setIcon(icon))
      )
    )
    .build();
}

export function createCommitteeAnalyzeCard(folderName: string, folderId: string) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(getAppName()).setSubtitle('Ready to Scan'))
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newKeyValue()
            .setTopLabel('Selected Folder')
            .setContent(folderName)
            .setIcon(COMMITTEE_CONFIG.ICONS.FOLDER)
            .setMultiline(true)
        )
        .addWidget(
          CardService.newTextParagraph().setText(
            'Click below to detect structure (Single Committee or Parent Group) and year patterns.'
          )
        )
        .addWidget(
          CardService.newTextButton()
            .setText('Scan and Preview')
            .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('runScan')
                .setParameters({ sourceId: folderId, folderName })
            )
        )
    )
    .build();
}

export function createCommitteeExecutionCard(
  newRootName: string,
  destRootFolder: GoogleAppsScript.Drive.Folder
) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Task Complete'))
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newKeyValue()
            .setTopLabel('Status')
            .setContent('Success')
            .setIcon(COMMITTEE_CONFIG.ICONS.CHECK)
            .setButton(
              CardService.newTextButton()
                .setText('Open Folder')
                .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
                .setOpenLink(CardService.newOpenLink().setUrl(destRootFolder.getUrl()))
            )
        )
        .addWidget(
          CardService.newKeyValue()
            .setTopLabel('Created Folder')
            .setContent(newRootName)
            .setMultiline(true)
        )
        .addWidget(
          CardService.newTextButton()
            .setText('Start Over')
            .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
            .setOnClickAction(CardService.newAction().setFunctionName('onDriveSelection'))
        )
    )
    .build();
}

export function onCommitteeHomepage() {
  const builder = buildToolCard(
    TOOL_META,
    'Clone and roll forward committee folder structures for the next academic year. Detects year patterns and can update document contents.'
  );

  builder.addSection(
    CardService.newCardSection()
      .addWidget(
        CardService.newTextParagraph().setText(
          'This tool rolls committee folder structures forward to the next academic year.'
        )
      )
      .addWidget(
        CardService.newTextParagraph().setText(
          '<b>How to use:</b><br>1. Go to Google Drive.<br>2. Select a committee folder (e.g., "BaCo 2024-2025").<br>3. Use the sidebar to clone for the next year.'
        )
      )
  );

  builder.addSection(
    CardService.newCardSection()
      .setHeader('Features')
      .addWidget(
        CardService.newKeyValue()
          .setTopLabel('Smart Year Detection')
          .setContent('Detects "2024/2025" or "2024-2025" folder names.')
          .setIcon(COMMITTEE_CONFIG.ICONS.MAGIC)
          .setMultiline(true)
      )
      .addWidget(
        CardService.newKeyValue()
          .setTopLabel('Inhoud bijwerken')
          .setContent('Renames files and updates [YEAR] tags inside Docs.')
          .setIcon(COMMITTEE_CONFIG.ICONS.DESCRIPTION)
          .setMultiline(true)
      )
  );

  return builder.build();
}
