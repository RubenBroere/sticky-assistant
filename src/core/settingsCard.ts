import { getTools } from '../tools/registry';
import { Tool, getToolSettingInitialValue } from './Tool';
import {
  loadToolSettings,
  saveToolSettings,
  getActiveParentFolder,
  loadWorkspaceConfig,
  saveWorkspaceConfig,
} from './settingsStore';
import { COLORS, ICON_URLS } from './branding';

/**
 * Builds the unified configuration card. Supports a general multi-tool view
 * or a focused single-tool settings view.
 * All settings are rendered, monitored, and saved individually.
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

        // 1. Status indicator
        const statusWidget = CardService.newDecoratedText().setWrapText(true);
        if (s.secret) {
          statusWidget
            .setStartIcon(
              CardService.newIconImage().setIcon(CardService.Icon.CONFIRMATION_NUMBER_ICON)
            )
            .setText('<b>🔒 Global Layer Only</b>')
            .setBottomLabel('Private credential. Keep secure in your personal account properties.');
        } else if (isWorkspace) {
          statusWidget
            .setStartIcon(CardService.newIconImage().setIconUrl(ICON_URLS.success))
            .setText(`<font color="${COLORS.SUCCESS}"><b>Workspace Layer</b></font>`)
            .setBottomLabel("Stored locally in this folder's sticky-assistant.json file.");
        } else {
          statusWidget
            .setStartIcon(CardService.newIconImage().setIconUrl(ICON_URLS.info))
            .setText(`<font color="${COLORS.MUTED}"><b>Global Layer</b></font>`)
            .setBottomLabel('Using your account-wide preferences.');
        }
        section.addWidget(statusWidget);

        // 2. Input widget
        const prefill = getToolSettingInitialValue(s, currentValues[s.id]);
        const fieldName = `${tool.id}__${s.id}`;

        if (s.type === 'multiline') {
          section.addWidget(
            CardService.newTextInput()
              .setFieldName(fieldName)
              .setTitle(s.label)
              .setValue(String(prefill || ''))
              .setMultiline(true)
          );
        } else if (s.type === 'checkbox') {
          section.addWidget(
            CardService.newSelectionInput()
              .setType(CardService.SelectionInputType.CHECK_BOX)
              .setFieldName(fieldName)
              .addItem('Enabled', 'true', Boolean(prefill))
          );
        } else {
          section.addWidget(
            CardService.newTextInput()
              .setFieldName(fieldName)
              .setTitle(s.label)
              .setValue(String(prefill || ''))
          );
        }

        // 3. Action Buttons (Context-Sensitive & Decluttered)
        const buttonSet = CardService.newButtonSet();

        if (s.secret) {
          // Secret setting: Only allow saving to Global (Zero Workspace leak path)
          buttonSet.addButton(
            CardService.newTextButton()
              .setText('Save')
              .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
              .setOnClickAction(
                CardService.newAction().setFunctionName('saveIndividualSetting').setParameters({
                  toolId: tool.id,
                  settingId: s.id,
                  targetLayer: 'global',
                  isFocused: 'true',
                })
              )
          );
        } else if (isWorkspace) {
          // Workspace setting: Save (Workspace) and Reset (Global Revert)
          buttonSet.addButton(
            CardService.newTextButton()
              .setText('Save')
              .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
              .setOnClickAction(
                CardService.newAction().setFunctionName('saveIndividualSetting').setParameters({
                  toolId: tool.id,
                  settingId: s.id,
                  targetLayer: 'workspace',
                  isFocused: 'true',
                })
              )
          );

          buttonSet.addButton(
            CardService.newTextButton()
              .setText('Reset to Global')
              .setOnClickAction(
                CardService.newAction()
                  .setFunctionName('deleteWorkspaceOverride')
                  .setParameters({ toolId: tool.id, settingId: s.id, isFocused: 'true' })
              )
          );
        } else {
          // Global setting: Save (Global) and optionally Save to Workspace
          buttonSet.addButton(
            CardService.newTextButton()
              .setText('Save')
              .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
              .setOnClickAction(
                CardService.newAction().setFunctionName('saveIndividualSetting').setParameters({
                  toolId: tool.id,
                  settingId: s.id,
                  targetLayer: 'global',
                  isFocused: 'true',
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
                    isFocused: 'true',
                  })
                )
            );
          }
        }

        section.addWidget(buttonSet);
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
    const backAction = CardService.newAction().setFunctionName('onDefaultHomepage');
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
) {
  const settings = tool.settings;
  if (settings && settings.length > 0) {
    const currentValues = loadToolSettings(tool.id, settings, e);

    settings.forEach((s, idx) => {
      const isWorkspace =
        parentFolder &&
        localConfig &&
        localConfig[tool.id] &&
        localConfig[tool.id][s.id] !== undefined;

      // Setting Title & Status
      const statusWidget = CardService.newDecoratedText().setWrapText(true);
      if (s.secret) {
        statusWidget
          .setStartIcon(
            CardService.newIconImage().setIcon(CardService.Icon.CONFIRMATION_NUMBER_ICON)
          )
          .setText(`<b>${s.label}</b> <font color="${COLORS.MUTED}">(🔒 Global Only)</font>`)
          .setBottomLabel('Private credential. Kept secure in your account properties.');
      } else if (isWorkspace) {
        statusWidget
          .setStartIcon(CardService.newIconImage().setIconUrl(ICON_URLS.success))
          .setText(`<b>${s.label}</b> <font color="${COLORS.SUCCESS}">(Workspace Override)</font>`)
          .setBottomLabel("Stored locally in this folder's sticky-assistant.json.");
      } else {
        statusWidget
          .setStartIcon(CardService.newIconImage().setIconUrl(ICON_URLS.info))
          .setText(`<b>${s.label}</b> <font color="${COLORS.MUTED}">(Global Active)</font>`)
          .setBottomLabel('Using your account-wide preferences.');
      }
      section.addWidget(statusWidget);

      // Input widget
      const prefill = getToolSettingInitialValue(s, currentValues[s.id]);
      const fieldName = `${tool.id}__${s.id}`;

      if (s.type === 'multiline') {
        section.addWidget(
          CardService.newTextInput()
            .setFieldName(fieldName)
            .setTitle(s.label)
            .setValue(String(prefill || ''))
            .setMultiline(true)
        );
      } else if (s.type === 'checkbox') {
        section.addWidget(
          CardService.newSelectionInput()
            .setType(CardService.SelectionInputType.CHECK_BOX)
            .setFieldName(fieldName)
            .addItem('Enabled', 'true', Boolean(prefill))
        );
      } else {
        section.addWidget(
          CardService.newTextInput()
            .setFieldName(fieldName)
            .setTitle(s.label)
            .setValue(String(prefill || ''))
        );
      }

      // Buttons (Context-Sensitive & Decluttered)
      const buttonSet = CardService.newButtonSet();

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
                isFocused: 'false',
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
                isFocused: 'false',
              })
            )
        );

        buttonSet.addButton(
          CardService.newTextButton()
            .setText('Reset')
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('deleteWorkspaceOverride')
                .setParameters({ toolId: tool.id, settingId: s.id, isFocused: 'false' })
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
                isFocused: 'false',
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
                  isFocused: 'false',
                })
              )
          );
        }
      }

      section.addWidget(buttonSet);

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

  // Validate single setting change if tool validator exists
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
