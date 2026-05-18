export interface CommentsExportResult {
  ok: boolean;
  message: string;
  count?: number;
  sheetUrl?: string;
}

function formatExportDate(raw: string | null | undefined) {
  if (!raw) return 'Unknown';
  return new Date(raw).toLocaleString();
}

export function exportCommentsToSheetLogic(e: any): CommentsExportResult {
  const fileId = e.parameters.itemId;
  const fileName = e.parameters.itemName;

  try {
    const ss = SpreadsheetApp.create(`Comments Export: ${fileName}`);
    const sheet = ss.getActiveSheet();

    const headers = ['Date', 'Name', 'ID', 'Reply To (ID)', 'Comment', 'Quoted Content / Anchor'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f3f3');

    let pageToken: string | null = null;
    const allCommentData: any[][] = [];

    do {
      const response: any = (Drive as any).Comments.list(fileId, {
        fields:
          'nextPageToken, comments(id,author/displayName,content,quotedFileContent,anchor,createdTime,replies(id,author/displayName,content,createdTime))',
        pageSize: 100,
        pageToken,
      });

      const comments = response.comments;
      if (comments && comments.length > 0) {
        comments.forEach((comment: any) => {
          const parentAuthor = comment.author ? comment.author.displayName : 'Unknown';
          const quote = comment.quotedFileContent
            ? comment.quotedFileContent.value
            : comment.anchor || 'N/A';
          const parentDate = formatExportDate(comment.createdTime);

          allCommentData.push([parentDate, parentAuthor, comment.id, '', comment.content, quote]);

          if (comment.replies && comment.replies.length > 0) {
            comment.replies.forEach((reply: any) => {
              const replyAuthor = reply.author ? reply.author.displayName : 'Unknown';
              const replyDate = formatExportDate(reply.createdTime);

              allCommentData.push([
                replyDate,
                replyAuthor,
                reply.id,
                comment.id,
                reply.content,
                '↳ (See Parent)',
              ]);
            });
          }
        });
      }

      pageToken = response.nextPageToken;
    } while (pageToken);

    if (allCommentData.length > 0) {
      sheet.getRange(2, 1, allCommentData.length, headers.length).setValues(allCommentData);
    }

    return {
      ok: true,
      message: `Successfully exported **${allCommentData.length}** items.`,
      count: allCommentData.length,
      sheetUrl: ss.getUrl(),
    };
  } catch (error: any) {
    return {
      ok: false,
      message: `Error: ${error.message}`,
    };
  }
}
