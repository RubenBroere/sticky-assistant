import { ToolSetting, getToolSettingDefaultValue } from './Tool';

/**
 * Generic settings store: reads/writes tool settings using PropertiesService.
 * Keys use the prefix `${toolId}__${settingId}`.
 */
export function loadToolSettings(toolId: string, settingDefs?: ToolSetting[]): Record<string, any> {
  const props = PropertiesService.getUserProperties();
  const result: Record<string, any> = {};

  if (settingDefs && settingDefs.length > 0) {
    settingDefs.forEach((s) => {
      const key = `${toolId}__${s.id}`;
      const val = props.getProperty(key);
      if (val === null || val === undefined) {
        const defaultValue = getToolSettingDefaultValue(s);
        if (defaultValue !== undefined) result[s.id] = defaultValue;
        return;
      }

      if (s.type === 'checkbox') result[s.id] = val === 'true';
      else if (s.type === 'number') result[s.id] = Number(val);
      else result[s.id] = val;
    });
  }

  return result;
}

export function saveToolSettings(
  toolId: string,
  values: Record<string, any>,
  settingDefs?: ToolSetting[]
): { ok: boolean; message?: string } {
  try {
    const props = PropertiesService.getUserProperties();

    if (settingDefs && settingDefs.length > 0) {
      settingDefs.forEach((s) => {
        const key = `${toolId}__${s.id}`;
        const val = values[s.id];
        if (val === undefined) {
          const defaultValue = getToolSettingDefaultValue(s);
          if (defaultValue === undefined) return;
          props.setProperty(key, String(defaultValue));
          return;
        }

        if (s.type === 'checkbox')
          props.setProperty(key, val === true || val === 'true' ? 'true' : 'false');
        else props.setProperty(key, String(val));
      });
    } else {
      Object.keys(values).forEach((k) => props.setProperty(`${toolId}__${k}`, String(values[k])));
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err?.message };
  }
}
