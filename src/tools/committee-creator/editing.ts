import { COMMITTEE_CONFIG } from './config';
import { getOrCreateFolder, getUniqueFileName, transformText } from './scanning';
import { createCommitteeAnalyzeCard, createCommitteeExecutionCard } from './cards';
import { buildStatusCard } from '../../core/cards';
import { analyzeFolderName } from './scanning';
import { committeeSettingsManager } from './settings';

export function processCommitteeCloning(
  sourceTemplate: GoogleAppsScript.Drive.Folder,
  destFolder: GoogleAppsScript.Drive.Folder,
  analysis: any,
  fileMap: Record<string, string>,
  settings: any
) {
  copyFolderContents(sourceTemplate, destFolder, true, analysis, fileMap, settings);
  const newTemplateFolder = getOrCreateFolder(destFolder, settings.templateFolderName);
  copyFolderContents(sourceTemplate, newTemplateFolder, false, analysis, null, settings);
}

export function scanForCommittees(rootFolder: GoogleAppsScript.Drive.Folder, settings: any) {
  const templateName = settings.templateFolderName || 'Template';
  const templates = rootFolder.getFoldersByName(templateName);
  if (templates.hasNext()) {
    return {
      mode: 'direct',
      committees: [{ name: rootFolder.getName(), folder: rootFolder, template: templates.next() }],
    };
  }

  if (settings.includeSubCommittees === false) {
    return { mode: 'none', committees: [] };
  }

  const subs = rootFolder.getFolders();
  const committees: any[] = [];
  while (subs.hasNext()) {
    const sub = subs.next();
    const subTemplates = sub.getFoldersByName(templateName);
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
  fileMap: Record<string, string> | null = null,
  settings: any
) {
  const files = source.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const rawName = shouldTransform
      ? transformText(file.getName(), analysis, settings)
      : file.getName();
    const finalName = getUniqueFileName(target, rawName);
    const copiedFile = file.makeCopy(finalName, target);
    if (fileMap) {
      fileMap[file.getId()] = copiedFile.getId();
    }

    if (shouldTransform && file.getMimeType() === (MimeType as any).GOOGLE_DOCS) {
      editDocContent(copiedFile.getId(), analysis, settings);
    }
  }

  const folders = source.getFolders();
  while (folders.hasNext()) {
    const sub = folders.next();
    const rawSubName = shouldTransform
      ? transformText(sub.getName(), analysis, settings)
      : sub.getName();
    const subTarget = getOrCreateFolder(target, rawSubName);
    copyFolderContents(sub, subTarget, shouldTransform, analysis, fileMap, settings);
  }
}

export function editDocContent(docId: string, analysis: any, settings: any) {
  try {
    const doc = DocumentApp.openById(docId);
    const body = doc.getBody();
    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    body.replaceText(escapeRegExp(settings.placeholderFull || '[YEAR]'), analysis.nextFull);
    body.replaceText(escapeRegExp(settings.placeholderY1 || '[YEAR_1]'), analysis.nextY1);
    body.replaceText(escapeRegExp(settings.placeholderY2 || '[YEAR_2]'), analysis.nextY2);

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
    return buildStatusCard(
      'Selection Required',
      'Please select a folder in Google Drive to begin.',
      'info'
    );
  }

  const items = e.drive.selectedItems;
  if (items.length === 0) {
    return buildStatusCard(
      'Selection Required',
      'Please select a folder in Google Drive to begin.',
      'info'
    );
  }

  if (items.length > 1) {
    return buildStatusCard(
      'Single Folder Required',
      'Please select only one folder to clone.',
      'warning'
    );
  }

  const item = items[0];
  if (item.mimeType !== (MimeType as any).FOLDER) {
    return buildStatusCard(
      'Invalid Selection',
      'The selected item is not a folder. Please select a valid folder.',
      'error'
    );
  }

  return createCommitteeAnalyzeCard(item.title, item.id);
}

export function runScan(e: any) {
  const sourceId = e.parameters.sourceId;
  const folderName = e.parameters.folderName;

  const settings = committeeSettingsManager.load(e);
  const templateName = settings.templateFolderName || 'Template';

  const analysis = analyzeFolderName(folderName);
  if (!analysis.found) {
    return buildStatusCard(
      'No Year Pattern Detected',
      'The folder name must contain a year pattern (e.g. YYYY or YYYY-YYYY) to roll forward.',
      'error'
    );
  }

  const sourceFolder = DriveApp.getFolderById(sourceId);
  const scanResult = scanForCommittees(sourceFolder, settings);

  if (scanResult.mode === 'none') {
    return buildStatusCard(
      'Invalid Folder Structure',
      `The selected folder does not contain a "${templateName}" subfolder, and neither do any of its subfolders. Please check your folder structure.`,
      'error'
    );
  }

  const section = CardService.newCardSection()
    .addWidget(
      CardService.newDecoratedText()
        .setStartIcon(CardService.newIconImage().setIcon(COMMITTEE_CONFIG.ICONS.INFO))
        .setText('Structure Detected')
        .setBottomLabel(
          scanResult.mode === 'direct'
            ? 'Single Committee'
            : `Parent Group (${scanResult.committees.length} Committees)`
        )
        .setWrapText(true)
    )
    .addWidget(
      CardService.newDecoratedText()
        .setStartIcon(CardService.newIconImage().setIcon(COMMITTEE_CONFIG.ICONS.CLOCK))
        .setText('Current Pattern')
        .setBottomLabel(analysis.currentPattern)
        .setWrapText(true)
    )
    .addWidget(
      CardService.newDecoratedText()
        .setStartIcon(CardService.newIconImage().setIcon(COMMITTEE_CONFIG.ICONS.MAGIC))
        .setText('Next Cycle Target')
        .setBottomLabel(analysis.nextFull)
        .setWrapText(true)
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
    const settings = committeeSettingsManager.load(e);
    const sourceParentFolder = DriveApp.getFolderById(sourceId);
    const analysis = analyzeFolderName(folderName);
    const scanResult = scanForCommittees(sourceParentFolder, settings);
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
        const subName = transformText(comm.name, analysis, settings);
        targetFolder = getOrCreateFolder(destRootFolder, subName);
      }

      processCommitteeCloning(comm.template, targetFolder, analysis, fileMap, settings);
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
    return buildStatusCard('Execution Error', err.toString(), 'error');
  }
}

export function setupAuth() {
  console.log('Auth check verified');
}
