import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  const mockCardService = {
    Icon: {
      STORE: 'STORE_ICON',
      DESCRIPTION: 'DESCRIPTION_ICON',
      BOOKMARK: 'BOOKMARK_ICON',
    },
  };
  globalThis.CardService = mockCardService as any;
});

import {
  saveToolSettings,
  resetSettingsCache,
} from './settingsStore';
import { ToolSetting } from './Tool';

// Mock the global Google Apps Script services
const mockUserProperties: Record<string, string> = {};

const mockPropertiesService = {
  getUserProperties: () => ({
    getProperty: (key: string) => mockUserProperties[key] ?? null,
    setProperty: (key: string, value: string) => {
      mockUserProperties[key] = value;
    },
  }),
};

// Mock workspace file and folder
let workspaceConfigContent = '{}';
let workspaceFilesCreated: Record<string, string> = {};

const mockFolder = {
  getName: () => 'Test Workspace Folder',
  getFilesByName: (name: string) => {
    let hasReturned = false;
    return {
      hasNext: () => name === 'sticky-assistant.json' && workspaceConfigContent !== null && !hasReturned,
      next: () => {
        hasReturned = true;
        return {
          setContent: (content: string) => {
            workspaceConfigContent = content;
          },
          getBlob: () => ({
            getDataAsString: () => workspaceConfigContent,
          }),
        };
      },
    };
  },
  createFile: (name: string, content: string) => {
    workspaceFilesCreated[name] = content;
    if (name === 'sticky-assistant.json') {
      workspaceConfigContent = content;
    }
    return {};
  },
};

const mockDriveApp = {
  getFileById: () => ({
    getParents: () => {
      let hasReturned = false;
      return {
        hasNext: () => !hasReturned,
        next: () => mockFolder,
      };
    },
  }),
};

const mockDocumentApp = {
  getActiveDocument: () => ({
    getId: () => 'test-doc-id',
  }),
};

// Install mocks into global context
globalThis.PropertiesService = mockPropertiesService as any;
globalThis.DriveApp = mockDriveApp as any;
globalThis.DocumentApp = mockDocumentApp as any;

// A mockup tool settings definitions
const mockDefs: ToolSetting[] = [
  { id: 'todoistToken', label: 'Todoist Token', type: 'text', default: '', secret: true },
  { id: 'todoistProjectId', label: 'Todoist Project ID', type: 'text', default: '' },
  { id: 'enableTodoist', label: 'Enable Todoist', type: 'checkbox', default: false },
  { id: 'peopleConfig', label: 'People Configuration (JSON)', type: 'multiline', default: '{}' },
];

