import { Tool } from '../../core/Tool';

export const ACTION_POINTS_SETTINGS: NonNullable<Tool['settings']> = [
  { id: 'todoistToken', label: 'Todoist Token', type: 'text', default: '', secret: true },
  { id: 'todoistProjectId', label: 'Todoist Project ID', type: 'text', default: '' },
  { id: 'enableTodoist', label: 'Enable Todoist', type: 'checkbox', default: false },
  {
    id: 'peopleConfig',
    label: 'People Configuration (JSON)',
    type: 'multiline',
    default: '{}',
  },
];
