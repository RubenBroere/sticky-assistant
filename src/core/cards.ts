export function buildSettingsCard() {
  const builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle('Settings'));

  // --- TOOL SETTINGS SECTION ---
  const toolSection = CardService.newCardSection().setHeader('Tool Settings');

  toolSection.addWidget(
    CardService.newTextButton()
      .setText('Action Points')
      .setOnClickAction(CardService.newAction().setFunctionName('buildActionPointsSettingsCard'))
  );

  toolSection.addWidget(
    CardService.newTextButton()
      .setText('Committees')
      .setOnClickAction(CardService.newAction().setFunctionName('buildCommitteeSettingsCard'))
  );

  toolSection.addWidget(
    CardService.newTextButton()
      .setText('PDF Comment Viewer')
      .setOnClickAction(CardService.newAction().setFunctionName('buildDriveCommentsSettingsCard'))
  );

  builder.addSection(toolSection);

  // --- NAVIGATION SECTION ---
  const navSection = CardService.newCardSection();
  const backAction = CardService.newAction().setFunctionName('onDefaultHomepage');
  navSection.addWidget(CardService.newTextButton().setText('Back').setOnClickAction(backAction));

  builder.addSection(navSection);

  return builder.build();
}

export function createMessageCard(title: string, message: string) {
  const builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle(title));
  const section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph().setText(message));

  const backAction = CardService.newAction().setFunctionName('onDefaultHomepage');
  section.addWidget(CardService.newTextButton().setText('Back').setOnClickAction(backAction));

  builder.addSection(section);
  return builder.build();
}
