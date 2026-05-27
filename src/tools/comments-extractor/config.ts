export type CommentsExtractorConfig = Record<string, never>;
export function validateCommentsExtractorConfig(formInput: Record<string, any>): {
  ok: boolean;
  message?: string;
} {
  if (
    formInput.exportSheetPrefix !== undefined &&
    String(formInput.exportSheetPrefix).length === 0
  ) {
    return { ok: false, message: 'Export sheet prefix cannot be empty.' };
  }
  return { ok: true };
}
