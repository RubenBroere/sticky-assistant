import { getTools } from '../tools/registry';
import { Tool, getToolSettingInitialValue, ToolSetting } from './Tool';
import {
  loadToolSettings,
  saveToolSettings,
  getActiveParentFolder,
  loadWorkspaceConfig,
  saveWorkspaceConfig,
} from './settingsStore';
import { COLORS, ICON_URLS } from './branding';

/**
 * Helper to build setting input widgets dynamically based on the setting type.
 */
function createSettingInputWidget(
  s: ToolSetting,
  fieldName: string,
  prefill: any
): GoogleAppsScript.Card_Service.Widget {
  if (s.type === 'multiline') {
    return CardService.newTextInput()
      .setFieldName(fieldName)
      .setTitle(s.label)
      .setValue(String(prefill || ''))
      .setMultiline(true);
  } else if (s.type === 'checkbox') {
    return CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.CHECK_BOX)
      .setFieldName(fieldName)
      .addItem('Enabled', 'true', Boolean(prefill));
  } else if (s.type === 'dropdown') {
    const dropdown = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName(fieldName)
      .setTitle(s.label);
    if (s.options) {
      s.options.forEach((opt) => {
        dropdown.addItem(opt.label, opt.value, String(prefill) === opt.value);
      });
    }
    return dropdown;
  } else {
    return CardService.newTextInput()
      .setFieldName(fieldName)
      .setTitle(s.label)
      .setValue(String(prefill || ''));
  }
}

/**
 * Helper to render individual setting fields, status indicators, and context buttons.
 */
function renderSingleSetting(
  section: GoogleAppsScript.Card_Service.CardSection,
  tool: Tool,
  s: ToolSetting,
  prefill: any,
  parentFolder: GoogleAppsScript.Drive.Folder | null,
  isWorkspace: boolean,
  isFocused: boolean
): void {
  // 1. Status indicator
  const statusWidget = CardService.newDecoratedText().setWrapText(true);
  const labelText = isFocused ? '' : `<b>${s.label}</b> `;

  if (s.secret) {
    statusWidget
      .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.CONFIRMATION_NUMBER_ICON))
      .setText(`${labelText}<font color="${COLORS.MUTED}"><b>(🔒 Global Only)</b></font>`)
      .setBottomLabel('Private credential. Keep secure in your personal account properties.');
  } else if (isWorkspace) {
    statusWidget
      .setStartIcon(CardService.newIconImage().setIconUrl(ICON_URLS.success))
      .setText(
        `${labelText}<font color="${COLORS.SUCCESS}"><b>${
          isFocused ? 'Workspace Layer' : '(Workspace Override)'
        }</b></font>`
      )
      .setBottomLabel("Stored locally in this folder's sticky-assistant.json file.");
  } else {
    statusWidget
      .setStartIcon(CardService.newIconImage().setIconUrl(ICON_URLS.info))
      .setText(
        `${labelText}<font color="${COLORS.MUTED}"><b>${
          isFocused ? 'Global Layer' : '(Global Active)'
        }</b></font>`
      )
      .setBottomLabel('Using your account-wide preferences.');
  }
  section.addWidget(statusWidget);

  // 2. Input widget
  const fieldName = `${tool.id}__${s.id}`;
  section.addWidget(createSettingInputWidget(s, fieldName, prefill));

  // 3. Action Buttons
  const buttonSet = CardService.newButtonSet();
  const isFocusedStr = isFocused ? 'true' : 'false';

  if (s.secret) {
    buttonSet.addButton(
      CardService.newTextButton()
        .setText('Save')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction().setFunctionName('saveIndividualSetting').setParameters({
            toolId: tool.id,
            settingId: s.id,
            targetLayer: 'global',
            isFocused: isFocusedStr,
          })
        )
    );
  } else if (isWorkspace) {
    buttonSet.addButton(
      CardService.newTextButton()
        .setText('Save')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction().setFunctionName('saveIndividualSetting').setParameters({
            toolId: tool.id,
            settingId: s.id,
            targetLayer: 'workspace',
            isFocused: isFocusedStr,
          })
        )
    );

    buttonSet.addButton(
      CardService.newTextButton()
        .setText(isFocused ? 'Reset to Global' : 'Reset')
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('deleteWorkspaceOverride')
            .setParameters({ toolId: tool.id, settingId: s.id, isFocused: isFocusedStr })
        )
    );
  } else {
    buttonSet.addButton(
      CardService.newTextButton()
        .setText('Save')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction().setFunctionName('saveIndividualSetting').setParameters({
            toolId: tool.id,
            settingId: s.id,
            targetLayer: 'global',
            isFocused: isFocusedStr,
          })
        )
    );

    if (parentFolder) {
      buttonSet.addButton(
        CardService.newTextButton()
          .setText('Save to Workspace')
          .setOnClickAction(
            CardService.newAction().setFunctionName('saveIndividualSetting').setParameters({
              toolId: tool.id,
              settingId: s.id,
              targetLayer: 'workspace',
              isFocused: isFocusedStr,
            })
          )
      );
    }
  }

  section.addWidget(buttonSet);
}

