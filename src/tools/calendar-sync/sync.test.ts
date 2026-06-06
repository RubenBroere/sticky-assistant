import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  // Minimal CardService mock for modules importing CardService during hoist
  globalThis.CardService = {
    Icon: {
      CLOCK: 'CLOCK_ICON',
    },
  } as any;
});

import {
  loadAllSyncConfigs,
  saveSyncConfig,
  deleteSyncConfig,
  setupTriggers,
  formatPrefix,
} from './sync';
import { SyncConfig } from './types';

// Mock storage
const mockUserProperties: Record<string, string> = {};

// Mock ScriptApp triggers
let mockTriggers: any[] = [];

// Mock Google Workspace classes
globalThis.PropertiesService = {
  getUserProperties: () => ({
    getProperty: (key: string) => mockUserProperties[key] ?? null,
    setProperty: (key: string, value: string) => {
      mockUserProperties[key] = value;
    },
    deleteProperty: (key: string) => {
      delete mockUserProperties[key];
    },
  }),
} as any;

globalThis.ScriptApp = {
  getProjectTriggers: () => mockTriggers,
  deleteTrigger: (trigger: any) => {
    mockTriggers = mockTriggers.filter((t) => t.getUniqueId() !== trigger.getUniqueId());
  },
  newTrigger: (functionName: string) => {
    const triggerId = `trigger_${Math.random()}`;
    const triggerMock = {
      getUniqueId: () => triggerId,
      getHandlerFunction: () => functionName,
    };
    return {
      timeBased: () => ({
        everyHours: () => ({
          create: () => {
            mockTriggers.push(triggerMock);
            return triggerMock;
          },
        }),
        after: () => ({
          create: () => {
            mockTriggers.push(triggerMock);
            return triggerMock;
          },
        }),
      }),
    };
  },
} as any;

describe('Calendar Sync Core Logic (Always Hourly)', () => {
  beforeEach(() => {
    // Clear user properties
    Object.keys(mockUserProperties).forEach((k) => delete mockUserProperties[k]);
    // Clear triggers
    mockTriggers = [];
  });

  const sampleConfig: SyncConfig = {
    id: 'test_job_1',
    calendar_name: 'Test Job',
    sourceCalendars: {
      src_1: {},
      src_2: {},
    },
    targetCalendarId: 'target_1',
    event_prefix: 'Test',
    syncPrivacy: 'full',
    syncOnlyBusyEvents: true,
    syncRangeMonthsBack: 1,
    syncRangeMonthsForward: 6,
  };

  it('should successfully save and load sync configurations', () => {
    saveSyncConfig(sampleConfig);

    const loaded = loadAllSyncConfigs();
    expect(loaded.length).toBe(1);
    expect(loaded[0].id).toBe('test_job_1');
    expect(loaded[0].calendar_name).toBe('Test Job');
    expect(loaded[0].sourceCalendars).toHaveProperty('src_1');
    expect(loaded[0].syncPrivacy).toBe('full');
  });

  it('should set up a single hourly trigger when sync is initialized', () => {
    const configToSetup = { ...sampleConfig };
    setupTriggers(configToSetup);

    expect(mockTriggers.length).toBe(1);
    expect(mockTriggers[0].getHandlerFunction()).toBe('handleHourlySync');
  });

  it('should clean up the hourly trigger when the last configuration is deleted', () => {
    const configToSetup = { ...sampleConfig };
    setupTriggers(configToSetup);
    expect(mockTriggers.length).toBe(1);

    saveSyncConfig(configToSetup);
    deleteSyncConfig(configToSetup.id, 'keep_all', configToSetup.targetCalendarId);

    expect(mockTriggers.length).toBe(0);
    expect(loadAllSyncConfigs().length).toBe(0);
  });

  it('should not add duplicate hourly triggers if multiple configurations exist', () => {
    const config1 = { ...sampleConfig, id: 'job_1' };
    const config2 = { ...sampleConfig, id: 'job_2' };

    saveSyncConfig(config1);
    saveSyncConfig(config2);

    setupTriggers(config1);
    setupTriggers(config2);

    // Should only have created 1 hourly trigger
    expect(mockTriggers.length).toBe(1);
  });

  describe('formatPrefix helper function', () => {
    it('should wrap a clean prefix in square brackets and add a space', () => {
      expect(formatPrefix('Work')).toBe('[Work] ');
    });

    it('should strip existing square brackets and spaces from the input and format correctly', () => {
      expect(formatPrefix('[Work]')).toBe('[Work] ');
      expect(formatPrefix('  [Work]  ')).toBe('[Work] ');
      expect(formatPrefix('[[Work]]')).toBe('[Work] ');
      expect(formatPrefix('[Work')).toBe('[Work] ');
      expect(formatPrefix('Work]')).toBe('[Work] ');
    });

    it('should return empty string if empty prefix is provided', () => {
      expect(formatPrefix('')).toBe('');
      expect(formatPrefix('   ')).toBe('');
      expect(formatPrefix('[]')).toBe('');
    });
  });
});
