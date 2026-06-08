import { describe, it, expect, vi } from 'vitest';

vi.mock('./settings', () => ({
  actionPointsSettingsManager: {
    load: () => ({ peopleConfig: {} }),
  },
}));

import { applyDocumentActionsLogic } from './editing';

describe('applyDocumentActionsLogic', () => {
  it('adds Actiepunten as an H1 heading when adding action points to top', () => {
    const setHeading = vi.fn();
    const setGlyphType = vi.fn();
    const body = {
      findText: vi.fn(() => null),
      insertParagraph: vi.fn(() => ({ setHeading })),
      insertListItem: vi.fn(() => ({ setGlyphType })),
    };
    const doc = {
      getBody: () => body,
    };

    globalThis.DocumentApp = {
      getActiveDocument: () => doc,
      ParagraphHeading: {
        HEADING1: 'HEADING1',
      },
      GlyphType: {
        BULLET: 'BULLET',
      },
    } as any;

    const result = applyDocumentActionsLogic({
      parameters: {
        addToTop: 'true',
        resultJson: JSON.stringify({
          openMatches: [{ assignees: ['Alice'], action: 'Uitwerken', date: null }],
          completedMatches: [],
        }),
      },
    });

    expect(result.ok).toBe(true);
    expect(body.insertParagraph).toHaveBeenCalledWith(0, 'Actiepunten');
    expect(setHeading).toHaveBeenCalledWith('HEADING1');
  });
});
