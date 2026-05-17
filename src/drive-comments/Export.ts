import { t } from '../core/Locale';
import { buildEmptyCard } from './Ui';

/**
 * Main function to export PDF comments to a Google Sheet efficiently.
 */
export function exportCommentsToSheet(e: any) {
  const fileId = e.parameters.itemId;
  const fileName = e.parameters.itemName;
  
  try {
    // Create the Spreadsheet
    const ss = SpreadsheetApp.create(t('driveCommentsExportName', { fileName }));
    const sheet = ss.getActiveSheet();
    
    // Set Header Row
    const headers = [
      t('driveCommentsHeaderDate'),
      t('driveCommentsHeaderName'),
      t('driveCommentsHeaderId'),
      t('driveCommentsHeaderReplyTo'),
      t('driveCommentsHeaderComment'),
      t('driveCommentsHeaderQuote')
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");

    let pageToken = null;
    const allCommentData: any[][] = []; 

    // Fetch and Process Comments (In Memory)
    do {
      const response: any = (Drive as any).Comments.list(fileId, {
        fields: 'nextPageToken, comments(id,author/displayName,content,quotedFileContent,anchor,createdTime,replies(id,author/displayName,content,createdTime))',
        pageSize: 100, 
        pageToken: pageToken
      });

      const comments = response.comments;

      if (comments && comments.length > 0) {
        comments.forEach((comment: any) => {
          // Process Parent Comment
          const parentAuthor = comment.author ? comment.author.displayName : "Unknown";
          const quote = comment.quotedFileContent ? comment.quotedFileContent.value : (comment.anchor || "N/A");
          const parentDate = comment.createdTime ? new Date(comment.createdTime).toLocaleString() : "Unknown";
          
          allCommentData.push([
            parentDate,
            parentAuthor,
            comment.id,
            "", 
            comment.content,
            quote
          ]);

          // Process Replies
          if (comment.replies && comment.replies.length > 0) {
            comment.replies.forEach((reply: any) => {
              const replyAuthor = reply.author ? reply.author.displayName : "Unknown";
              const replyDate = reply.createdTime ? new Date(reply.createdTime).toLocaleString() : "Unknown";
              
              allCommentData.push([
                replyDate,
                replyAuthor,
                reply.id,
                comment.id, 
                reply.content,
                t('driveCommentsReplyIndicator')
              ]);
            });
          }
        });
      }
      pageToken = response.nextPageToken;
    } while (pageToken);

    // Batch write everything to the sheet in one single API call
    if (allCommentData.length > 0) {
      sheet.getRange(2, 1, allCommentData.length, headers.length).setValues(allCommentData);
    }

    // Return the confirmation Card
    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle(t('driveCommentsExportComplete')))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText(t('driveCommentsExportSuccess', { count: allCommentData.length })))
        .addWidget(CardService.newTextButton()
          .setText(t('driveCommentsOpenSheet'))
          .setOpenLink(CardService.newOpenLink().setUrl(ss.getUrl()))))
      .build();

  } catch (error: any) {
    return buildEmptyCard(t('committeeErrorPrefix', { error: error.message }));
  }
}
