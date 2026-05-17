import { getAppName, getToolTitle, getToolAccent } from './Branding';
import { getLanguage, setLanguage, t } from './Locale';

// Homepage: Shows the tool selector
export function onHomepage(e: any) {
  return buildToolSelectorCard(e);
}

export function buildToolSelectorCard(e: any) {
  const builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle(getAppName()));

  const section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph().setText(t('toolSelectorHelp')));

  const actionPointsAction = CardService.newAction().setFunctionName('onActionPointsHomepage');
    section.addWidget(CardService.newTextButton()
      .setText(getToolTitle('actionPoints'))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(actionPointsAction));

  const committeeAction = CardService.newAction().setFunctionName('onCommitteeHomepage');
    section.addWidget(CardService.newTextButton()
      .setText(getToolTitle('committees'))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor(getToolAccent('committees'))
      .setOnClickAction(committeeAction));

  // Common Settings Button
  const settingsAction = CardService.newAction().setFunctionName('buildSettingsCard');
  section.addWidget(CardService.newTextButton()
      .setText(`⚙️ ${t('manageAllSettings')}`)
      .setOnClickAction(settingsAction));

  builder.addSection(section);
  return builder.build();
}

// Settings UI: Centralized hub for all tool configurations
export function buildSettingsCard(e: any) {
  // Global Settings
  let language = getLanguage();

  let builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle(t('userSettings')));

  // --- GLOBAL SETTINGS SECTION ---
  let globalSection = CardService.newCardSection().setHeader(t('globalSettings'));
  
  globalSection.addWidget(CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName("language")
      .setTitle(t('language'))
      .addItem(t('languageEnglish'), "en", language === 'en')
      .addItem(t('languageDutch'), "nl", language === 'nl'));

  let saveGlobalAction = CardService.newAction().setFunctionName('saveGlobalSettings');
  globalSection.addWidget(CardService.newTextButton()
      .setText(t('saveSettings'))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(saveGlobalAction));

  builder.addSection(globalSection);

  // --- TOOL SETTINGS SECTION ---
  let toolSection = CardService.newCardSection().setHeader(t('toolSettings'));

  toolSection.addWidget(CardService.newTextButton()
      .setText(getToolTitle('actionPoints'))
      .setOnClickAction(CardService.newAction().setFunctionName('buildActionPointsSettingsCard')));

  toolSection.addWidget(CardService.newTextButton()
      .setText(getToolTitle('committees'))
      .setOnClickAction(CardService.newAction().setFunctionName('buildCommitteeSettingsCard')));

  toolSection.addWidget(CardService.newTextButton()
      .setText(t('driveCommentsViewerTitle'))
      .setOnClickAction(CardService.newAction().setFunctionName('buildDriveCommentsSettingsCard')));

  builder.addSection(toolSection);

  // --- NAVIGATION SECTION ---
  let navSection = CardService.newCardSection();
  let backAction = CardService.newAction().setFunctionName('onHomepage');
  navSection.addWidget(CardService.newTextButton()
      .setText(t('back'))
      .setOnClickAction(backAction));

  builder.addSection(navSection);

  return builder.build();
}

// Save Global Settings Handler
export function saveGlobalSettings(e: any) {
  let formInputs = e.formInput;
  if (formInputs.language) {
    setLanguage(formInputs.language);
  }

  return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(t('settingsSaved')))
      .setNavigation(CardService.newNavigation().popToRoot().updateCard(onHomepage(e)))
      .build();
}

// Helper: Simple message screens
export function createMessageCard(title: string, message: string) {
  let builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle(title));
  let section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph().setText(message));

  let backAction = CardService.newAction().setFunctionName('onHomepage');
  section.addWidget(CardService.newTextButton().setText(t('back')).setOnClickAction(backAction));

  builder.addSection(section);
  return builder.build();
}
