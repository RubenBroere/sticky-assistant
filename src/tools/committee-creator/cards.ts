import { buildToolCard, buildToolFooter } from '../../core/cardTemplate';
import { COMMITTEE_CREATOR_SETTINGS } from './settings';
import { COLORS } from '../../core/branding';

const TOOL_META = {
  id: 'committeeCreator',
  name: 'Committees',
  icon: CardService.Icon.BOOKMARK,
  settings: COMMITTEE_CREATOR_SETTINGS,
};

export function createCommitteeAnalyzeCard(
  folderName: string,
  folderId: string
): GoogleAppsScript.Card_Service.Card {
  return CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader().setTitle('Committee Creator').setSubtitle('Ready to Scan')
    )
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newDecoratedText()
            .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.DESCRIPTION))
            .setText(`Selected Folder: <b>${folderName}</b>`)
            .setBottomLabel('Google Drive Folder')
            .setWrapText(true)
        )
        .addWidget(
          CardService.newDecoratedText()
            .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.CLOCK))
            .setText('Ready to Scan')
            .setBottomLabel('Will detect structure (Single or Parent Group) and year patterns.')
            .setWrapText(true)
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
): GoogleAppsScript.Card_Service.Card {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Task Complete'))
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newDecoratedText()
            .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.STAR))
            .setText(
              `<font color="${COLORS.SUCCESS}"><b>Cloning Completed Successfully!</b></font>`
            )
            .setBottomLabel(`Created: ${newRootName}`)
            .setWrapText(true)
        )
        .addWidget(
          CardService.newTextButton()
            .setText('Open Google Drive Folder')
            .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
            .setOpenLink(CardService.newOpenLink().setUrl(destRootFolder.getUrl()))
        )
        .addWidget(
          CardService.newTextButton()
            .setText('Start Over')
            .setOnClickAction(CardService.newAction().setFunctionName('onDriveSelection'))
        )
    )
    .build();
}

export function onCommitteeHomepage(): GoogleAppsScript.Card_Service.Card {
  const builder = buildToolCard(TOOL_META, 'Roll forward folder structures.');

  builder.addSection(
    CardService.newCardSection()
      .setHeader('How to use')
      .addWidget(
        CardService.newDecoratedText()
          .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.DESCRIPTION))
          .setText('<b>Step 1</b>: Go to Google Drive')
          .setWrapText(true)
      )
      .addWidget(
        CardService.newDecoratedText()
          .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.CLOCK))
          .setText('<b>Step 2</b>: Select a committee folder (e.g., <i>"BaCo 2024-2025"</i>)')
          .setWrapText(true)
      )
      .addWidget(
        CardService.newDecoratedText()
          .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.STAR))
          .setText('<b>Step 3</b>: Use this sidebar to clone for the next year')
          .setWrapText(true)
      )
  );

  builder.addSection(
    CardService.newCardSection()
      .setHeader('Key Features')
      .addWidget(
        CardService.newDecoratedText()
          .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.STAR))
          .setText('<b>Smart Year Detection</b>')
          .setBottomLabel(
            'Automatically detects patterns like "2024/2025" or "2024-2025" in folder names.'
          )
          .setWrapText(true)
      )
      .addWidget(
        CardService.newDecoratedText()
          .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.DESCRIPTION))
          .setText('<b>Inhoud bijwerken (Content Updates)</b>')
          .setBottomLabel(
            'Renames copied files and updates internal [YEAR] template tags inside Google Docs.'
          )
          .setWrapText(true)
      )
  );

  builder.addSection(buildToolFooter('committeeCreator', true));

  return builder.build();
}