describe('settingsStore', () => {
  beforeEach(() => {
    resetSettingsCache();
    // Clear mock storage
    for (const key in mockUserProperties) {
      delete mockUserProperties[key];
    }
    workspaceConfigContent = '{}';
    workspaceFilesCreated = {};
  });

  describe('saveToolSettings at Global level', () => {
    it('saves non-secret and secret settings to the user properties', () => {
      const values = {
        todoistToken: 'secret-token-123',
        todoistProjectId: 'project-abc',
        enableTodoist: true,
      };

      const res = saveToolSettings('actionPointsExtractor', values, mockDefs, 'global');
      expect(res.ok).toBe(true);

      expect(mockUserProperties['actionPointsExtractor__todoistToken']).toBe('secret-token-123');
      expect(mockUserProperties['actionPointsExtractor__todoistProjectId']).toBe('project-abc');
      expect(mockUserProperties['actionPointsExtractor__enableTodoist']).toBe('true');
    });
  });

  describe('saveToolSettings at Workspace level', () => {
    it('saves non-secret workspace settings successfully', () => {
      const values = {
        todoistProjectId: 'workspace-project-xyz',
        enableTodoist: true,
      };

      // Set different globals so identity checks don't bypass saving them
      mockUserProperties['actionPointsExtractor__todoistProjectId'] = 'global-project';
      mockUserProperties['actionPointsExtractor__enableTodoist'] = 'false';

      const res = saveToolSettings('actionPointsExtractor', values, mockDefs, 'workspace');
      expect(res.ok).toBe(true);

      const parsed = JSON.parse(workspaceConfigContent);
      expect(parsed['actionPointsExtractor']).toBeDefined();
      expect(parsed['actionPointsExtractor']['todoistProjectId']).toBe('workspace-project-xyz');
      expect(parsed['actionPointsExtractor']['enableTodoist']).toBe(true);
    });

    it('blocks secret settings from being saved to the workspace', () => {
      const values = {
        todoistToken: 'leaked-secret-token',
        todoistProjectId: 'workspace-project',
      };

      // Set different global value so they aren't skipped by the identity check
      mockUserProperties['actionPointsExtractor__todoistProjectId'] = 'global-project';

      const res = saveToolSettings('actionPointsExtractor', values, mockDefs, 'workspace');
      expect(res.ok).toBe(true);

      const parsed = JSON.parse(workspaceConfigContent);
      expect(parsed['actionPointsExtractor']).toBeDefined();
      expect(parsed['actionPointsExtractor']['todoistToken']).toBeUndefined();
      expect(parsed['actionPointsExtractor']['todoistProjectId']).toBe('workspace-project');
    });

    it('proactively cleans up any existing secret keys from the workspace config', () => {
      // Seed workspace config with a leaked secret
      workspaceConfigContent = JSON.stringify({
        actionPointsExtractor: {
          todoistToken: 'previously-leaked-secret',
          todoistProjectId: 'some-project',
        },
      });

      const values = {
        todoistProjectId: 'new-project',
      };

      mockUserProperties['actionPointsExtractor__todoistProjectId'] = 'global-project';

      const res = saveToolSettings('actionPointsExtractor', values, mockDefs, 'workspace');
      expect(res.ok).toBe(true);

      const parsed = JSON.parse(workspaceConfigContent);
      expect(parsed['actionPointsExtractor']['todoistToken']).toBeUndefined();
      expect(parsed['actionPointsExtractor']['todoistProjectId']).toBe('new-project');
    });

    it('does NOT write inherited global settings (identical values) to workspace', () => {
      // Setup global properties
      mockUserProperties['actionPointsExtractor__todoistProjectId'] = 'global-project-xyz';
      mockUserProperties['actionPointsExtractor__enableTodoist'] = 'true';

      const values = {
        todoistProjectId: 'global-project-xyz', // identical to global!
        enableTodoist: true,                  // identical to global!
        peopleConfig: '{"Alice": {}}',          // new/different workspace setting
      };

      const res = saveToolSettings('actionPointsExtractor', values, mockDefs, 'workspace');
      expect(res.ok).toBe(true);

      const parsed = JSON.parse(workspaceConfigContent);
      expect(parsed['actionPointsExtractor']).toBeDefined();
      // Should not write identical global settings
      expect(parsed['actionPointsExtractor']['todoistProjectId']).toBeUndefined();
      expect(parsed['actionPointsExtractor']['enableTodoist']).toBeUndefined();
      // Should write different/modified workspace settings
      expect(parsed['actionPointsExtractor']['peopleConfig']).toEqual({ Alice: {} });
    });

    it('does not overwrite undefined settings with default values', () => {
      // Seed workspace config with an existing override
      workspaceConfigContent = JSON.stringify({
        actionPointsExtractor: {
          todoistProjectId: 'existing-workspace-project',
        },
      });

      const values = {
        peopleConfig: '{"Bob": {}}',
      };

      const res = saveToolSettings('actionPointsExtractor', values, mockDefs, 'workspace');
      expect(res.ok).toBe(true);

      const parsed = JSON.parse(workspaceConfigContent);
      // Existing override must be preserved
      expect(parsed['actionPointsExtractor']['todoistProjectId']).toBe('existing-workspace-project');
      expect(parsed['actionPointsExtractor']['peopleConfig']).toEqual({ Bob: {} });
      // Undefined fields must NOT get their default value written
      expect(parsed['actionPointsExtractor']['enableTodoist']).toBeUndefined();
    });

    it('applies fallback name-based heuristic when schema is missing', () => {
      const values = {
        apiKey: 'sensitive-key',
        authToken: 'secret-auth-token',
        mySecretValue: 'dont-share',
        normalConfig: 'safe-value',
      };

      const res = saveToolSettings('customTool', values, [], 'workspace');
      expect(res.ok).toBe(true);

      const parsed = JSON.parse(workspaceConfigContent);
      expect(parsed['customTool']).toBeDefined();
      // Safe config should be stored
      expect(parsed['customTool']['normalConfig']).toBe('safe-value');
      // Secret-looking fields must be filtered out
      expect(parsed['customTool']['apiKey']).toBeUndefined();
      expect(parsed['customTool']['authToken']).toBeUndefined();
      expect(parsed['customTool']['mySecretValue']).toBeUndefined();
    });
  });
});
