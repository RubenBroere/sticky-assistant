import { buildToolCard, buildToolFooter } from '../../core/cardTemplate';
import { COLORS } from '../../core/branding';

const TOOL_META = {
  id: 'propertiesDebugger',
  name: 'Properties Debugger',
  icon: CardService.Icon.DESCRIPTION,
};

/**
 * Renders the main debugger homepage listing all raw user properties.
 */
export function createPropertiesDebuggerHomepage(_e: any): GoogleAppsScript.Card_Service.Card {
  const builder = buildToolCard(
    TOOL_META,
    'Inspect, edit, and delete raw User Properties stored in PropertiesService.'
  );

  // Danger Warning Banner Section
  const warningSection = CardService.newCardSection();
  warningSection.addWidget(
    CardService.newDecoratedText()
      .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.EMAIL)) // Fallback warning icon
      .setText(
        `<font color="${COLORS.ERROR}"><b>⚠️ DANGEROUS OPERATIONS</b></font>\n` +
          'Modifying or deleting raw properties can corrupt your configurations, ' +
          'break background execution triggers, or delete enqueued settings. ' +
          'Do not modify values unless you know exactly what you are doing.'
      )
      .setWrapText(true)
  );
  builder.addSection(warningSection);

  // Add Property Section
  const actionsSection = CardService.newCardSection();
  const createAction = CardService.newAction().setFunctionName('openEditPropertyCard');
  actionsSection.addWidget(
    CardService.newTextButton()
      .setText('➕ Add New Property')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(createAction)
  );
  builder.addSection(actionsSection);

  // List of properties
  const listSection = CardService.newCardSection().setHeader('Active Properties');
  const props = PropertiesService.getUserProperties();
  const allProps = props.getProperties();
  const keys = Object.keys(allProps).sort();

  if (keys.length === 0) {
    listSection.addWidget(
      CardService.newDecoratedText()
        .setText('<b>No Properties Found</b>')
        .setBottomLabel('PropertiesService is currently empty.')
        .setWrapText(true)
    );
  } else {
    keys.forEach((key) => {
      const value = allProps[key] || '';
      const displayValue =
        value.length > 200
          ? value.substring(0, 200) + '\n<font color="#999999">[Truncated]</font>'
          : value;

      const detailText = `<b>Key:</b> <code>${key}</code>\n<b>Value:</b>\n<font color="#555555">${displayValue}</font>`;

      const editAction = CardService.newAction()
        .setFunctionName('openEditPropertyCard')
        .setParameters({ key });

      const deleteAction = CardService.newAction()
        .setFunctionName('openDeletePropertyConfirmCard')
        .setParameters({ key });

      const buttonSet = CardService.newButtonSet()
        .addButton(CardService.newTextButton().setText('Edit').setOnClickAction(editAction))
        .addButton(CardService.newTextButton().setText('Delete').setOnClickAction(deleteAction));

      listSection.addWidget(CardService.newDecoratedText().setText(detailText).setWrapText(true));
      listSection.addWidget(buttonSet);
      listSection.addWidget(
        CardService.newDecoratedText().setText(
          '<font color="#e0e0e0">────────────────────────────</font>'
        )
      );
    });
  }

  builder.addSection(listSection);
  builder.addSection(buildToolFooter('propertiesDebugger', false));

  return builder.build();
}

/**
 * Renders the edit/create property card.
 */
