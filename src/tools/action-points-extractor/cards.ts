import { formatPeopleConfig, parsePeopleConfig, validateActionPointsConfig } from './config';
import { loadToolSettings, saveToolSettings } from '../../core/settingsStore';
import { ActionPointsScanResult, scanActionPointsDocument } from './scanning';
import { ACTION_POINTS_SETTINGS } from './settings';
import {
  applyDocumentActionsLogic,
  sendToTodoistLogic,
  populatePeopleConfigLogic,
} from './editing';

function formatActionPoint(nameText: string, actionText: string, dateText: string | null) {
  const dateSuffix = dateText ? ` <font color="#888888"><i>[Due: ${dateText}]</i></font>` : '';
  return `<b>${nameText}</b>: ${actionText}${dateSuffix}`;
}

import { buildToolCard } from '../../core/cardTemplate';

function createActionPointsBuilder() {
  // Use shared template; provide the tool metadata inline
  const toolMeta = {
    id: 'actionPointsExtractor',
    name: 'Action Points',
    icon: CardService.Icon.STORE,
    settings: ACTION_POINTS_SETTINGS,
    triggers: [],
  };
  return buildToolCard(toolMeta, 'Scan documents for action items and optionally sync to Todoist.');
}

export function createActionPointsHomepage(): GoogleAppsScript.Card_Service.Card {
  const builder = createActionPointsBuilder();
  const section = CardService.newCardSection();

  const scanAction = CardService.newAction().setFunctionName('scanDocument');
  section.addWidget(
    CardService.newTextButton()
      .setText('Scan Document')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(scanAction)
  );

  builder.addSection(section);
  return builder.build();
}

export function buildActionPointsSettingsCard(): GoogleAppsScript.Card_Service.Card {
  const configRaw = loadToolSettings('actionPointsExtractor', ACTION_POINTS_SETTINGS);
  const config = {
    todoistToken: String(configRaw.todoistToken || ''),
    todoistProjectId: String(configRaw.todoistProjectId || ''),
    todoistEnabled: Boolean(configRaw.enableTodoist),
    peopleConfig: parsePeopleConfig(String(configRaw.peopleConfig || '')),
  };
  const builder = createActionPointsBuilder();

  const section = CardService.newCardSection();
  section.addWidget(
    CardService.newTextInput()
      .setFieldName('todoistToken')
      .setTitle('Todoist Token')
      .setValue(config.todoistToken)
  );
  section.addWidget(
    CardService.newTextInput()
      .setFieldName('todoistProjectId')
      .setTitle('Todoist Project ID')
      .setValue(config.todoistProjectId)
  );
  section.addWidget(
    CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.CHECK_BOX)
      .setFieldName('enableTodoist')
      .addItem('Enable Todoist', 'true', config.todoistEnabled)
  );
  section.addWidget(CardService.newTextParagraph().setText('Help text for people configuration'));
  section.addWidget(
    CardService.newTextInput()
      .setFieldName('peopleConfig')
      .setTitle('People Configuration')
      .setValue(formatPeopleConfig(config.peopleConfig))
      .setMultiline(true)
  );
  builder.addSection(section);

  const actionSection = CardService.newCardSection();
  actionSection.addWidget(
    CardService.newTextButton()
      .setText('Save Settings')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(CardService.newAction().setFunctionName('saveActionPointsSettings'))
  );
  actionSection.addWidget(
    CardService.newTextButton()
      .setText('Back')
      .setOnClickAction(CardService.newAction().setFunctionName('onActionPointsHomepage'))
  );
  builder.addSection(actionSection);
  return builder.build();
}

