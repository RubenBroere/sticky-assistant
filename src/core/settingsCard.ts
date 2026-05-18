import { getTools } from '../tools/registry';
import { getToolSettingInitialValue } from './Tool';
import { loadToolSettings, saveToolSettings } from './settingsStore';

export function buildUnifiedSettingsCard() {
  const builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle('Settings'));

  const tools = getTools();
  tools.forEach((tool) => {
    const section = CardService.newCardSection().setHeader(tool.name);
    section.setCollapsible(true);
    // prefill values from the generic settings store
    let currentValues: Record<string, any> = {};
    if (tool.settings && tool.settings.length > 0) {
      currentValues = loadToolSettings(tool.id, tool.settings);
    }

    if (tool.settings && tool.settings.length > 0) {
      tool.settings.forEach((s) => {
        const prefill = getToolSettingInitialValue(s, currentValues[s.id]);
        if (s.type === 'multiline') {
          section.addWidget(
            CardService.newTextInput()
              .setFieldName(`${tool.id}__${s.id}`)
              .setTitle(s.label)
              .setValue(String(prefill || ''))
              .setMultiline(true)
          );
        } else if (s.type === 'checkbox') {
          section.addWidget(
            CardService.newSelectionInput()
              .setType(CardService.SelectionInputType.CHECK_BOX)
              .setFieldName(`${tool.id}__${s.id}`)
              .addItem(s.label, 'true', Boolean(prefill))
          );
        } else {
          section.addWidget(
            CardService.newTextInput()
              .setFieldName(`${tool.id}__${s.id}`)
              .setTitle(s.label)
              .setValue(String(prefill || ''))
          );
        }
      });
    } else {
      section.addWidget(
        CardService.newTextParagraph().setText('No settings available for this tool.')
      );
    }

    // Quick open button to tool homepage
    section.addWidget(
      CardService.newTextButton()
        .setText('Open Tool')
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('openTool')
            .setParameters({ toolId: tool.id, event: String(0) })
        )
    );

    builder.addSection(section);
  });

  const actionSection = CardService.newCardSection();
  actionSection.addWidget(
    CardService.newTextButton()
      .setText('Save Settings')
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(CardService.newAction().setFunctionName('saveUnifiedSettings'))
  );
  actionSection.addWidget(
    CardService.newTextButton()
      .setText('Back')
      .setOnClickAction(CardService.newAction().setFunctionName('onDefaultHomepage'))
  );
  builder.addSection(actionSection);

  return builder.build();
}

export function saveUnifiedSettings(e: any) {
  const formInput = e.formInput || {};
  const grouped: Record<string, Record<string, any>> = {};

  Object.keys(formInput).forEach((field) => {
    const parts = field.split('__');
    if (parts.length !== 2) return;
    const [toolId, settingId] = parts;
    grouped[toolId] = grouped[toolId] || {};
    const val = formInput[field];
    // For checkboxes, Apps Script returns 'true' when checked, undefined otherwise
    grouped[toolId][settingId] = val === 'true' ? true : val;
  });

  const errors: string[] = [];

  const tools = getTools();
  Object.keys(grouped).forEach((toolId) => {
    const tool = tools.find((t) => t.id === toolId);
    const values = grouped[toolId];

    // Validate using tool-provided validator if available
    if (tool && tool.validateSettings) {
      try {
        const result = tool.validateSettings(values);
        if (!result.ok) {
          errors.push(result.message || `${tool.name} validation failed`);
          return;
        }
      } catch (err: any) {
        errors.push(err?.message || `${tool?.name || toolId} validation error`);
        return;
      }
    }

    // Persist using generic settings store
    const res = saveToolSettings(toolId, values, tool?.settings);
    if (!res.ok) errors.push(res.message || `${toolId} settings failed`);
  });

  if (errors.length > 0) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(errors.join('; ')))
      .build();
  }

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Settings saved successfully'))
    .setNavigation(CardService.newNavigation().popToRoot().updateCard(buildUnifiedSettingsCard()))
    .build();
}
