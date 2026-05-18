/**
 * Triggered when a user selects items in Google Drive.
 * Builds the initial sidebar UI.
 */
export function onDriveItemsSelected(e: any) {
  const selectedItems = e.drive.selectedItems;

  // If nothing is selected, show a prompt
  if (!selectedItems || selectedItems.length === 0) {
    return buildEmptyCard('Select a PDF file to view comments.');
  }

  const item = selectedItems[0];
  const isPdf = item.mimeType === 'application/pdf';

  // Only proceed if it's a PDF
  if (!isPdf) {
    return buildEmptyCard('Unsupported file type. Please select a PDF.');
  }

  // Build the Card UI
  const card = CardService.newCardBuilder().setHeader(
    CardService.newCardHeader().setTitle('PDF Comment Viewer')
  );

  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(`**Selected:** ${item.title}`))
    .addWidget(
      CardService.newTextParagraph().setText(
        'Click below to view comments directly in this sidebar.'
      )
    );

  // Create the action that runs when the button is clicked
  const action = CardService.newAction().setFunctionName('exportCommentsToSheet').setParameters({
    itemId: item.id,
    itemName: item.title,
  });

  const button = CardService.newTextButton()
    .setText('View Comments')
    .setOnClickAction(action)
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED);

  section.addWidget(button);
  card.addSection(section);

  return card.build();
}

/**
 * Helper to build a simple text card when selection is invalid.
 */
export function buildEmptyCard(text: string) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('PDF Comment Viewer'))
    .addSection(
      CardService.newCardSection().addWidget(CardService.newTextParagraph().setText(text))
    )
    .build();
}

/**
 * Refactored: Triggered by the button click.
 * Shows parent comments with a summary.
 */
export function displayCommentsUI(e: any) {
  const fileId = e.parameters.itemId;
  const fileName = e.parameters.itemName;

  // Track counts
  let parentCount = 0;
  let totalReplyCount = 0;

  const card = CardService.newCardBuilder().setHeader(
    CardService.newCardHeader().setTitle('PDF Comment Viewer').setSubtitle(fileName)
  );

  let section = CardService.newCardSection();
  let widgetCount = 0;
  let pageToken = null;

  try {
    do {
      // Note: We use any here because DriveApp/Drive API types might not be fully loaded in this environment
      const response: any = (Drive as any).Comments.list(fileId, {
        fields:
          'nextPageToken, comments(id,author/displayName,content,createdTime,replies(author/displayName,content,createdTime))',
        pageSize: 100,
        pageToken: pageToken,
      });

      const comments = response.comments;

      if (comments && comments.length > 0) {
        comments.forEach((comment: any) => {
          parentCount++;
          const authorName = comment.author ? comment.author.displayName : 'Unknown';
          const replies = comment.replies || [];
          totalReplyCount += replies.length;

          if (widgetCount >= 90) {
            card.addSection(section);
            section = CardService.newCardSection();
            widgetCount = 0;
          }

          // Format the Parent Comment
          const commentWidget = CardService.newDecoratedText()
            .setTopLabel(`${authorName}`)
            .setText(comment.content)
            .setWrapText(true);

          // If there are replies, add a button to view them specifically or show a count
          if (replies.length > 0) {
            commentWidget.setBottomLabel(`0 Threads • ${replies.length} Replies`);

            // This action would push a NEW card with just the thread details
            const viewThreadAction = CardService.newAction()
              .setFunctionName('viewCommentThread')
              .setParameters({
                fileId: fileId,
                commentId: comment.id,
              });

            commentWidget.setOnClickAction(viewThreadAction);
          }

          section.addWidget(commentWidget);
          widgetCount++;
        });
      }
      pageToken = response.nextPageToken;
    } while (pageToken);

    // Summary Section at the Top
    const summarySection = CardService.newCardSection().addWidget(
      CardService.newDecoratedText()
        .setText('**Summary**')
        .setBottomLabel(`${parentCount} Threads \u2022 ${totalReplyCount} Replies`)
        .setStartIcon(CardService.newIconImage().setIcon(CardService.Icon.DESCRIPTION))
    );

    card.addSection(summarySection);

    if (parentCount === 0) {
      section.addWidget(CardService.newTextParagraph().setText('No comments found.'));
    }
  } catch (error: any) {
    section.addWidget(CardService.newTextParagraph().setText(`Error: ${error.message}`));
  }

  card.addSection(section);

  const nav = CardService.newNavigation().pushCard(card.build());
  return CardService.newActionResponseBuilder().setNavigation(nav).build();
}

/**
 * New Function: Shows a specific comment thread (The "Expanded" view)
 */
export function viewCommentThread(e: any) {
  const fileId = e.parameters.fileId;
  const commentId = e.parameters.commentId;

  const comment: any = (Drive as any).Comments.get(fileId, commentId, {
    fields:
      'author/displayName,content,createdTime,replies(author/displayName,content,createdTime)',
  });

  const card = CardService.newCardBuilder().setHeader(
    CardService.newCardHeader().setTitle('Comment Thread')
  );

  const section = CardService.newCardSection().addWidget(
    CardService.newDecoratedText()
      .setTopLabel(comment.author.displayName)
      .setText(`<b>${comment.content}</b>`)
  );

  if (comment.replies) {
    comment.replies.forEach((reply: any) => {
      section.addWidget(
        CardService.newDecoratedText()
          .setTopLabel(`↳ ${reply.author.displayName}`)
          .setText(reply.content)
          .setWrapText(true)
      );
    });
  }

  card.addSection(section);
  return card.build();
}

/**
 * Drive Comments Settings UI (Placeholder)
 */
export function buildDriveCommentsSettingsCard() {
  const builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle('Drive Comments Settings'));

  const section = CardService.newCardSection();
  section.addWidget(
    CardService.newTextParagraph().setText('Click below to view comments directly in this sidebar.')
  );
  builder.addSection(section);

  const actionSection = CardService.newCardSection();
  actionSection.addWidget(
    CardService.newTextButton()
      .setText('Back')
      .setOnClickAction(CardService.newAction().setFunctionName('buildSettingsCard'))
  );

  builder.addSection(actionSection);
  return builder.build();
}

/**
 * Save Drive Comments Settings (Placeholder)
 */
export function saveDriveCommentsSettings() {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Settings saved!'))
    .build();
}
