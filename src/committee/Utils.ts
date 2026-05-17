import { COMMITTEE_CONFIG } from './Config';

/**
 * Generates a unique filename within the target folder to prevent conflicts.
 * Appends " (n)" to the filename if it already exists.
 *
 * @param {GoogleAppsScript.Drive.Folder} folder - The target folder.
 * @param {string} name - The desired filename.
 * @return {string} A unique filename.
 */
export function getUniqueFileName(folder: GoogleAppsScript.Drive.Folder, name: string) {
  if (!folder.getFilesByName(name).hasNext()) return name;

  let nameBase = name;
  let extension = "";
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex !== -1) {
    nameBase = name.substring(0, dotIndex);
    extension = name.substring(dotIndex);
  }

  let counter = 1;
  const LIMIT = 100; // Safety limit
  while (counter < LIMIT) {
    let uniqueName = nameBase + " (" + counter + ")" + extension;
    if (!folder.getFilesByName(uniqueName).hasNext()) return uniqueName;
    counter++;
  }
  return name; // Fallback
}

/**
 * Analyzes a folder name to detect single or double year patterns (e.g., 2023, 2023/2024, or 2023-2024).
 *
 * @param {string} name - The folder name to analyze.
 * @return {Object} Analysis result containing found status, current patterns, and next cycle targets.
 */
export function analyzeFolderName(name: string) {
  const matchDouble = name.match(COMMITTEE_CONFIG.REGEX.DOUBLE_YEAR);
  if (matchDouble) {
    const y1 = parseInt(matchDouble[1]);
    const sep = matchDouble[2]; // Capture the separator (/ or -)
    const y2 = parseInt(matchDouble[3]);
    return {
      found: true,
      currentPattern: y1 + sep + y2,
      nextFull: (y1 + 1) + sep + (y2 + 1),
      nextY1: "" + (y1 + 1),
      nextY2: "" + (y2 + 1)
    };
  }

  const matchSingle = name.match(COMMITTEE_CONFIG.REGEX.SINGLE_YEAR);
  if (matchSingle) {
    const y1 = parseInt(matchSingle[0]);
    return {
      found: true,
      currentPattern: "" + y1,
      nextFull: "" + (y1 + 1),
      nextY1: "" + (y1 + 1),
      nextY2: "" + (y1 + 1)
    };
  }
  return { found: false } as any;
}

/**
 * Gets an existing folder by name or creates it if it doesn't exist.
 *
 * @param {GoogleAppsScript.Drive.Folder} parent - The parent folder.
 * @param {string} name - The name of the folder to retrieve or create.
 * @return {GoogleAppsScript.Drive.Folder} The requested folder.
 */
export function getOrCreateFolder(parent: GoogleAppsScript.Drive.Folder, name: string) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parent.createFolder(name);
}

/**
 * Replaces year placeholders in a text string.
 *
 * @param {string} text - The input text.
 * @param {Object} analysis - The analysis object containing replacement values.
 * @return {string} The transformed text.
 */
export function transformText(text: string, analysis: any) {
  return text.split(COMMITTEE_CONFIG.PLACEHOLDERS.Y1).join(analysis.nextY1)
             .split(COMMITTEE_CONFIG.PLACEHOLDERS.Y2).join(analysis.nextY2)
             .split(COMMITTEE_CONFIG.PLACEHOLDERS.FULL).join(analysis.nextFull);
}
