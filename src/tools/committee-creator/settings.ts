import { Tool } from '../../core/Tool';
import { SettingsManager } from '../../core/SettingsManager';
import { CommitteeCreatorConfig } from './config';

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
  {
    id: 'templateFolderName',
    label: 'Template Folder Name',
    type: 'text',
    default: 'Template',
  },
  {
    id: 'placeholderFull',
    label: 'Full Year Placeholder',
    type: 'text',
    default: '[YEAR]',
  },
  {
    id: 'placeholderY1',
    label: 'Year 1 Placeholder',
    type: 'text',
    default: '[YEAR_1]',
  },
  {
    id: 'placeholderY2',
    label: 'Year 2 Placeholder',
    type: 'text',
    default: '[YEAR_2]',
  },
];

export const committeeSettingsManager = new SettingsManager<CommitteeCreatorConfig>(
  'committeeCreator',
  COMMITTEE_CREATOR_SETTINGS
);
