import { ToolSetting } from './Tool';
import { loadToolSettings, saveToolSettings } from './settingsStore';

export class SettingsManager<T extends Record<string, any>> {
  constructor(
    private toolId: string,
    private settingsDefs: ToolSetting[]
  ) {}

  /**
   * Loads all settings, runs s.parse() on each setting if defined, and returns a fully typed config object.
   */
  load(e?: any): T {
    const rawValues = loadToolSettings(this.toolId, this.settingsDefs, e);
    const result = {} as any;

    this.settingsDefs.forEach((s) => {
      const val = rawValues[s.id];

      // Custom parsing hook
      if (s.parse && val !== undefined && val !== null) {
        result[s.id] = s.parse(val);
      } else {
        result[s.id] = val;
      }
    });

    return result as T;
  }

  /**
   * Serializes setting values, runs s.format() on each setting if defined, and saves to chosen target layer.
   */
  save(
    values: Partial<T>,
    targetLayer: 'global' | 'workspace' = 'global',
    e?: any
  ): { ok: boolean; message?: string } {
    const formattedValues = {} as any;

    this.settingsDefs.forEach((s) => {
      const val = values[s.id];
      if (val === undefined) return;

      if (s.format) {
        formattedValues[s.id] = s.format(val);
      } else {
        formattedValues[s.id] = val;
      }
    });

    return saveToolSettings(this.toolId, formattedValues, this.settingsDefs, targetLayer, e);
  }

  /**
   * Validates settings values against setting-specific validators.
   */
  validate(values: Partial<T>): { ok: boolean; message?: string } {
    for (const s of this.settingsDefs) {
      const val = values[s.id];
      if (val !== undefined && s.validate) {
        const validation = s.validate(val);
        if (!validation.ok) {
          return validation;
        }
      }
    }
    return { ok: true };
  }
}
