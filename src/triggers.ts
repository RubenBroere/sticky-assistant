import { TriggerEvent } from './core/Tool';
import { buildToolSelectorCard } from './core/triggerHandler';

export function onDefaultHomepage(
  e: GoogleAppsScript.Addons.EventObject
): GoogleAppsScript.Card_Service.Card {
  return buildToolSelectorCard(e, TriggerEvent.DEFAULT_HOMEPAGE);
}

export function onDocsHomepage(
  e: GoogleAppsScript.Addons.EventObject
): GoogleAppsScript.Card_Service.Card {
  return buildToolSelectorCard(e, TriggerEvent.DOCS_HOMEPAGE);
}

export function onDriveHomepage(
  e: GoogleAppsScript.Addons.EventObject
): GoogleAppsScript.Card_Service.Card {
  return buildToolSelectorCard(e, TriggerEvent.DRIVE_HOMEPAGE);
}

export function onItemsSelected(
  e: GoogleAppsScript.Addons.EventObject
): GoogleAppsScript.Card_Service.Card {
  return buildToolSelectorCard(e, TriggerEvent.ITEMS_SELECTED);
}
