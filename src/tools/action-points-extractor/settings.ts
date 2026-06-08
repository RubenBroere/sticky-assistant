import { Tool } from '../../core/Tool';
import { SettingsManager } from '../../core/SettingsManager';
import {
  ActionPointsConfig,
  parsePeopleConfig,
  formatPeopleConfig,
  validatePeopleConfig,
} from './config';

export const ACTION_POINTS_SETTINGS: NonNullable<Tool['settings']> = [
  { id: 'todoistToken', label: 'Todoist Token', type: 'text', default: '', secret: true },
  { id: 'todoistProjectId', label: 'Todoist Project ID', type: 'text', default: '' },
  { id: 'enableTodoist', label: 'Enable Todoist', type: 'checkbox', default: false },
  {
    id: 'peopleConfig',
    label: 'People Configuration (JSON)',
    type: 'multiline',
    default: '{}',
    parse: (val) => parsePeopleConfig(val),
    format: (val) => formatPeopleConfig(val),
    validate: (val) => validatePeopleConfig(val),
  },
];

export const actionPointsSettingsManager = new SettingsManager<ActionPointsConfig>(
  'actionPointsExtractor',
  ACTION_POINTS_SETTINGS
);
