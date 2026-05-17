import { getToolTitle, getToolAccent } from '../core/Branding';
import { COMMITTEE_CONFIG } from './Config';
import { t } from '../core/Locale';

/**
 * Creates the initial card that prompts the user to scan the selected folder.
 *
 * @param {string} folderName - The name of the selected folder.
 * @param {string} folderId - The ID of the selected folder.
 * @return {CardService.Card} The UI card for the analyze step.
 */
export function createCommitteeAnalyzeCard(folderName: string, folderId: string) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle(getToolTitle('committees'))
      .setSubtitle(t("committeeReadyTitle")))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newKeyValue()
        .setTopLabel(t("committeeSelectedFolder"))
        .setContent(folderName)
        .setIcon(COMMITTEE_CONFIG.ICONS.FOLDER)
        .setMultiline(true))
      .addWidget(CardService.newTextParagraph().setText(t("committeeAnalyzeHint")))
      .addWidget(CardService.newTextButton()
        .setText(t("committeeScanPreview"))
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor(getToolAccent('committees'))
        .setOnClickAction(CardService.newAction()
          .setFunctionName("runScan")
          .setParameters({ "sourceId": folderId, "folderName": folderName })
        )))
    .build();
}

/**
 * Creates a simple informational card with support for error states.
 *
 * @param {string} message - The message to display.
 * @param {boolean} isInfo - If true, treats as info/neutral. If false, treats as error.
 * @return {CardService.Card} The constructed card.
 */
export function createCommitteeMessageCard(message: string, isInfo: boolean = true) {
  const icon = isInfo ? COMMITTEE_CONFIG.ICONS.INFO : COMMITTEE_CONFIG.ICONS.ERROR;
  const title = isInfo ? getToolTitle('committees') : t("committeeErrorTitle");

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(title))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newDecoratedText()
        .setText(message)
        .setWrapText(true)
        .setStartIcon(CardService.newIconImage().setIcon(icon))
    ))
  .build();
}

/**
 * Committee Settings UI (Placeholder)
 */
export function buildCommitteeSettingsCard(e: any) {
  let builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle(t('committeeSettings')));

  let section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph().setText(t('noTasksHint')));
  builder.addSection(section);

  let actionSection = CardService.newCardSection();
  actionSection.addWidget(CardService.newTextButton()
      .setText(t('back'))
      .setOnClickAction(CardService.newAction().setFunctionName('buildSettingsCard')));
  
  builder.addSection(actionSection);
  return builder.build();
}

/**
 * Save Committee Settings (Placeholder)
 */
export function saveCommitteeSettings(e: any) {
  return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(t('settingsSaved')))
      .build();
}
