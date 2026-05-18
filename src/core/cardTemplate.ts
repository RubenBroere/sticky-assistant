import { Tool } from './Tool';

type ToolCardMeta = Pick<Tool, 'id' | 'name' | 'icon' | 'settings'>;

export function buildToolCard(
  tool: ToolCardMeta,
  info?: string
): GoogleAppsScript.Card_Service.CardBuilder {
  const builder = CardService.newCardBuilder();

  // Header with tool name
  builder.setHeader(CardService.newCardHeader().setTitle(tool.name));

  if (info) {
    const infoSection = CardService.newCardSection();
    infoSection.addWidget(CardService.newKeyValue().setContent(info).setIcon(tool.icon));
    builder.addSection(infoSection);
  }

  // If the tool exposes settings, show a quick Settings button on the tool card
  if (tool.settings && tool.settings.length > 0) {
    const actionSection = CardService.newCardSection();
    const settingsAction = CardService.newAction()
      .setFunctionName('buildUnifiedSettingsCard')
      .setParameters({
        toolId: tool.id,
      });
    actionSection.addWidget(
      CardService.newTextButton().setText('⚙️ Settings').setOnClickAction(settingsAction)
    );
    builder.addSection(actionSection);
  }

  return builder;
}