export function buildActionPointsScanResultsCard(
  scanResult: ActionPointsScanResult
): GoogleAppsScript.Card_Service.Card {
  const builder = createActionPointsBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle('Scan Results'));

  const openSection = CardService.newCardSection().setHeader('Open Action Points');
  if (scanResult.openTasks.length === 0) {
    openSection.addWidget(
      CardService.newTextParagraph().setText(`<i>No open action points found.</i>`)
    );
  } else {
    scanResult.openTasks.forEach((task) => {
      openSection.addWidget(
        CardService.newTextParagraph().setText(
          formatActionPoint(task.person, task.action, task.date)
        )
      );
    });
  }
  builder.addSection(openSection);

  const completedSection = CardService.newCardSection()
    .setHeader('Completed Action Points')
    .setCollapsible(true)
    .setNumUncollapsibleWidgets(0);
  if (scanResult.completedTasks.length === 0) {
    completedSection.addWidget(
      CardService.newTextParagraph().setText(`<i>No completed action points found.</i>`)
    );
  } else {
    scanResult.completedTasks.forEach((task) => {
      completedSection.addWidget(
        CardService.newTextParagraph().setText(
          `<font color="#999999"><s>${formatActionPoint(task.person, task.action, task.date)}</s></font>`
        )
      );
    });
  }
  builder.addSection(completedSection);

  const actionSection = CardService.newCardSection();
  const configRaw = loadToolSettings('actionPointsExtractor', ACTION_POINTS_SETTINGS);
  const config = { todoistEnabled: !!configRaw.enableTodoist };

  if (config.todoistEnabled && scanResult.openTasks.length > 0) {
    actionSection.addWidget(
      CardService.newTextButton()
        .setText('Send Open to Todoist')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('sendToTodoist')
            .setParameters({ tasksJson: JSON.stringify(scanResult.openTasks) })
        )
    );
  }

  if (config.todoistEnabled && scanResult.openTasks.length === 0) {
    actionSection.addWidget(
      CardService.newTextParagraph().setText(`<i>No open action points to sync.</i>`)
    );
  }

  if (scanResult.openMatches.length > 0 || scanResult.completedMatches.length > 0) {
    actionSection.addWidget(
      CardService.newSelectionInput()
        .setType(CardService.SelectionInputType.CHECK_BOX)
        .setFieldName('addToTopAction')
        .addItem('Add to Top', 'addToTop', false)
    );
    actionSection.addWidget(
      CardService.newSelectionInput()
        .setType(CardService.SelectionInputType.CHECK_BOX)
        .setFieldName('replaceInPlaceAction')
        .addItem('Replace in Place', 'replaceInPlace', false)
    );

    actionSection.addWidget(
      CardService.newTextButton()
        .setText('Apply Document Changes')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('applyDocumentActions')
            .setParameters({
              matchesJson: JSON.stringify({
                openMatches: scanResult.openMatches,
                completedMatches: scanResult.completedMatches,
              }),
            })
        )
    );
  }

  const foundPeopleList = Object.keys(scanResult.foundPeople).filter(
    (name) => name.toLowerCase() !== 'everyone'
  );
  if (foundPeopleList.length > 0) {
    actionSection.addWidget(
      CardService.newTextButton()
        .setText('Add People to Settings')
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('populatePeopleConfig')
            .setParameters({ peopleJson: JSON.stringify(foundPeopleList) })
        )
    );
  }

  if (!config.todoistEnabled) {
    actionSection.addWidget(
      CardService.newTextParagraph().setText(`<i>No open action points to sync.</i>`)
    );
  }

  actionSection.addWidget(
    CardService.newTextButton()
      .setText('Back')
      .setOnClickAction(CardService.newAction().setFunctionName('onActionPointsHomepage'))
  );

  builder.addSection(actionSection);
  return builder.build();
}

export function scanDocument() {
  const scanResult = scanActionPointsDocument();
  if (!scanResult) {
    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle('No Document Found'))
      .addSection(
        CardService.newCardSection().addWidget(
          CardService.newTextParagraph().setText(
            `Please open a Google Docs document and try again.`
          )
        )
      )
      .build();
  }

  if (
    scanResult.openTasks.length === 0 &&
    scanResult.completedTasks.length === 0 &&
    scanResult.openMatches.length === 0 &&
    scanResult.completedMatches.length === 0
  ) {
    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle('No Action Points Found'))
      .addSection(
        CardService.newCardSection().addWidget(
          CardService.newTextParagraph().setText('No open or completed action points found.')
        )
      )
      .build();
  }

  return buildActionPointsScanResultsCard(scanResult);
}

export function sendToTodoist(e: GoogleAppsScript.Addons.EventObject) {
  const result = sendToTodoistLogic(e);
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(result.message))
    .build();
}

export function applyDocumentActions(e: GoogleAppsScript.Addons.EventObject) {
  const result = applyDocumentActionsLogic(e);
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(result.message))
    .build();
}

export function populatePeopleConfig(e: GoogleAppsScript.Addons.EventObject) {
  const result = populatePeopleConfigLogic(e);
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(result.message))
    .build();
}

export function saveActionPointsSettings(e: any) {
  const form = e.formInput || {};
  const validation = validateActionPointsConfig(form);
  if (!validation.ok) {
    return createActionPointsBuilder()
      .addSection(
        CardService.newCardSection().addWidget(
          CardService.newTextParagraph().setText(validation.message || 'Invalid settings')
        )
      )
      .build();
  }

  const res = saveToolSettings('actionPointsExtractor', form, ACTION_POINTS_SETTINGS);
  if (!res.ok) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(res.message || 'Save failed'))
      .build();
  }

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Settings saved successfully'))
    .setNavigation(
      CardService.newNavigation().popCard().updateCard(buildActionPointsSettingsCard())
    )
    .build();
}
