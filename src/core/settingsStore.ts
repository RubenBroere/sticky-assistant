import { ToolSetting, getToolSettingDefaultValue } from './Tool';

// Execution-level cache to eliminate redundant, slow remote API calls
let cachedParentFolder: GoogleAppsScript.Drive.Folder | null = null;
let cachedParentFolderChecked = false;

let cachedWorkspaceConfig: Record<string, any> | null = null;
let cachedWorkspaceConfigLoaded = false;

/**
 * Traverses the parent folders of the active Docs document or Drive selected item.
 * Utilizes execution-level caching to prevent redundant API queries.
 */
export function getActiveParentFolder(e?: any): GoogleAppsScript.Drive.Folder | null {
  if (cachedParentFolderChecked) return cachedParentFolder;
  cachedParentFolderChecked = true;

  try {
    // 1. Try Docs host active document
    try {
      const doc = DocumentApp.getActiveDocument();
      if (doc) {
        const file = DriveApp.getFileById(doc.getId());
        const parents = file.getParents();
        if (parents.hasNext()) {
          cachedParentFolder = parents.next();
          return cachedParentFolder;
        }
      }
    } catch {
      // Ignore if DocumentApp is not active or fails
    }

    // 2. Try Drive host event selected items
    if (e && e.drive && Array.isArray(e.drive.selectedItems) && e.drive.selectedItems.length > 0) {
      const itemId = e.drive.selectedItems[0].id;
      const file = DriveApp.getFileById(itemId);
      const parents = file.getParents();
      if (parents.hasNext()) {
        cachedParentFolder = parents.next();
        return cachedParentFolder;
      }
    }
  } catch (err) {
    console.warn('Could not determine active parent folder:', err);
  }

  return null;
}

/**
 * Reads, parses, and returns the workspace sticky-assistant.json from a parent folder.
 * Utilizes execution-level caching to prevent slow remote file reads.
 */
export function loadWorkspaceConfig(
  parentFolder: GoogleAppsScript.Drive.Folder
): Record<string, any> {
  if (cachedWorkspaceConfigLoaded) return cachedWorkspaceConfig || {};
  cachedWorkspaceConfigLoaded = true;

  try {
    const configFiles = parentFolder.getFilesByName('sticky-assistant.json');
    if (configFiles.hasNext()) {
      const configFile = configFiles.next();
      const content = configFile.getBlob().getDataAsString();
      cachedWorkspaceConfig = JSON.parse(content || '{}');
      return cachedWorkspaceConfig || {};
    }
  } catch (err) {
    console.warn('Failed to parse workspace sticky-assistant.json:', err);
  }

  cachedWorkspaceConfig = {};
  return {};
}

/**
 * Writes the serialized workspace config data to sticky-assistant.json in the parent folder.
 * Invalidates the cached config to prevent stale reads.
 */
export function saveWorkspaceConfig(
  parentFolder: GoogleAppsScript.Drive.Folder,
  configData: Record<string, any>
): boolean {
  try {
    const configFiles = parentFolder.getFilesByName('sticky-assistant.json');
    if (configFiles.hasNext()) {
      const configFile = configFiles.next();
      configFile.setContent(JSON.stringify(configData, null, 2));
    } else {
      parentFolder.createFile('sticky-assistant.json', JSON.stringify(configData, null, 2));
    }

    // Update execution cache with the new saved state
    cachedWorkspaceConfig = configData;
    cachedWorkspaceConfigLoaded = true;
    return true;
  } catch (err) {
    console.error('Failed to save workspace sticky-assistant.json:', err);
    return false;
  }
}

/**
 * Generic settings loader: reads tool settings using a layered configuration strategy.
 * Workspace (folder-level sticky-assistant.json) overrides are preferred over Global (User Properties).
 */
export function loadToolSettings(
  toolId: string,
  settingDefs?: ToolSetting[],
  e?: any
): Record<string, any> {
  const result: Record<string, any> = {};

  // 1. Check if a local Workspace sticky-assistant.json exists first
  const parentFolder = getActiveParentFolder(e);
  let localConfig: Record<string, any> = {};
  let hasLocalConfig = false;

  if (parentFolder) {
    localConfig = loadWorkspaceConfig(parentFolder);
    if (localConfig && localConfig[toolId] !== undefined) {
      hasLocalConfig = true;
    }
  }

  // 2. Load from either Workspace or Global properties
  const props = PropertiesService.getUserProperties();

  if (settingDefs && settingDefs.length > 0) {
    settingDefs.forEach((s) => {
      let val: any = null;

      if (hasLocalConfig && localConfig[toolId][s.id] !== undefined) {
        val = localConfig[toolId][s.id];
        // Convert local objects back to string for multiline text editors compat
        if (val !== null && typeof val === 'object' && s.type === 'multiline') {
          val = JSON.stringify(val, null, 2);
        }
      } else {
        const globalVal = props.getProperty(`${toolId}__${s.id}`);
        if (globalVal !== null) {
          val = globalVal;
        }
      }

      if (val === null || val === undefined) {
        const defaultValue = getToolSettingDefaultValue(s);
        if (defaultValue !== undefined) result[s.id] = defaultValue;
        return;
      }

      if (s.type === 'checkbox') {
        result[s.id] = val === true || val === 'true';
      } else if (s.type === 'number') {
        result[s.id] = Number(val);
      } else {
        result[s.id] = val;
      }
    });
  }

  return result;
}

