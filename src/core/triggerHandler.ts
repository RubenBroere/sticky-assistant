import { getTools } from '../tools/registry';
import { Tool, ToolTrigger, TriggerEvent } from './Tool';
import { getAppName } from './branding';

type TriggerEventObject = GoogleAppsScript.Addons.EventObject & {
  parameters?: Record<string, string>;
};

function isEnabled(trigger: ToolTrigger, e: GoogleAppsScript.Addons.EventObject) {
  try {
    return trigger.enabled(e);
  } catch {
    return false;
  }
}

function getMatchingTriggers(event: TriggerEvent, e: GoogleAppsScript.Addons.EventObject) {
  return getTools()
    .flatMap((tool: Tool) => tool.triggers.map((trigger) => ({ tool, trigger })))
    .filter(({ trigger }) => trigger.event === event)
    .filter(({ trigger }) => isEnabled(trigger, e));
}

export function openTool(e: TriggerEventObject): GoogleAppsScript.Card_Service.Card {
  const params = e.parameters || {};
  const toolId = params.toolId;
  const eventValue = Number(params.event ?? TriggerEvent.DEFAULT_HOMEPAGE);
  const tool = getTools().find((t) => t.id === toolId);
  if (!tool) {
    return buildToolSelectorCard(e, eventValue);
  }

  const trigger = tool.triggers.find((t) => t.event === eventValue && isEnabled(t, e));
  if (!trigger) {
    return buildToolSelectorCard(e, eventValue);
  }

  return trigger.createCard(e);
}

export function buildToolSelectorCard(e: GoogleAppsScript.Addons.EventObject, event: TriggerEvent) {
  const matches = getMatchingTriggers(event, e);
  if (matches.length === 1) return matches[0].trigger.createCard(e);

  const builder = CardService.newCardBuilder().setHeader(
    CardService.newCardHeader().setTitle(getAppName())
  );

  const section = CardService.newCardSection().addWidget(
    CardService.newTextParagraph().setText('Select a tool to get started:')
  );

  const tools =
    matches.length > 0
      ? matches
      : getTools()
          .flatMap((tool) => tool.triggers.map((trigger) => ({ tool, trigger })))
          .filter(({ trigger }) => isEnabled(trigger, e));
  tools.forEach(({ tool, trigger }) => {
    section.addWidget(
      CardService.newKeyValue()
        .setTopLabel(tool.name)
        .setIcon(tool.icon)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('openTool')
            .setParameters({ toolId: tool.id, event: String(trigger.event) })
        )
    );
  });

  builder.addSection(section);
  return builder.build();
}
