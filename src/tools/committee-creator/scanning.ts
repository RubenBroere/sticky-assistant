import { COMMITTEE_CONFIG } from './config';

export function analyzeFolderName(name: string) {
  const matchDouble = name.match(COMMITTEE_CONFIG.REGEX.DOUBLE_YEAR);
  if (matchDouble) {
    const y1 = parseInt(matchDouble[1]);
    const sep = matchDouble[2];
    const y2 = parseInt(matchDouble[3]);
    return {
      found: true,
      currentPattern: y1 + sep + y2,
      nextFull: y1 + 1 + sep + (y2 + 1),
      nextY1: '' + (y1 + 1),
      nextY2: '' + (y2 + 1),
    };
  }

  const matchSingle = name.match(COMMITTEE_CONFIG.REGEX.SINGLE_YEAR);
  if (matchSingle) {
    const y1 = parseInt(matchSingle[0]);
    return {
      found: true,
      currentPattern: '' + y1,
      nextFull: '' + (y1 + 1),
      nextY1: '' + (y1 + 1),
      nextY2: '' + (y1 + 1),
    };
  }

  return { found: false } as any;
}

export function transformText(text: string, analysis: any) {
  return text
    .split(COMMITTEE_CONFIG.PLACEHOLDERS.Y1)
    .join(analysis.nextY1)
    .split(COMMITTEE_CONFIG.PLACEHOLDERS.Y2)
    .join(analysis.nextY2)
    .split(COMMITTEE_CONFIG.PLACEHOLDERS.FULL)
    .join(analysis.nextFull);
}

export function getOrCreateFolder(parent: GoogleAppsScript.Drive.Folder, name: string) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parent.createFolder(name);
}

export function getUniqueFileName(folder: GoogleAppsScript.Drive.Folder, name: string) {
  if (!folder.getFilesByName(name).hasNext()) return name;

  let nameBase = name;
  let extension = '';
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex !== -1) {
    nameBase = name.substring(0, dotIndex);
    extension = name.substring(dotIndex);
  }

  let counter = 1;
  while (counter < 100) {
    const uniqueName = nameBase + ' (' + counter + ')' + extension;
    if (!folder.getFilesByName(uniqueName).hasNext()) return uniqueName;
    counter++;
  }
  return name;
}