/**
 * Generic settings saver: persists tool settings to the chosen layer (Global vs Workspace).
 */
export function saveToolSettings(
  toolId: string,
  values: Record<string, any>,
  settingDefs?: ToolSetting[],
  targetLayer: string = 'global',
  e?: any
): { ok: boolean; message?: string } {
  try {
    const parentFolder = getActiveParentFolder(e);

    if (targetLayer === 'workspace' && parentFolder) {
      // --- WORKSPACE LAYER STORAGE ---
      const localConfig = loadWorkspaceConfig(parentFolder);
      localConfig[toolId] = localConfig[toolId] || {};

      if (settingDefs && settingDefs.length > 0) {
        // Collect secret setting IDs for cleanup
        const secretKeys = new Set(settingDefs.filter((s) => s.secret).map((s) => s.id));

        settingDefs.forEach((s) => {
          if (s.secret) {
            delete localConfig[toolId][s.id];
            return;
          }

          let val = values[s.id];
          if (val === undefined) {
            // Do not write undefined settings to workspace layer (prevent default overrides)
            return;
          }

          // Check if this is an inherited global setting that matches global exactly
          try {
            const props = PropertiesService.getUserProperties();
            const globalVal = props.getProperty(`${toolId}__${s.id}`);
            if (globalVal !== null) {
              let isIdentical = false;
              if (s.type === 'checkbox') {
                const globalTyped = globalVal === 'true';
                isIdentical = (val === true || val === 'true') === globalTyped;
              } else if (s.type === 'number') {
                isIdentical = Number(val) === Number(globalVal);
              } else {
                // Compare string or JSON representations
                const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
                if (s.type === 'multiline') {
                  try {
                    const p1 = JSON.parse(valStr);
                    const p2 = JSON.parse(globalVal);
                    isIdentical = JSON.stringify(p1) === JSON.stringify(p2);
                  } catch {
                    isIdentical = valStr === globalVal;
                  }
                } else {
                  isIdentical = valStr === globalVal;
                }
              }

              // If it matches global and is not already defined in the workspace config,
              // skip writing it to the workspace to prevent leakage.
              if (isIdentical && localConfig[toolId][s.id] === undefined) {
                return;
              }
            }
          } catch (err) {
            console.warn(
              'Could not check global properties for settings identity comparison:',
              err
            );
          }

          // Automatically parse multiline inputs back to JSON objects if valid
          if (s.type === 'multiline' && typeof val === 'string') {
            try {
              const parsed = JSON.parse(val);
              if (parsed && typeof parsed === 'object') {
                val = parsed;
              }
            } catch {
              // Ignore invalid JSON parsing, keep as string
            }
          }

          localConfig[toolId][s.id] = s.type === 'checkbox' ? val === true || val === 'true' : val;
        });

        // Proactive cleanup of any secret keys
        secretKeys.forEach((key) => {
          if (localConfig[toolId][key] !== undefined) {
            delete localConfig[toolId][key];
          }
        });
      } else {
        // Fallback: heuristic name filter to block common secret keys
        Object.keys(values).forEach((k) => {
          const lowerK = k.toLowerCase();
          if (
            lowerK.includes('token') ||
            lowerK.includes('secret') ||
            lowerK.includes('password') ||
            lowerK.includes('key') ||
            lowerK.includes('auth')
          ) {
            delete localConfig[toolId][k];
            return;
          }
          localConfig[toolId][k] = values[k];
        });
      }

      const res = saveWorkspaceConfig(parentFolder, localConfig);
      if (!res) throw new Error('Could not write sticky-assistant.json to Workspace folder.');
      return { ok: true };
    } else {
      // --- GLOBAL PROPERTIES STORAGE ---
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

          if (s.type === 'checkbox') {
            props.setProperty(key, val === true || val === 'true' ? 'true' : 'false');
          } else {
            props.setProperty(key, String(val));
          }
        });
      } else {
        Object.keys(values).forEach((k) => props.setProperty(`${toolId}__${k}`, String(values[k])));
      }

      return { ok: true };
    }
  } catch (err: any) {
    return { ok: false, message: err?.message || String(err) };
  }
}

/**
 * Resets the execution-level caches for testing purposes.
 */
export function resetSettingsCache(): void {
  cachedParentFolder = null;
  cachedParentFolderChecked = false;
  cachedWorkspaceConfig = null;
  cachedWorkspaceConfigLoaded = false;
}