/**
 * Builds the unified configuration card. Supports a general multi-tool view
 * or a focused single-tool settings view.
 */
export function buildUnifiedSettingsCard(e?: {
  parameters?: Record<string, string>;
}): GoogleAppsScript.Card_Service.Card {
  const params = e?.parameters || {};
  const focusedToolId = params.toolId;

  const builder = CardService.newCardBuilder();
  const tools = getTools();

  // 1. Detect parent folder context
  const parentFolder = getActiveParentFolder(e);
  const localConfig = parentFolder ? loadWorkspaceConfig(parentFolder) : null;
  const hasLocalOverride = parentFolder && localConfig && Object.keys(localConfig).length > 0;

  const bannerSection = CardService.newCardSection().setHeader('Configuration Status');
  if (parentFolder) {
    if (hasLocalOverride) {
      bannerSection.addWidget(
        CardService.newDecoratedText()
          .setStartIcon(CardService.newIconImage().setIconUrl(ICON_URLS.success))
          .setText('<b>🟢 Workspace Settings Active</b>')
          .setBottomLabel(
            `Folder: ${parentFolder.getName()}\nPreferring settings from local sticky-assistant.json file.`
          )
          .setWrapText(true)
      );
    } else {
      bannerSection.addWidget(
        CardService.newDecoratedText()
          .setStartIcon(CardService.newIconImage().setIconUrl(ICON_URLS.info))
          .setText('<b>⚪ Global Settings Active</b>')
          .setBottomLabel(
            `Folder: ${parentFolder.getName()}\nCurrently using your global account preferences.`
          )
          .setWrapText(true)
      );
    }
  } else {
    bannerSection.addWidget(
      CardService.newDecoratedText()
        .setStartIcon(CardService.newIconImage().setIconUrl(ICON_URLS.info))
        .setText('<b>Global Settings Active</b>')
        .setBottomLabel('Could not determine active parent folder. Saving globally.')
        .setWrapText(true)
    );
  }
  builder.addSection(bannerSection);

  // 2. Render tool sections
  if (focusedToolId) {
    // Focused Tool settings view
    const tool = tools.find((t) => t.id === focusedToolId);
    if (!tool) {
      return buildUnifiedSettingsCard(); // Fallback if tool ID is invalid
    }

    builder.setHeader(
      CardService.newCardHeader()
        .setTitle(`<font color="${COLORS.PRIMARY}"><b>Configure ${tool.name}</b></font>`)
        .setImageUrl(ICON_URLS[tool.id as keyof typeof ICON_URLS] || '')
    );

    if (tool.settings && tool.settings.length > 0) {
      const currentValues = loadToolSettings(tool.id, tool.settings, e);

      tool.settings.forEach((s) => {
        const isWorkspace =
          parentFolder &&
          localConfig &&
          localConfig[tool.id] &&
          localConfig[tool.id][s.id] !== undefined;

        const section = CardService.newCardSection().setHeader(s.label);
        const prefill = getToolSettingInitialValue(s, currentValues[s.id]);

        renderSingleSetting(section, tool, s, prefill, parentFolder, isWorkspace, true);
        builder.addSection(section);
      });
    } else {
      const section = CardService.newCardSection();
      section.addWidget(
        CardService.newDecoratedText()
          .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.DESCRIPTION))
          .setText(
            `<font color="${COLORS.MUTED}"><i>No settings available for this tool.</i></font>`
          )
      );
      builder.addSection(section);
    }

    // Navigation Back to tool at the bottom
    const actionSection = CardService.newCardSection();
    const backToToolAction = CardService.newAction()
      .setFunctionName('openTool')
      .setParameters({ toolId: focusedToolId });

    actionSection.addWidget(
      CardService.newTextButton().setText('Back to Tool').setOnClickAction(backToToolAction)
    );
    builder.addSection(actionSection);
  } else {
    // General all-tools settings view
    builder.setHeader(
      CardService.newCardHeader()
        .setTitle(`<font color="${COLORS.PRIMARY}"><b>Settings</b></font>`)
        .setImageUrl(ICON_URLS.settings)
    );

    tools.forEach((tool) => {
      const section = CardService.newCardSection().setHeader(tool.name).setCollapsible(true);

      renderToolSettingsToGeneralSection(tool, section, e, parentFolder, localConfig);

      // Open Tool button inside the section
      const openToolAction = CardService.newAction()
        .setFunctionName('openTool')
        .setParameters({ toolId: tool.id });

      section.addWidget(
        CardService.newTextButton().setText(`Open ${tool.name}`).setOnClickAction(openToolAction)
      );

      builder.addSection(section);
    });

    const actionSection = CardService.newCardSection();
    const backAction = CardService.newAction().setFunctionName('openToolSelector');
    actionSection.addWidget(
      CardService.newTextButton().setText('Back to Home').setOnClickAction(backAction)
    );
    builder.addSection(actionSection);
  }

  return builder.build();
}

/**
 * Helper to render individual setting fields and individual save controls into a collapsible section.
 */
