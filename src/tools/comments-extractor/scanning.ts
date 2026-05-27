export interface DriveSelectionItem {
  id: string;
  title: string;
  mimeType: string;
}

export function getSelectedDriveItems(e: any): DriveSelectionItem[] {
  return e && e.drive && Array.isArray(e.drive.selectedItems) ? e.drive.selectedItems : [];
}

export function getSelectedPdfItem(e: any): DriveSelectionItem | null {
  const items = getSelectedDriveItems(e);
  if (items.length === 0) return null;

  const item = items[0];
  return item.mimeType === 'application/pdf' ? item : null;
}
