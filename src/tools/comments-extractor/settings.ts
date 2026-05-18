import { Tool } from '../../core/Tool';

export const COMMENTS_EXTRACTOR_SETTINGS: NonNullable<Tool['settings']> = [
  {
    id: 'exportSheetPrefix',
    label: 'Export Sheet Prefix',
    type: 'text',
    default: 'Comments Export',
  },
  { id: 'includeReplies', label: 'Include Replies', type: 'checkbox', default: true },
];
