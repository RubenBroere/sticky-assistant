export interface ToolSetting {
  id: string;
  label: string;
  type: 'text' | 'multiline' | 'checkbox' | 'number';
  placeholder?: string;
  default?: string | boolean | number;
  value?: string | boolean | number;
}

export function getToolSettingDefaultValue(
  setting: ToolSetting
): string | boolean | number | undefined {
  return setting.default ?? setting.value;
}

export function getToolSettingInitialValue(
  setting: ToolSetting,
  storedValue: string | boolean | number | undefined
): string | boolean | number {
  if (storedValue !== undefined) return storedValue;

  const defaultValue = getToolSettingDefaultValue(setting);
  if (defaultValue !== undefined) return defaultValue;

  return setting.type === 'checkbox' ? false : '';
}

export interface Tool {
  id: string;
  name: string;
  icon: GoogleAppsScript.Card_Service.Icon;
  triggers: ToolTrigger[];
  info?: string;
  settings?: ToolSetting[];
  validateSettings?: (formInput: Record<string, unknown>) => { ok: boolean; message?: string };
}

export interface ToolTrigger {
  event: TriggerEvent;
  createCard: (e: GoogleAppsScript.Addons.EventObject) => GoogleAppsScript.Card_Service.Card;
  enabled: (e: GoogleAppsScript.Addons.EventObject) => boolean;
}

export enum TriggerEvent {
  DEFAULT_HOMEPAGE,
  DOCS_HOMEPAGE,
  DRIVE_HOMEPAGE,
  ITEMS_SELECTED,
}
