/**
 * Configuration for the committee tool, defining placeholder patterns and folder names.
 */
export const COMMITTEE_CONFIG = {
  TEMPLATE_NAME: "Template",
  PLACEHOLDERS: {
    FULL: "[YEAR]",
    Y1: "[YEAR_1]",
    Y2: "[YEAR_2]"
  },
  REGEX: {
    // Matches 2024/2025 or 2024-2025. Captures: Group 1 (Y1), Group 2 (separator), Group 3 (Y2)
    DOUBLE_YEAR: /(\d{4})([\/\-])(\d{4})/,
    SINGLE_YEAR: /(\d{4})/
  },
  ICONS: {
    FOLDER: CardService.Icon.DESCRIPTION,
    DESCRIPTION: CardService.Icon.DESCRIPTION,
    CLOCK: CardService.Icon.CLOCK,
    CHECK: CardService.Icon.CONFIRMATION_NUMBER_ICON,
    ERROR: CardService.Icon.OFFER,
    INFO: CardService.Icon.BOOKMARK,
    MAGIC: CardService.Icon.STAR
  }
};