function renderToolSettingsToGeneralSection(
  tool: Tool,
  section: GoogleAppsScript.Card_Service.CardSection,
  e: any,
  parentFolder: GoogleAppsScript.Drive.Folder | null,
  localConfig: Record<string, any> | null
): void {
  const settings = tool.settings;
  if (settings && settings.length > 0) {
    const currentValues = loadToolSettings(tool.id, settings, e);

    settings.forEach((s, idx) => {
      const isWorkspace =
        parentFolder &&
        localConfig &&
        localConfig[tool.id] &&
        localConfig[tool.id][s.id] !== undefined;

      const prefill = getToolSettingInitialValue(s, currentValues[s.id]);

      renderSingleSetting(section, tool, s, prefill, parentFolder, isWorkspace, false);

      // Separator if not last
      if (idx < settings.length - 1) {
        section.addWidget(
          CardService.newDecoratedText().setText(
            `<font color="${COLORS.LIGHT}">───────────────────────────────────────</font>`
          )
        );
      }
    });
  } else {
    section.addWidget(
      CardService.newDecoratedText()
        .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.DESCRIPTION))
        .setText(`<font color="${COLORS.MUTED}"><i>No settings available for this tool.</i></font>`)
    );
  }
}

/**
 * Callback to save a single setting individually.
 */
export function saveIndividualSetting(e: {
  formInput?: Record<string, string>;
  parameters?: Record<string, string>;
}) {
  const formInput = e.formInput || {};
  const params = e.parameters || {};
  const toolId = params.toolId;
  const settingId = params.settingId;
  const targetLayer = params.targetLayer || 'global';
  const isFocused = params.isFocused === 'true';

  if (!toolId || !settingId) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error: Missing tool or setting ID.'))
      .build();
  }

  const tools = getTools();
  const tool = tools.find((t) => t.id === toolId);
  if (!tool || !tool.settings) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error: Tool not found.'))
      .build();
  }

  const settingDef = tool.settings.find((s) => s.id === settingId);
  if (!settingDef) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error: Setting not found.'))
      .build();
  }

  // Security Enforcement: Private/Secret settings must never be pushed to Workspace config
  if (settingDef.secret && targetLayer === 'workspace') {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText(
          'Security Error: Private settings can only be saved to the Global layer.'
        )
      )
      .build();
  }

  const fieldName = `${toolId}__${settingId}`;
  const rawVal = formInput[fieldName];

  let val: any = rawVal;
  if (settingDef.type === 'checkbox') {
    val = rawVal === 'true';
  }

  // Validate single setting change
  if (settingDef.validate) {
    const parsedVal = settingDef.parse ? settingDef.parse(val) : val;
    const validation = settingDef.validate(parsedVal);
    if (!validation.ok) {
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText(`Validation Error: ${validation.message}`)
        )
        .build();
    }
  }

  if (tool.validateSettings) {
    try {
      const currentValues = loadToolSettings(toolId, tool.settings, e);
      currentValues[settingId] = val;
      const validation = tool.validateSettings(currentValues);
      if (!validation.ok) {
        return CardService.newActionResponseBuilder()
          .setNotification(
            CardService.newNotification().setText(`Validation Error: ${validation.message}`)
          )
          .build();
      }
    } catch (err: any) {
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText(`Validation Error: ${err?.message || String(err)}`)
        )
        .build();
    }
  }

  const res = saveToolSettings(toolId, { [settingId]: val }, [settingDef], targetLayer, e);
  if (!res.ok) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText(`Error: ${res.message || 'Could not save setting.'}`)
      )
      .build();
  }

  const redirectCard = buildUnifiedSettingsCard({
    parameters: isFocused ? { toolId } : {},
  });

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Setting saved successfully'))
    .setNavigation(CardService.newNavigation().popToRoot().updateCard(redirectCard))
    .build();
}

/**
 * Callback to delete a workspace override, falling back to global.
 */
export function deleteWorkspaceOverride(e: { parameters?: Record<string, string> }) {
  const params = e.parameters || {};
  const toolId = params.toolId;
  const settingId = params.settingId;
  const isFocused = params.isFocused === 'true';

  if (!toolId || !settingId) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error: Missing tool or setting ID.'))
      .build();
  }

  const parentFolder = getActiveParentFolder(e);
  if (!parentFolder) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText('Error: Workspace folder not accessible.')
      )
      .build();
  }

  try {
    const localConfig = loadWorkspaceConfig(parentFolder);
    if (localConfig && localConfig[toolId] && localConfig[toolId][settingId] !== undefined) {
      delete localConfig[toolId][settingId];

      if (Object.keys(localConfig[toolId]).length === 0) {
        delete localConfig[toolId];
      }

      const res = saveWorkspaceConfig(parentFolder, localConfig);
      if (!res) throw new Error('Could not write updated sticky-assistant.json.');
    }

    const redirectCard = buildUnifiedSettingsCard({
      parameters: isFocused ? { toolId } : {},
    });

    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText('Reset Workspace override successfully')
      )
      .setNavigation(CardService.newNavigation().popToRoot().updateCard(redirectCard))
      .build();
  } catch (err: any) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText(`Error resetting: ${err?.message || String(err)}`)
      )
      .build();
  }
}
