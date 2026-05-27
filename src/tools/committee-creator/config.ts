/**
 * Configuration for the committee creator tool.
 */
export const COMMITTEE_CONFIG = {
  TEMPLATE_NAME: 'Template',
  PLACEHOLDERS: {
    FULL: '[YEAR]',
    Y1: '[YEAR_1]',
    Y2: '[YEAR_2]',
  },
  REGEX: {
    DOUBLE_YEAR: /(\d{4})([/-])(\d{4})/,
    SINGLE_YEAR: /(\d{4})/,
  },
  ICONS: {
    FOLDER: CardService.Icon.DESCRIPTION,
    DESCRIPTION: CardService.Icon.DESCRIPTION,
    CLOCK: CardService.Icon.CLOCK,
    CHECK: CardService.Icon.CONFIRMATION_NUMBER_ICON,
    ERROR: CardService.Icon.OFFER,
    INFO: CardService.Icon.BOOKMARK,
    MAGIC: CardService.Icon.STAR,
  },
};

// Per-tool load/save functions removed. Use settingsStore.loadToolSettings('committeeCreator')
// and settingsStore.saveToolSettings('committeeCreator', values, defs) instead.

export function validateCommitteeConfig(formInput: Record<string, any>): {
  ok: boolean;
  message?: string;
} {
  if (formInput.yearPattern !== undefined && String(formInput.yearPattern).length === 0) {
    return { ok: false, message: 'Year pattern cannot be empty.' };
  }
  return { ok: true };
}
