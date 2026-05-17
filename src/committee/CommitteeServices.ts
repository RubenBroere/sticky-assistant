import { COMMITTEE_CONFIG } from './CommitteeConfig';
import { getUniqueFileName, getOrCreateFolder, transformText } from './CommitteeUtils';

/**
 * Core cloning logic for a single committee.
 * Copies active content and creates a fresh template backup.
 */
export function processCommitteeCloning(sourceTemplate: GoogleAppsScript.Drive.Folder, destFolder: GoogleAppsScript.Drive.Folder, analysis: any, fileMap: Record<string, string>) {
  console.log("Copying active content for " + destFolder.getName() + "...");
  copyFolderContents(sourceTemplate, destFolder, true, analysis, fileMap);

  console.log("Creating fresh template for " + destFolder.getName() + "...");
  const newTemplateFolder = getOrCreateFolder(destFolder, COMMITTEE_CONFIG.TEMPLATE_NAME);
  copyFolderContents(sourceTemplate, newTemplateFolder, false, analysis);
}

/**
 * Recursive scanner to identify committee structure.
 */
export function scanForCommittees(rootFolder: GoogleAppsScript.Drive.Folder) {
  const templates = rootFolder.getFoldersByName(COMMITTEE_CONFIG.TEMPLATE_NAME);
  if (templates.hasNext()) {
    return {
      mode: "direct",
      committees: [{ name: rootFolder.getName(), folder: rootFolder, template: templates.next() }]
    };
  }

  const subs = rootFolder.getFolders();
  const committees = [];
  while (subs.hasNext()) {
    const sub = subs.next();
    const subTemplates = sub.getFoldersByName(COMMITTEE_CONFIG.TEMPLATE_NAME);
    if (subTemplates.hasNext()) {
      committees.push({ name: sub.getName(), folder: sub, template: subTemplates.next() });
    }
  }

  if (committees.length > 0) {
    return { mode: "parent", committees: committees };
  }

  return { mode: "none", committees: [] };
}

/**
 * Recursively copies folder contents from source to target.
 * Optionally transforms filenames and file content based on analysis.
 *
 * @param {GoogleAppsScript.Drive.Folder} source - Source folder.
 * @param {GoogleAppsScript.Drive.Folder} target - Target folder.
 * @param {boolean} shouldTransform - Whether to apply year pattern transformations.
 * @param {Object} analysis - The year pattern analysis object.
 * @param {Object} [fileMap=null] - Optional map to track {oldId: newId} for link fixing.
 */
export function copyFolderContents(source: GoogleAppsScript.Drive.Folder, target: GoogleAppsScript.Drive.Folder, shouldTransform: boolean, analysis: any, fileMap: Record<string, string> | null = null) {
  const files = source.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const rawName = shouldTransform ? transformText(file.getName(), analysis) : file.getName();
    const finalName = getUniqueFileName(target, rawName);

    // Perform the copy
    const copiedFile = file.makeCopy(finalName, target);

    // Track mapping if object provided
    if (fileMap) {
      fileMap[file.getId()] = copiedFile.getId();
    }

    if (shouldTransform && file.getMimeType() === (MimeType as any).GOOGLE_DOCS) {
      editDocContent(copiedFile.getId(), analysis);
    }
  }

  const folders = source.getFolders();
  while (folders.hasNext()) {
    const sub = folders.next();
    const rawSubName = shouldTransform ? transformText(sub.getName(), analysis) : sub.getName();

    const subTarget = getOrCreateFolder(target, rawSubName);

    copyFolderContents(sub, subTarget, shouldTransform, analysis, fileMap);
  }
}

/**
 * Modifies the content of a Google Doc by replacing year placeholders.
 *
 * @param {string} docId - The ID of the document to edit.
 * @param {Object} analysis - The year pattern analysis object.
 */
export function editDocContent(docId: string, analysis: any) {
  try {
    const doc = DocumentApp.openById(docId);
    const body = doc.getBody();

    // Helper to escape regex special chars in the placeholder
    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    body.replaceText(escapeRegExp(COMMITTEE_CONFIG.PLACEHOLDERS.FULL), analysis.nextFull);
    body.replaceText(escapeRegExp(COMMITTEE_CONFIG.PLACEHOLDERS.Y1), analysis.nextY1);
    body.replaceText(escapeRegExp(COMMITTEE_CONFIG.PLACEHOLDERS.Y2), analysis.nextY2);

    doc.saveAndClose();
  } catch (e: any) {
    console.warn("Could not edit doc: " + docId, e);
  }
}

/**
 * Scans newly created Google Docs and updates any linked objects (charts/tables)
 * to point to the newly created Spreadsheets (if applicable).
 *
 * @param {Object} fileMap - Mapping of {oldFileId: newFileId}.
 */
export function updateDocLinks(fileMap: Record<string, string>) {
  if (!fileMap || Object.keys(fileMap).length === 0) return;

  const newIds = Object.values(fileMap);
  console.log("Checking " + newIds.length + " files for linked charts...");

  console.warn("---------------------------------------------------");
  console.warn("WARNING: AUTOMATED CHART LINKING IS NOT SUPPORTED BY GOOGLE APPS SCRIPT / DOCS API");
  console.warn("The charts in the new Docs currently point to the OLD spreadsheets.");
  console.warn("You must manually update these links:");
  console.warn("1. Open the new Google Doc.");
  console.warn("2. Select the chart -> Unlink (or Delete).");
  console.warn("3. Provide the new Spreadsheet logic manually via Insert > Chart > From Sheets.");
  console.warn("---------------------------------------------------");
}