export function openEditPropertyCard(e: any): GoogleAppsScript.Card_Service.Card {
  const key = e.parameters.key;
  const isNew = !key;

  const builder = CardService.newCardBuilder().setHeader(
    CardService.newCardHeader()
      .setTitle(isNew ? 'Add Property' : 'Edit Property')
      .setSubtitle(isNew ? 'Define a new key-value pair' : `Modify key: ${key}`)
  );

  const section = CardService.newCardSection();

  // Red Warning Prompt
  section.addWidget(
    CardService.newDecoratedText()
      .setText(
        `<font color="${COLORS.ERROR}"><b>⚠️ Warning</b></font>: Ensure your property key and JSON value formatting are valid.`
      )
      .setWrapText(true)
  );

  if (isNew) {
    section.addWidget(
      CardService.newTextInput()
        .setFieldName('key')
        .setTitle('Property Key')
        .setHint('e.g. calendarSync__job__job_123')
    );
  } else {
    section.addWidget(
      CardService.newDecoratedText()
        .setText(`<b>Editing Key:</b> <code>${key}</code>`)
        .setBottomLabel('Key cannot be changed. Delete and recreate if necessary.')
    );
  }

  const existingVal = isNew ? '' : PropertiesService.getUserProperties().getProperty(key) || '';

  section.addWidget(
    CardService.newTextInput()
      .setFieldName('value')
      .setTitle('Property Value')
      .setHint('Enter raw text or JSON string')
      .setMultiline(true)
      .setValue(existingVal)
  );

  const saveAction = CardService.newAction()
    .setFunctionName('savePropertyAction')
    .setParameters(isNew ? {} : { key });

  const cancelAction = CardService.newAction()
    .setFunctionName('openTool')
    .setParameters({ toolId: 'propertiesDebugger' });

  const footerButtons = CardService.newButtonSet()
    .addButton(
      CardService.newTextButton()
        .setText('Save Property')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(saveAction)
    )
    .addButton(CardService.newTextButton().setText('Cancel').setOnClickAction(cancelAction));

  section.addWidget(footerButtons);
  builder.addSection(section);

  return builder.build();
}

/**
 * Save property handler.
 */
export function savePropertyAction(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  const form = e.formInput || {};
  const key = e.parameters.key || (form.key ? form.key.trim() : '');
  const value = form.value || '';

  if (!key) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error: Property Key is required.'))
      .build();
  }

  try {
    PropertiesService.getUserProperties().setProperty(key, value);

    const debuggerCard = createPropertiesDebuggerHomepage(e);
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().popToRoot().updateCard(debuggerCard))
      .setNotification(
        CardService.newNotification().setText(`Property '${key}' saved successfully.`)
      )
      .build();
  } catch (err: any) {
    console.error('Failed to save user property:', err);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(`Error: ${err?.message || err}`))
      .build();
  }
}

/**
 * Confirmation dialog before property deletion.
 */
export function openDeletePropertyConfirmCard(e: any): GoogleAppsScript.Card_Service.Card {
  const key = e.parameters.key;

  const builder = CardService.newCardBuilder().setHeader(
    CardService.newCardHeader().setTitle('Confirm Property Deletion').setSubtitle(key)
  );

  const section = CardService.newCardSection();

  section.addWidget(
    CardService.newDecoratedText()
      .setText(
        `<font color="${COLORS.ERROR}"><b>⚠️ Permanently Delete Property?</b></font>\n\n` +
          `Are you sure you want to delete the user property key: <code>${key}</code>?\n` +
          'This action is irreversible and might cause tool functionality issues if referenced elsewhere.'
      )
      .setWrapText(true)
  );

  const deleteAction = CardService.newAction()
    .setFunctionName('deletePropertyAction')
    .setParameters({ key });

  const cancelAction = CardService.newAction()
    .setFunctionName('openTool')
    .setParameters({ toolId: 'propertiesDebugger' });

  const buttonSet = CardService.newButtonSet()
    .addButton(
      CardService.newTextButton()
        .setText('Yes, Delete Permanent')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(deleteAction)
    )
    .addButton(CardService.newTextButton().setText('Cancel').setOnClickAction(cancelAction));

  section.addWidget(buttonSet);
  builder.addSection(section);

  return builder.build();
}

/**
 * Delete property handler.
 */
export function deletePropertyAction(e: any): GoogleAppsScript.Card_Service.ActionResponse {
  const key = e.parameters.key;

  if (!key) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error: Property Key not found.'))
      .build();
  }

  try {
    PropertiesService.getUserProperties().deleteProperty(key);

    const debuggerCard = createPropertiesDebuggerHomepage(e);
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().popToRoot().updateCard(debuggerCard))
      .setNotification(
        CardService.newNotification().setText(`Property '${key}' deleted permanently.`)
      )
      .build();
  } catch (err: any) {
    console.error('Failed to delete property:', err);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(`Error: ${err?.message || err}`))
      .build();
  }
}
