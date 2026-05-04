// 1. Homepage: Shows the main menu
function onHomepage(e) {
  const lang = getLanguage();
  let builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle(t(lang, 'appTitle')));

  let section = CardService.newCardSection();

  let scanAction = CardService.newAction().setFunctionName('scanDocument');
  section.addWidget(CardService.newTextButton()
      .setText(t(lang, 'scanDocument'))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(scanAction));

  let settingsAction = CardService.newAction().setFunctionName('buildSettingsCard');
  section.addWidget(CardService.newTextButton()
      .setText(`⚙️ ${t(lang, 'settings')}`)
      .setOnClickAction(settingsAction));

  builder.addSection(section);
  return builder.build();
}

// 2. Settings UI: Let users save their own Config
function buildSettingsCard(e) {
  const lang = getLanguage();
  let props = PropertiesService.getUserProperties();
  let token = props.getProperty('TODOIST_TOKEN') || '';
  let projectId = props.getProperty('TODOIST_PROJECT_ID') || '';
  let isEnabled = props.getProperty('TODOIST_ENABLED') === 'true';
  let peopleConfigRaw = props.getProperty('PEOPLE_CONFIG') || JSON.stringify({}, null, 2);
  let language = props.getProperty('LANGUAGE') || 'en';

  let builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle(t(lang, 'userSettings')));

  let section = CardService.newCardSection();

  section.addWidget(CardService.newTextInput()
      .setFieldName("todoistToken")
      .setTitle(t(lang, 'todoistToken'))
      .setValue(token));

  section.addWidget(CardService.newTextInput()
      .setFieldName("todoistProjectId")
      .setTitle(t(lang, 'todoistProjectId'))
      .setValue(projectId));

  section.addWidget(CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.CHECK_BOX)
      .setFieldName("enableTodoist")
      .addItem(t(lang, 'enableTodoist'), "true", isEnabled));

  section.addWidget(CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName("language")
      .addItem(t('en', 'languageEnglish'), "en", language === 'en')
      .addItem(t('nl', 'languageDutch'), "nl", language === 'nl'));

  // People config: editable JSON mapping (stored in user properties)
  section.addWidget(CardService.newTextParagraph().setText(t(lang, 'peopleConfigHelp')));
  section.addWidget(CardService.newTextInput()
      .setFieldName('peopleConfig')
      .setTitle(t(lang, 'peopleConfigLabel'))
      .setValue(peopleConfigRaw)
      .setMultiline(true));

  let saveAction = CardService.newAction().setFunctionName('saveSettings');
  section.addWidget(CardService.newTextButton()
      .setText(t(lang, 'saveSettings'))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(saveAction));

  let backAction = CardService.newAction().setFunctionName('onHomepage');
  section.addWidget(CardService.newTextButton()
      .setText(t(lang, 'backToMenu'))
      .setOnClickAction(backAction));

  builder.addSection(section);
  return builder.build();
}

// 3. Save Settings Handler
function saveSettings(e) {
  const lang = getLanguage();
  let formInputs = e.formInput;
  let props = PropertiesService.getUserProperties();

  props.setProperty('TODOIST_TOKEN', formInputs.todoistToken || '');
  props.setProperty('TODOIST_PROJECT_ID', formInputs.todoistProjectId || '');

  // If the checkbox is unchecked, it won't appear in formInputs
  let isEnabled = formInputs.enableTodoist ? 'true' : 'false';
  props.setProperty('TODOIST_ENABLED', isEnabled);

  if (formInputs.language) {
    props.setProperty('LANGUAGE', formInputs.language === 'nl' ? 'nl' : 'en');
  }

  // Save people config JSON if present and valid; otherwise keep existing
  if (formInputs.peopleConfig) {
    try {
      const parsed = JSON.parse(formInputs.peopleConfig);
      const validation = validatePeopleConfig(parsed);
      if (!validation.ok) {
        return createMessageCard(t(lang, 'invalidSettings'), validation.message);
      }
      props.setProperty('PEOPLE_CONFIG', JSON.stringify(parsed, null, 2));
    } catch (err) {
      return createMessageCard(t(lang, 'invalidSettings'), t(lang, 'invalidPeopleJson'));
    }
  }

  return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(t(lang, 'settingsSaved')))
      .setNavigation(CardService.newNavigation().popToRoot().updateCard(onHomepage(e)))
      .build();
}

// Helper: Simple message screens
function createMessageCard(title, message) {
  const lang = getLanguage();
  let builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle(title));
  let section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph().setText(message));

  let backAction = CardService.newAction().setFunctionName('onHomepage');
  section.addWidget(CardService.newTextButton().setText(t(lang, 'backToMenu')).setOnClickAction(backAction));

  builder.addSection(section);
  return builder.build();
}
