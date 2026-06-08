/**
 * Configuration for the committee creator tool.
 */
export interface CommitteeCreatorConfig {
  defaultFolderTemplate: string;
  yearPattern: string;
  includeSubCommittees: boolean;
  templateFolderName: string;
  placeholderFull: string;
  placeholderY1: string;
  placeholderY2: string;
}

export const COMMITTEE_CONFIG = {
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

export function validateCommitteeConfig(formInput: Record<string, any>): {
  ok: boolean;
  message?: string;
} {
  if (formInput.yearPattern !== undefined && String(formInput.yearPattern).length === 0) {
    return { ok: false, message: 'Year pattern cannot be empty.' };
  }
  if (
    formInput.templateFolderName !== undefined &&
    String(formInput.templateFolderName).length === 0
  ) {
    return { ok: false, message: 'Template folder name cannot be empty.' };
  }
  if (formInput.placeholderFull !== undefined && String(formInput.placeholderFull).length === 0) {
    return { ok: false, message: 'Full year placeholder cannot be empty.' };
  }
  return { ok: true };
}
