import { getToolTitle, getToolAccent } from '../core/Branding';
import { t } from '../core/Locale';
import { COMMITTEE_CONFIG } from './Config';
import { createCommitteeMessageCard, createCommitteeAnalyzeCard } from './Ui';
import { analyzeFolderName, transformText, getOrCreateFolder } from './Utils';
import { scanForCommittees, processCommitteeCloning, updateDocLinks } from './Services';

/**
 * Entry point for the committee tool homepage.
 * Displays a welcome message and instructions.
 *
 * @param {Object} e - The event object.
 * @return {CardService.Card} The homepage card.
 */
export function onCommitteeHomepage(e: any) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle(t("committeeWelcomeTitle", { appTitle: getToolTitle('committees') }))
      .setImageStyle(CardService.ImageStyle.CIRCLE))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText(t("committeeWelcomeIntro")))
      .addWidget(CardService.newTextParagraph()
        .setText(t("committeeHowToSteps")))
    )
    .addSection(CardService.newCardSection()
      .setHeader(t("committeeFeaturesTitle"))
      .addWidget(CardService.newKeyValue()
        .setTopLabel(t("committeeFeatureDetectionTitle"))
        .setContent(t("committeeFeatureDetectionBody"))
        .setIcon(COMMITTEE_CONFIG.ICONS.MAGIC)
        .setMultiline(true))
      .addWidget(CardService.newKeyValue()
        .setTopLabel(t("committeeFeatureContentTitle"))
        .setContent(t("committeeFeatureContentBody"))
        .setIcon(COMMITTEE_CONFIG.ICONS.DESCRIPTION)
        .setMultiline(true))
    )
    .build();
}

/**
 * Entry point triggered when a user selects a file or folder in Google Drive.
 * Validates the selection to ensure it is a single folder.
 *
 * @param {Object} e - The event object context from the Drive selection.
 * @return {CardService.Card} The UI card to display.
 */
export function onDriveSelection(e: any) {
  // Guard clause for invalid event object
  if (!e || !e.drive || !e.drive.selectedItems) {
    return createCommitteeMessageCard(t("committeeSelectFolder"), true);
  }

  const items = e.drive.selectedItems;
  if (items.length === 0) {
    return createCommitteeMessageCard(t("committeeSelectFolder"), true);
  }

  if (items.length > 1) {
    return createCommitteeMessageCard(t("committeeSelectSingleFolder"), false);
  }

  const item = items[0];
  if (item.mimeType !== (MimeType as any).FOLDER) {
    return createCommitteeMessageCard(t("committeeNotFolder"), false);
  }

  return createCommitteeAnalyzeCard(item.title, item.id);
}

/**
 * Scans the selected folder for year patterns and verifies the existence of a template folder.
 * Supports both Direct Mode (Template in root) and Parent Mode (Templates in subfolders).
 *
 * @param {Object} e - The event object.
 * @return {CardService.Card} The UI card displaying the scan results or an error.
 */
export function runScan(e: any) {
  const sourceId = e.parameters.sourceId;
  const folderName = e.parameters.folderName;

  const analysis = analyzeFolderName(folderName);
  if (!analysis.found) {
    return createCommitteeMessageCard(t("committeeNoYearPattern"), false);
  }

  const sourceFolder = DriveApp.getFolderById(sourceId);
  const scanResult = scanForCommittees(sourceFolder);

  if (scanResult.mode === "none") {
    return createCommitteeMessageCard(t("committeeInvalidStructure", { templateName: COMMITTEE_CONFIG.TEMPLATE_NAME }), false);
  }

  const section = CardService.newCardSection()
    .addWidget(CardService.newKeyValue()
      .setTopLabel(t("committeeStructureDetected"))
      .setContent(scanResult.mode === "direct"
        ? t("committeeSingleCommittee")
        : t("committeeParentGroup", { count: scanResult.committees.length }))
      .setIcon(COMMITTEE_CONFIG.ICONS.INFO)
      .setMultiline(true))
    .addWidget(CardService.newKeyValue()
      .setTopLabel(t("committeeCurrentPattern"))
      .setContent(analysis.currentPattern)
      .setIcon(COMMITTEE_CONFIG.ICONS.CLOCK)
      .setMultiline(true))
    .addWidget(CardService.newKeyValue()
      .setTopLabel(t("committeeNextCycle"))
      .setContent(analysis.nextFull)
      .setIcon(COMMITTEE_CONFIG.ICONS.MAGIC)
      .setMultiline(true));

  const actionSection = CardService.newCardSection()
    .setHeader(t("committeeActionPlan"))
    .addWidget(CardService.newDecoratedText()
      .setText(t("committeeCreateFolder", { name: analysis.nextFull }))
      .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.CONFIRMATION_NUMBER_ICON))
      .setWrapText(true))
    .addWidget(CardService.newDecoratedText()
      .setText(scanResult.mode === "direct"
        ? t("committeeCloneTemplateContent")
        : t("committeeCloneAllSubCommittees"))
      .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.DESCRIPTION))
      .setWrapText(true))
    .addWidget(CardService.newTextButton()
      .setText(t("committeeExecuteClone"))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor(getToolAccent('committees'))
      .setOnClickAction(CardService.newAction()
        .setFunctionName("runExecution")
        .setParameters({ "sourceId": sourceId, "folderName": folderName, "mode": scanResult.mode })
      ));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(t("committeeConfirmExecution")))
    .addSection(section)
    .addSection(actionSection)
    .build();
}

