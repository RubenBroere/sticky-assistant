const I18N = {
  en: {
    appTitle: 'Action Point Scanner',
    scanDocument: 'Scan Document',
    settings: 'Settings',
    userSettings: 'User Settings',
    language: 'Language',
    languageEnglish: 'English',
    languageDutch: 'Dutch',
    todoistToken: 'Todoist API Token',
    todoistProjectId: 'Todoist Project ID',
    enableTodoist: 'Enable Sending to Todoist',
    peopleConfigLabel: 'People Config',
    peopleConfigHelp: 'People Config (JSON mapping). Example: {"John":{"aliases":["Ceo","Dev"],"todoist_id":"john123","order":1}}',
    saveSettings: 'Save Settings',
    backToMenu: 'Back to Menu',
    back: 'Back',
    settingsSaved: 'Settings saved!',
    error: 'Error',
    noDoc: 'Could not read the document.',
    noTasksTitle: 'No Tasks Found',
    noTasksHint: 'Ensure you are using the format: AP Name: Task',
    scanResults: 'Scan Results',
    openAP: 'Open Action Points ({count})',
    completedAP: 'Completed Action Points ({count})',
    noOpen: 'All caught up! No open tasks.',
    noCompleted: 'No completed tasks yet.',
    sendOpenToTodoist: 'Send Open APs to Todoist',
    noOpenToSync: 'No open tasks to sync.',
    addToTop: 'Add formatted APs to top under "Action points"',
    replaceInPlace: 'Format and replace aliases in original locations',
    applyDocChanges: 'Apply Document Changes',
    addPeopleToSettings: 'Add People to Settings',
    todoistDisabled: 'Todoist sync is disabled in your settings.',
    done: 'Done',
    docUpdatesApplied: 'Document updates applied.',
    invalidSettings: 'Invalid Settings',
    invalidPeopleJson: 'People Config is not valid JSON.',
    peopleListError: 'Could not read people list.',
    noPeopleToAdd: 'No people to add.',
    addedPeople: 'Added {count} people to settings.',
    noNewPeople: 'No new people to add.',
    actionPointsHeader: 'Action points',
    everyoneKeyword: 'everyone',
    due: 'Due'
  },
  nl: {
    appTitle: 'Actiepunten Scanner',
    scanDocument: 'Document scannen',
    settings: 'Instellingen',
    userSettings: 'Gebruikersinstellingen',
    language: 'Taal',
    languageEnglish: 'Engels',
    languageDutch: 'Nederlands',
    todoistToken: 'Todoist API-token',
    todoistProjectId: 'Todoist Project-ID',
    enableTodoist: 'Versturen naar Todoist inschakelen',
    peopleConfigLabel: 'Personenconfig',
    peopleConfigHelp: 'Personenconfig (JSON-mapping). Voorbeeld: {"John":{"aliases":["Ceo","Dev"],"todoist_id":"john123","order":1}}',
    saveSettings: 'Instellingen opslaan',
    backToMenu: 'Terug naar menu',
    back: 'Terug',
    settingsSaved: 'Instellingen opgeslagen!',
    error: 'Fout',
    noDoc: 'Kan het document niet lezen.',
    noTasksTitle: 'Geen taken gevonden',
    noTasksHint: 'Zorg dat je het format gebruikt: AP Naam: Taak',
    scanResults: 'Scanresultaten',
    openAP: 'Open actiepunten ({count})',
    completedAP: 'Afgeronde actiepunten ({count})',
    noOpen: 'Alles bijgewerkt! Geen open taken.',
    noCompleted: 'Nog geen afgeronde taken.',
    sendOpenToTodoist: 'Open APs naar Todoist sturen',
    noOpenToSync: 'Geen open taken om te synchroniseren.',
    addToTop: 'Geformatteerde APs bovenaan toevoegen onder "Actiepunten"',
    replaceInPlace: 'Aliases formatteren en vervangen op de oorspronkelijke plek',
    applyDocChanges: 'Documentwijzigingen toepassen',
    addPeopleToSettings: 'Personen aan instellingen toevoegen',
    todoistDisabled: 'Todoist-synchronisatie is uitgeschakeld in je instellingen.',
    done: 'Klaar',
    docUpdatesApplied: 'Documentwijzigingen toegepast.',
    invalidSettings: 'Ongeldige instellingen',
    invalidPeopleJson: 'Personenconfig is geen geldige JSON.',
    peopleListError: 'Kan personenlijst niet lezen.',
    noPeopleToAdd: 'Geen personen om toe te voegen.',
    addedPeople: '{count} personen toegevoegd aan instellingen.',
    noNewPeople: 'Geen nieuwe personen om toe te voegen.',
    actionPointsHeader: 'Actiepunten',
    everyoneKeyword: 'iedereen',
    due: 'Vervalt'
  }
};

function getLanguage() {
  const props = PropertiesService.getUserProperties();
  const raw = props.getProperty('LANGUAGE') || 'en';
  return raw === 'nl' ? 'nl' : 'en';
}

function formatMessage(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params.hasOwnProperty(key) ? String(params[key]) : match;
  });
}

function t(lang, key, params) {
  const dict = I18N[lang] || I18N.en;
  const value = dict[key] || I18N.en[key] || key;
  return formatMessage(value, params);
}
