import { COMMITTEE_CONFIG } from './config';
import { getOrCreateFolder, getUniqueFileName, transformText } from './scanning';
import {
  createCommitteeAnalyzeCard,
  createCommitteeExecutionCard,
  createCommitteeMessageCard,
} from './cards';
import { analyzeFolderName } from './scanning';

export function processCommitteeCloning(
  sourceTemplate: GoogleAppsScript.Drive.Folder,
  destFolder: GoogleAppsScript.Drive.Folder,
  analysis: any,
  fileMap: Record<string, string>
) {
  copyFolderContents(sourceTemplate, destFolder, true, analysis, fileMap);
  const newTemplateFolder = getOrCreateFolder(destFolder, COMMITTEE_CONFIG.TEMPLATE_NAME);
  copyFolderContents(sourceTemplate, newTemplateFolder, false, analysis);
}

export function scanForCommittees(rootFolder: GoogleAppsScript.Drive.Folder) {
  const templates = rootFolder.getFoldersByName(COMMITTEE_CONFIG.TEMPLATE_NAME);
  if (templates.hasNext()) {
    return {
      mode: 'direct',
      committees: [{ name: rootFolder.getName(), folder: rootFolder, template: templates.next() }],
    };
  }

  const subs = rootFolder.getFolders();
  const committees: any[] = [];
  while (subs.hasNext()) {
    const sub = subs.next();
    const subTemplates = sub.getFoldersByName(COMMITTEE_CONFIG.TEMPLATE_NAME);
    if (subTemplates.hasNext()) {
      committees.push({ name: sub.getName(), folder: sub, template: subTemplates.next() });
    }
  }

  if (committees.length > 0) {
    return { mode: 'parent', committees };
  }

  return { mode: 'none', committees: [] };
}

