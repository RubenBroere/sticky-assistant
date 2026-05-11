/**
 * Entry point for the committee tool homepage.
 * Displays a welcome message and instructions.
 *
 * @param {Object} e - The event object.
 * @return {CardService.Card} The homepage card.
 */
function onCommitteeHomepage(e) {
  const lang = getLanguage();
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle(t(lang, "committeeWelcomeTitle", { appTitle: getToolTitle('committees') }))
      .setImageStyle(CardService.ImageStyle.CIRCLE))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph()
        .setText(t(lang, "committeeWelcomeIntro")))
      .addWidget(CardService.newTextParagraph()
        .setText(t(lang, "committeeHowToSteps")))
    )
    .addSection(CardService.newCardSection()
      .setHeader(t(lang, "committeeFeaturesTitle"))
      .addWidget(CardService.newKeyValue()
        .setTopLabel(t(lang, "committeeFeatureDetectionTitle"))
        .setContent(t(lang, "committeeFeatureDetectionBody"))
        .setIcon(COMMITTEE_CONFIG.ICONS.MAGIC)
        .setMultiline(true))
      .addWidget(CardService.newKeyValue()
        .setTopLabel(t(lang, "committeeFeatureContentTitle"))
        .setContent(t(lang, "committeeFeatureContentBody"))
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
function onDriveSelection(e) {
  const lang = getLanguage();
  // Guard clause for invalid event object
  if (!e || !e.drive || !e.drive.selectedItems) {
    return createCommitteeMessageCard(t(lang, "committeeSelectFolder"), true);
  }

  const items = e.drive.selectedItems;
  if (items.length === 0) {
    return createCommitteeMessageCard(t(lang, "committeeSelectFolder"), true);
  }

  if (items.length > 1) {
    return createCommitteeMessageCard(t(lang, "committeeSelectSingleFolder"), false);
  }

  const item = items[0];
  if (item.mimeType !== MimeType.FOLDER) {
    return createCommitteeMessageCard(t(lang, "committeeNotFolder"), false);
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
function runScan(e) {
  const lang = getLanguage();
  const sourceId = e.parameters.sourceId;
  const folderName = e.parameters.folderName;

  const analysis = analyzeFolderName(folderName);
  if (!analysis.found) {
    return createCommitteeMessageCard(t(lang, "committeeNoYearPattern"), false);
  }

  const sourceFolder = DriveApp.getFolderById(sourceId);
  const scanResult = scanForCommittees(sourceFolder);

  if (scanResult.mode === "none") {
    return createCommitteeMessageCard(t(lang, "committeeInvalidStructure", { templateName: COMMITTEE_CONFIG.TEMPLATE_NAME }), false);
  }

  const section = CardService.newCardSection()
    .addWidget(CardService.newKeyValue()
      .setTopLabel(t(lang, "committeeStructureDetected"))
      .setContent(scanResult.mode === "direct"
        ? t(lang, "committeeSingleCommittee")
        : t(lang, "committeeParentGroup", { count: scanResult.committees.length }))
      .setIcon(COMMITTEE_CONFIG.ICONS.INFO)
      .setMultiline(true))
    .addWidget(CardService.newKeyValue()
      .setTopLabel(t(lang, "committeeCurrentPattern"))
      .setContent(analysis.currentPattern)
      .setIcon(COMMITTEE_CONFIG.ICONS.CLOCK)
      .setMultiline(true))
    .addWidget(CardService.newKeyValue()
      .setTopLabel(t(lang, "committeeNextCycle"))
      .setContent(analysis.nextFull)
      .setIcon(COMMITTEE_CONFIG.ICONS.MAGIC)
      .setMultiline(true));

  const actionSection = CardService.newCardSection()
    .setHeader(t(lang, "committeeActionPlan"))
    .addWidget(CardService.newDecoratedText()
      .setText(t(lang, "committeeCreateFolder", { name: analysis.nextFull }))
      .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.CONFIRMATION_NUMBER_ICON))
      .setWrapText(true))
    .addWidget(CardService.newDecoratedText()
      .setText(scanResult.mode === "direct"
        ? t(lang, "committeeCloneTemplateContent")
        : t(lang, "committeeCloneAllSubCommittees"))
      .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.DESCRIPTION))
      .setWrapText(true))
    .addWidget(CardService.newTextButton()
      .setText(t(lang, "committeeExecuteClone"))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor(getToolAccent('committees'))
      .setOnClickAction(CardService.newAction()
        .setFunctionName("runExecution")
        .setParameters({ "sourceId": sourceId, "folderName": folderName, "mode": scanResult.mode })
      ));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle(t(lang, "committeeConfirmExecution")))
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
function runExecution(e) {
  const lang = getLanguage();
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
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(t(lang, "committeeSuccessCreated", { name: newRootName })))
      .setNavigation(CardService.newNavigation().updateCard(
        CardService.newCardBuilder()
          .setHeader(CardService.newCardHeader().setTitle(t(lang, "committeeTaskComplete")))
          .addSection(CardService.newCardSection()
            .addWidget(CardService.newKeyValue()
              .setTopLabel(t(lang, "committeeStatus"))
              .setContent(t(lang, "committeeStatusSuccess"))
              .setIcon(COMMITTEE_CONFIG.ICONS.CHECK)
              .setButton(CardService.newTextButton()
                .setText(t(lang, "committeeOpenFolder"))
                .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
                .setBackgroundColor(getToolAccent('committees'))
                .setOpenLink(CardService.newOpenLink().setUrl(destRootFolder.getUrl()))))
            .addWidget(CardService.newKeyValue()
              .setTopLabel(t(lang, "committeeCreatedFolder"))
              .setContent(newRootName)
              .setMultiline(true))
            .addWidget(CardService.newTextButton()
              .setText(t(lang, "committeeStartOver"))
              .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
              .setBackgroundColor(getToolAccent('committees'))
              .setOnClickAction(CardService.newAction().setFunctionName("onDriveSelection"))
            ))
          .build()
      ))
      .build();

  } catch (err) {
    console.error(err);
    return createCommitteeMessageCard(t(lang, "committeeErrorPrefix", { error: err.toString() }), false);
  }
}

/**
 * Placeholder function for OAuth scope authorization.
 */
function setupAuth() {
  console.log("Auth check verified");
}
