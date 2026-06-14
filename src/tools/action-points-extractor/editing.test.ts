import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.CardService = {
    Icon: {
      STORE: 'STORE_ICON',
    },
  } as any;
});

import { applyDocumentActionsLogic } from './editing';

// Mock properties/settings
const mockUserProperties: Record<string, string> = {};
globalThis.PropertiesService = {
  getUserProperties: () => ({
    getProperty: (key: string) => mockUserProperties[key] ?? null,
    setProperty: (key: string, value: string) => {
      mockUserProperties[key] = value;
    },
  }),
} as any;

class MockElement {
  type: any;
  text: string;
  isBoldValue: boolean;
  strikethrough: boolean = false;

  constructor(type: any, text: string, isBold: boolean = false) {
    this.type = type;
    this.text = text;
    this.isBoldValue = isBold;
  }

  getType() {
    return this.type;
  }

  getText() {
    return this.text;
  }

  editAsText() {
    return this;
  }

  asText() {
    return this;
  }

  isBold(_index: number) {
    return this.isBoldValue;
  }

  setStrikethrough(_start: number, _end: number, strikethrough: boolean) {
    this.strikethrough = strikethrough;
    return this;
  }
}

class MockParagraph extends MockElement {
  heading: any;
  setHeading(heading: any) {
    this.heading = heading;
    return this;
  }
}

class MockListItem extends MockElement {
  glyphType: any;
  setGlyphType(glyphType: any) {
    this.glyphType = glyphType;
    return this;
  }
}

let mockChildren: MockElement[] = [];

const mockBody = {
  getChildren: () => mockChildren,
  getNumChildren: () => mockChildren.length,
  getChild: (index: number) => mockChildren[index],
  insertParagraph: (index: number, text: string) => {
    const p = new MockParagraph('PARAGRAPH', text);
    mockChildren.splice(index, 0, p);
    return p;
  },
  insertListItem: (index: number, text: string) => {
    const li = new MockListItem('LIST_ITEM', text);
    mockChildren.splice(index, 0, li);
    return li;
  },
  findText: (pattern: string) => {
    for (const child of mockChildren) {
      if (child.text.indexOf(pattern) !== -1) {
        return {
          getElement: () => child,
          getStartOffset: () => child.text.indexOf(pattern),
          getEndOffsetInclusive: () => child.text.indexOf(pattern) + pattern.length - 1,
        };
      }
    }
    return null;
  },
};

globalThis.DocumentApp = {
  ParagraphHeading: {
    HEADING2: 'HEADING2',
  },
  GlyphType: {
    BULLET: 'BULLET',
  },
  ElementType: {
    PARAGRAPH: 'PARAGRAPH',
    LIST_ITEM: 'LIST_ITEM',
  },
  getActiveDocument: () => ({
    getBody: () => mockBody,
  }),
} as any;

describe('applyDocumentActionsLogic', () => {
  beforeEach(() => {
    mockChildren = [];
    Object.keys(mockUserProperties).forEach((k) => delete mockUserProperties[k]);
  });

  it('fails gracefully when no document is active', () => {
    const oldGetActiveDocument = globalThis.DocumentApp.getActiveDocument;
    globalThis.DocumentApp.getActiveDocument = () => null as any;

    try {
      const res = applyDocumentActionsLogic({});
      expect(res.ok).toBe(false);
      expect(res.message).toBe('No active Google Doc found.');
    } finally {
      globalThis.DocumentApp.getActiveDocument = oldGetActiveDocument;
    }
  });

  it('should parse matchesJson and execute addToTop and replaceInPlace correctly', () => {
    // Add an initial paragraph to mock document
    const initialParagraph = new MockParagraph('PARAGRAPH', 'AP Ruben: Finished Task', false);
    mockChildren.push(initialParagraph);

    // Mock settings
    mockUserProperties['actionPointsExtractor__peopleConfig'] = JSON.stringify({
      Ruben: { order: 1, aliases: [] },
    });

    const event = {
      parameters: {
        matchesJson: JSON.stringify({
          openMatches: [
            {
              originalName: 'Ruben',
              assignees: ['Ruben'],
              action: 'Task 1',
              date: '2026-06-15',
              isBold: true,
              location: {
                childIndex: 0,
                matchIndex: 0,
                matchLength: 22,
              },
              originalText: 'AP Ruben: Task 1',
            },
          ],
          completedMatches: [
            {
              originalName: 'Ruben',
              assignees: ['Ruben'],
              action: 'Finished Task',
              date: null,
              isBold: false,
              location: {
                childIndex: 0,
                matchIndex: 0,
                matchLength: 23,
              },
              originalText: 'AP Ruben: Finished Task',
            },
          ],
        }),
      },
      formInput: {
        addToTopAction: 'addToTop',
        replaceInPlaceAction: 'replaceInPlace',
      },
    };

    const res = applyDocumentActionsLogic(event);
    expect(res.ok).toBe(true);

    // Verify that strikethrough was set to true on the completed task in the document
    expect(initialParagraph.strikethrough).toBe(true);

    // Verify that "Action points" header and bullet list item were inserted at the top (indices 0 and 1)
    expect(mockChildren[0].text).toBe('Action points');
    expect(mockChildren[0].getType()).toBe('PARAGRAPH');
    expect((mockChildren[0] as MockParagraph).heading).toBe('HEADING2');

    expect(mockChildren[1].text).toBe('AP Ruben: Task 1 [2026-06-15]');
    expect(mockChildren[1].getType()).toBe('LIST_ITEM');
    expect((mockChildren[1] as MockListItem).glyphType).toBe('BULLET');
  });
});