export function copyFolderContents(
  source: GoogleAppsScript.Drive.Folder,
  target: GoogleAppsScript.Drive.Folder,
  shouldTransform: boolean,
  analysis: any,
  fileMap: Record<string, string> | null = null
) {
  const files = source.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const rawName = shouldTransform ? transformText(file.getName(), analysis) : file.getName();
    const finalName = getUniqueFileName(target, rawName);
    const copiedFile = file.makeCopy(finalName, target);
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

export function editDocContent(docId: string, analysis: any) {
  try {
    const doc = DocumentApp.openById(docId);
    const body = doc.getBody();
    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    body.replaceText(escapeRegExp(COMMITTEE_CONFIG.PLACEHOLDERS.FULL), analysis.nextFull);
    body.replaceText(escapeRegExp(COMMITTEE_CONFIG.PLACEHOLDERS.Y1), analysis.nextY1);
    body.replaceText(escapeRegExp(COMMITTEE_CONFIG.PLACEHOLDERS.Y2), analysis.nextY2);

    doc.saveAndClose();
  } catch (e: any) {
    console.warn('Could not edit doc: ' + docId, e);
  }
}

export function updateDocLinks(fileMap: Record<string, string>) {
  if (!fileMap || Object.keys(fileMap).length === 0) return;
  console.warn('WARNING: Automated chart linking is not supported by Apps Script / Docs API.');
}

export function onDriveSelection(e: any) {
  if (!e || !e.drive || !e.drive.selectedItems) {
    return createCommitteeMessageCard('Select a folder to begin.', true);
  }

  const items = e.drive.selectedItems;
  if (items.length === 0) {
    return createCommitteeMessageCard('Select a folder to begin.', true);
  }

  if (items.length > 1) {
    return createCommitteeMessageCard('Please select only one folder.', false);
  }

  const item = items[0];
  if (item.mimeType !== (MimeType as any).FOLDER) {
    return createCommitteeMessageCard('Selected item is not a folder.', false);
  }

  return createCommitteeAnalyzeCard(item.title, item.id);
}

export function runScan(e: any) {
  const sourceId = e.parameters.sourceId;
  const folderName = e.parameters.folderName;

  const analysis = analyzeFolderName(folderName);
  if (!analysis.found) {
    return createCommitteeMessageCard(
      '<b>Error:</b> No year pattern detected.<br>Folder must contain YYYY or YYYY/YYYY.',
      false
    );
  }

  const sourceFolder = DriveApp.getFolderById(sourceId);
  const scanResult = scanForCommittees(sourceFolder);

  if (scanResult.mode === 'none') {
    return createCommitteeMessageCard(
      `<b>Error:</b> Invalid structure.<br>Direct: Must contain "${COMMITTEE_CONFIG.TEMPLATE_NAME}".<br>Parent: Subfolders must contain "${COMMITTEE_CONFIG.TEMPLATE_NAME}".`,
      false
    );
  }

  const section = CardService.newCardSection()
    .addWidget(
      CardService.newKeyValue()
        .setTopLabel('Structure Detected')
        .setContent(
          scanResult.mode === 'direct'
            ? 'Single Committee'
            : `Parent Group (${scanResult.committees.length} Committees)`
        )
        .setIcon(COMMITTEE_CONFIG.ICONS.INFO)
        .setMultiline(true)
    )
    .addWidget(
      CardService.newKeyValue()
        .setTopLabel('Current Pattern')
        .setContent(analysis.currentPattern)
        .setIcon(COMMITTEE_CONFIG.ICONS.CLOCK)
        .setMultiline(true)
    )
    .addWidget(
      CardService.newKeyValue()
        .setTopLabel('Next Cycle Target')
        .setContent(analysis.nextFull)
        .setIcon(COMMITTEE_CONFIG.ICONS.MAGIC)
        .setMultiline(true)
    );

  const actionSection = CardService.newCardSection()
    .setHeader('Action Plan')
    .addWidget(
      CardService.newDecoratedText()
        .setText(`Create Folder: <b>${analysis.nextFull}</b>`)
        .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.CONFIRMATION_NUMBER_ICON))
        .setWrapText(true)
    )
    .addWidget(
      CardService.newDecoratedText()
        .setText(
          scanResult.mode === 'direct' ? 'Clone Template Content' : 'Clone All Sub-Committees'
        )
        .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.DESCRIPTION))
        .setWrapText(true)
    )
    .addWidget(
      CardService.newTextButton()
        .setText('Execute Clone')
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('runExecution')
            .setParameters({ sourceId, folderName, mode: scanResult.mode })
        )
    );

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Confirm Execution'))
    .addSection(section)
    .addSection(actionSection)
    .build();
}

export function runExecution(e: any) {
  const sourceId = e.parameters.sourceId;
  const folderName = e.parameters.folderName;
  const mode = e.parameters.mode;

  try {
    const sourceParentFolder = DriveApp.getFolderById(sourceId);
    const analysis = analyzeFolderName(folderName);
    const scanResult = scanForCommittees(sourceParentFolder);
    const newRootName = folderName.replace(analysis.currentPattern, analysis.nextFull);
    const destParents = sourceParentFolder.getParents();
    const parentOfYear = destParents.hasNext() ? destParents.next() : DriveApp.getRootFolder();
    const destRootFolder = getOrCreateFolder(parentOfYear, newRootName);
    const fileMap: Record<string, string> = {};

    for (const comm of scanResult.committees) {
      let targetFolder;
      if (mode === 'direct') {
        targetFolder = destRootFolder;
      } else {
        const subName = transformText(comm.name, analysis);
        targetFolder = getOrCreateFolder(destRootFolder, subName);
      }

      processCommitteeCloning(comm.template, targetFolder, analysis, fileMap);
    }

    updateDocLinks(fileMap);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(`Success! Created ${newRootName}`))
      .setNavigation(
        CardService.newNavigation().updateCard(
          createCommitteeExecutionCard(newRootName, destRootFolder)
        )
      )
      .build();
  } catch (err: any) {
    console.error(err);
    return createCommitteeMessageCard(`Error: ${err.toString()}`, false);
  }
}

export function setupAuth() {
  console.log('Auth check verified');
}
