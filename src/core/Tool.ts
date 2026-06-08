export interface ToolSettingOption {
  value: string;
  label: string;
}

export interface ToolSetting {
  id: string;
  label: string;
  type: 'text' | 'multiline' | 'checkbox' | 'number' | 'dropdown';
  placeholder?: string;
  default?: any;
  value?: any;
  secret?: boolean;
  options?: ToolSettingOption[];
  parse?: (val: any) => any;
  format?: (val: any) => any;
  validate?: (val: any) => { ok: boolean; message?: string };
}

export function getToolSettingDefaultValue(setting: ToolSetting): any {
  return setting.default ?? setting.value;
}

export function getToolSettingInitialValue(setting: ToolSetting, storedValue: any): any {
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
  enabled?: (e: GoogleAppsScript.Addons.EventObject) => boolean;
}

export enum TriggerEvent {
  DEFAULT_HOMEPAGE,
  DOCS_HOMEPAGE,
  DRIVE_HOMEPAGE,
  ITEMS_SELECTED,
  CALENDAR_HOMEPAGE,
}
