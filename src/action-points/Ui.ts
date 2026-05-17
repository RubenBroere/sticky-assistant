import { getToolTitle } from '../core/Branding';
import { t } from '../core/Locale';
import { validatePeopleConfig } from './Config';
import { createMessageCard, onHomepage } from '../core/Ui';

// Action Points: Shows the main menu
export function onActionPointsHomepage(e: any) {
  let builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle(getToolTitle('actionPoints')));

  let section = CardService.newCardSection();

  let scanAction = CardService.newAction().setFunctionName('scanDocument');
  section.addWidget(CardService.newTextButton()
      .setText(t('scanDocument'))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(scanAction));

  let settingsAction = CardService.newAction().setFunctionName('buildActionPointsSettingsCard');
  section.addWidget(CardService.newTextButton()
      .setText(`⚙️ ${t('settings')}`)
      .setOnClickAction(settingsAction));

  builder.addSection(section);
  return builder.build();
}

/**
 * Action Points Settings UI
 */
export function buildActionPointsSettingsCard(e: any) {
  let props = PropertiesService.getUserProperties();
  
  let token = props.getProperty('TODOIST_TOKEN') || '';
  let projectId = props.getProperty('TODOIST_PROJECT_ID') || '';
  let isEnabled = props.getProperty('TODOIST_ENABLED') === 'true';
  let peopleConfigRaw = props.getProperty('PEOPLE_CONFIG') || JSON.stringify({}, null, 2);

  let builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle(t('actionPointsSettings')));

  let apSection = CardService.newCardSection();

  apSection.addWidget(CardService.newTextInput()
      .setFieldName("todoistToken")
      .setTitle(t('todoistToken'))
      .setValue(token));

  apSection.addWidget(CardService.newTextInput()
      .setFieldName("todoistProjectId")
      .setTitle(t('todoistProjectId'))
      .setValue(projectId));

  apSection.addWidget(CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.CHECK_BOX)
      .setFieldName("enableTodoist")
      .addItem(t('enableTodoist'), "true", isEnabled));

  apSection.addWidget(CardService.newTextParagraph().setText(t('peopleConfigHelp')));
  apSection.addWidget(CardService.newTextInput()
      .setFieldName('peopleConfig')
      .setTitle(t('peopleConfigLabel'))
      .setValue(peopleConfigRaw)
      .setMultiline(true));

  builder.addSection(apSection);

  let actionSection = CardService.newCardSection();
  
  let saveAction = CardService.newAction().setFunctionName('saveActionPointsSettings');
  actionSection.addWidget(CardService.newTextButton()
      .setText(t('saveSettings'))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(saveAction));

  let backAction = CardService.newAction().setFunctionName('onActionPointsHomepage');
  actionSection.addWidget(CardService.newTextButton()
      .setText(t('back'))
      .setOnClickAction(backAction));

  builder.addSection(actionSection);
  return builder.build();
}

/**
 * Save Action Points Settings Handler
 */
export function saveActionPointsSettings(e: any) {
  let formInputs = e.formInput;
  let props = PropertiesService.getUserProperties();

  props.setProperty('TODOIST_TOKEN', formInputs.todoistToken || '');
  props.setProperty('TODOIST_PROJECT_ID', formInputs.todoistProjectId || '');

  let isEnabled = formInputs.enableTodoist ? 'true' : 'false';
  props.setProperty('TODOIST_ENABLED', isEnabled);

  if (formInputs.peopleConfig) {
    try {
      const parsed = JSON.parse(formInputs.peopleConfig);
      const validation = validatePeopleConfig(parsed);
      if (!validation.ok) {
        return createMessageCard(t('invalidSettings'), validation.message || '');
      }
      props.setProperty('PEOPLE_CONFIG', JSON.stringify(parsed, null, 2));
    } catch (err) {
      return createMessageCard(t('invalidSettings'), t('invalidPeopleJson'));
    }
  }

  return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(t('settingsSaved')))
      .setNavigation(CardService.newNavigation().popCard().updateCard(onActionPointsHomepage(e)))
      .build();
}
