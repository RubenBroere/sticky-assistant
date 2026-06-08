import { Tool } from '../../core/Tool';
import { SettingsManager } from '../../core/SettingsManager';
import { CommentsExtractorConfig } from './config';

export const COMMENTS_EXTRACTOR_SETTINGS: NonNullable<Tool['settings']> = [
  {
    id: 'exportSheetPrefix',
    label: 'Export Sheet Prefix',
    type: 'text',
    default: 'Comments Export',
    validate: (val) =>
      String(val).length > 0
        ? { ok: true }
        : { ok: false, message: 'Export sheet prefix cannot be empty.' },
  },
  { id: 'includeReplies', label: 'Include Replies', type: 'checkbox', default: true },
];

export const commentsExtractorSettingsManager = new SettingsManager<CommentsExtractorConfig>(
  'commentsExtractor',
  COMMENTS_EXTRACTOR_SETTINGS
);
