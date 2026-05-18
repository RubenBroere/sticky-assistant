import { Tool } from '../../core/Tool';

export const COMMITTEE_CREATOR_SETTINGS: NonNullable<Tool['settings']> = [
  {
    id: 'defaultFolderTemplate',
    label: 'Default Folder Template ID',
    type: 'text',
    placeholder: '',
    default: '',
  },
  {
    id: 'yearPattern',
    label: 'Year Pattern',
    type: 'text',
    placeholder: 'YYYY-YYYY',
    default: '[YEAR]',
  },
  {
    id: 'includeSubCommittees',
    label: 'Include Sub-Committees',
    type: 'checkbox',
    default: true,
  },
];