/**
 * Executes the cloning process.
 * Creates the new folder structure and copies contents from the template,
 * applying transformations where necessary.
 *
 * @param {Object} e - The event object.
 * @return {CardService.Card} The success or error card.
 */
export function runExecution(e: any) {
  console.log("Started execution", JSON.stringify(e.parameters));
  const sourceId = e.parameters.sourceId;
  const folderName = e.parameters.folderName;
  const mode = e.parameters.mode; // "direct" or "parent"

  try {
    const sourceParentFolder = DriveApp.getFolderById(sourceId);
    const analysis = analyzeFolderName(folderName);
    const scanResult = scanForCommittees(sourceParentFolder); // Re-scan to get references

    // Determine new folder name
    const newRootName = folderName.replace(analysis.currentPattern, analysis.nextFull);
    console.log("New root folder name:", newRootName);

    // Create/find destination root
    const destParents = sourceParentFolder.getParents();
    const parentOfYear = destParents.hasNext() ? destParents.next() : DriveApp.getRootFolder();
    const destRootFolder = getOrCreateFolder(parentOfYear, newRootName);

    // Track ID mappings for link updates {oldId: newId}
    const fileMap = {};

    // Process committees
    for (const comm of scanResult.committees) {
      console.log("Processing committee: " + comm.name);
      let targetFolder;

      if (mode === "direct") {
        // In direct mode, the root is the committee folder
        targetFolder = destRootFolder;
      } else {
        // In parent mode, create the sub-committee folder
        const subName = transformText(comm.name, analysis);
        targetFolder = getOrCreateFolder(destRootFolder, subName);
      }

      // Execute cloning for this specific committee
      processCommitteeCloning(comm.template, targetFolder, analysis, fileMap);
    }

    // Updating linked objects (warning only)
    console.log("Starting linked object updates...");
    updateDocLinks(fileMap);

    // Return success card
    return (CardService as any).newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(t("committeeSuccessCreated", { name: newRootName })))
      .setNavigation(CardService.newNavigation().updateCard(
        CardService.newCardBuilder()
          .setHeader(CardService.newCardHeader().setTitle(t("committeeTaskComplete")))
          .addSection(CardService.newCardSection()
            .addWidget(CardService.newKeyValue()
              .setTopLabel(t("committeeStatus"))
              .setContent(t("committeeStatusSuccess"))
              .setIcon(COMMITTEE_CONFIG.ICONS.CHECK)
              .setButton(CardService.newTextButton()
                .setText(t("committeeOpenFolder"))
                .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
                .setBackgroundColor(getToolAccent('committees'))
                .setOpenLink(CardService.newOpenLink().setUrl(destRootFolder.getUrl()))))
            .addWidget(CardService.newKeyValue()
              .setTopLabel(t("committeeCreatedFolder"))
              .setContent(newRootName)
              .setMultiline(true))
            .addWidget(CardService.newTextButton()
              .setText(t("committeeStartOver"))
              .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
              .setBackgroundColor(getToolAccent('committees'))
              .setOnClickAction(CardService.newAction().setFunctionName("onDriveSelection"))
            ))
          .build()
      ))
      .build();

  } catch (err: any) {
    console.error(err);
    return createCommitteeMessageCard(t("committeeErrorPrefix", { error: err.toString() }), false);
  }
}

/**
 * Placeholder function for OAuth scope authorization.
 */
export function setupAuth() {
  console.log("Auth check verified");
}
