import { t } from '../core/Locale';
import { createMessageCard } from '../core/Ui';
import { getPeopleConfig, buildAliasLookup, validatePeopleConfig, getOrderForPerson } from './Config';

// Apply document changes: add to top and/or replace aliases in-place
export function applyDocumentActions(e: any) {
  const params = e.parameters || {};
  const form = e.formInput || {};
  const matchesJson = params.matchesJson || '{}';
  let parsed;
  try {
    parsed = JSON.parse(matchesJson);
  } catch (err) {
    return createMessageCard(t('error'), 'Could not read match data.');
  }

  function isChecked(value: any, expected: string) {
    if (Array.isArray(value)) return value.indexOf(expected) !== -1;
    if (typeof value === 'string') return value.split(',').map(s => s.trim()).indexOf(expected) !== -1;
    return false;
  }

  const actionsRaw = form.docActions;
  const addToTop = isChecked(actionsRaw, 'addToTop') || isChecked(form.addToTopAction, 'addToTop');
  const replaceInPlace = isChecked(actionsRaw, 'replaceInPlace') || isChecked(form.replaceInPlaceAction, 'replaceInPlace');

  const doc = DocumentApp.getActiveDocument();
  if (!doc) return createMessageCard(t('error'), 'No active document.');
  const body = doc.getBody();

  function formatActionPoint(nameText: string, actionText: string, dateText: string | null) {
    const dateSuffix = dateText ? ` [${dateText}]` : '';
    return `AP ${nameText}: ${actionText}${dateSuffix}`;
  }

  // Helper to perform in-place replacements. Process by child index descending.
  function doReplace(matches: any[], isOpen: boolean) {
    // Group matches by childIndex
    const groups: Record<number, any[]> = {};
    matches.forEach(m => {
      if (!groups[m.location.childIndex]) groups[m.location.childIndex] = [];
      groups[m.location.childIndex].push(m);
    });

    const childIndices = Object.keys(groups).map(Number).sort((a, b) => b - a);
    childIndices.forEach(childIndex => {
      if (childIndex < 0 || childIndex >= body.getNumChildren()) return;
      const child = body.getChild(childIndex);
      const isListItem = child.getType() === DocumentApp.ElementType.LIST_ITEM;
      const listItem = isListItem ? child.asListItem() : null;
      const glyphType = listItem ? listItem.getGlyphType() : null;
      const nestingLevel = listItem ? listItem.getNestingLevel() : null;
      const textElement = (child as any).editAsText();
      // Sort matches within child by matchIndex desc
      const items = groups[childIndex].sort((a, b) => b.location.matchIndex - a.location.matchIndex);
      for (let i = 0; i < items.length; i++) {
        const m = items[i];
        let start = m.location.matchIndex;
        let end = start + m.location.matchLength - 1;
        // Validate indices, otherwise try to find originalText
        const fullText = (child as any).getText();
        if (start < 0 || end >= fullText.length || fullText.substr(start, m.location.matchLength) !== m.originalText) {
          const found = fullText.indexOf(m.originalText);
          if (found !== -1) {
            start = found;
            end = found + m.originalText.length - 1;
          } else {
            return; // can't locate
          }
        }

        // If multiple assignees, replace the entire paragraph with one line per assignee
        if (m.assignees.length > 1) {
          // Remove the original paragraph
          body.removeChild(child);
          // Insert new lines for each assignee, in reverse order to preserve order
          for (let j = m.assignees.length - 1; j >= 0; j--) {
            const apText = formatActionPoint(m.assignees[j], m.action, m.date);
            if (isListItem) {
              const newItem = body.insertListItem(childIndex, apText);
              if (glyphType) newItem.setGlyphType(glyphType);
              if (typeof nestingLevel === 'number') newItem.setNestingLevel(nestingLevel);
              if (isOpen) newItem.editAsText().setBold(true);
            } else {
              const para = body.insertParagraph(childIndex, apText);
              if (isOpen) para.editAsText().setBold(true);
            }
          }
          break;
        } else {
          // Single assignee: replace in-place as before
          const newSub = formatActionPoint(m.assignees[0], m.action, m.date);
          try {
            textElement.deleteText(start, end);
            textElement.insertText(start, newSub);
            // Make replacement bold to match top list formatting
            if (isOpen) {
              const fullAfter = textElement.getText();
              const endBold = Math.min(start + newSub.length - 1, fullAfter.length - 1);
              if (endBold >= start) {
                textElement.setBold(start, endBold, true);
              }
            }
          } catch (err) {
            // ignore individual failures
          }
        }
      }
    });
  }

  // First, perform replacements in-place (safer before inserting at top)
  if (replaceInPlace) {
    try {
      if (parsed.open && parsed.open.length > 0) doReplace(parsed.open, true);
      if (parsed.completed && parsed.completed.length > 0) doReplace(parsed.completed, false);
    } catch (err) {
      // Allow addToTop to proceed even if a replacement fails
    }
  }

  // Add formatted APs to the top under a header
  if (addToTop) {
    // Build list from open matches only (formatted and ordered)
    const openMatches = parsed.open || [];
    let expanded: any[] = [];
    const peopleConfig = getPeopleConfig();
    openMatches.forEach((m: any) => {
      m.assignees.forEach((a: any) => {
        expanded.push({
          person: a,
          action: m.action,
          date: m.date,
          order: getOrderForPerson(a, peopleConfig)
        });
      });
    });
    expanded.sort((x, y) => {
      const orderA = (typeof x.order === 'number') ? x.order : Number.MAX_SAFE_INTEGER;
      const orderB = (typeof y.order === 'number') ? y.order : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return x.person.localeCompare(y.person);
    });

    // Insert header and items at top as bold bullet list
    body.insertParagraph(0, t('actionPointsHeader')).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    for (let i = expanded.length - 1; i >= 0; i--) {
      const item = expanded[i];
      const text = formatActionPoint(item.person, item.action, item.date);
      const listItem = body.insertListItem(1, text);
      listItem.setGlyphType(DocumentApp.GlyphType.BULLET);
      listItem.editAsText().setBold(true);
    }
  }

  return createMessageCard(t('done'), t('docUpdatesApplied'));
}

export function populatePeopleConfig(e: any) {
  const params = e.parameters || {};
  const peopleJson = params.peopleJson || '[]';
  let people: any[];
  try {
    people = JSON.parse(peopleJson);
  } catch (err) {
    return createMessageCard(t('error'), t('peopleListError'));
  }

  if (!Array.isArray(people) || people.length === 0) {
    return createMessageCard(t('done'), t('noPeopleToAdd'));
  }

  const props = PropertiesService.getUserProperties();
  const current = getPeopleConfig();
  const aliasLookup = buildAliasLookup(current);
  let added = 0;

  people.forEach(name => {
    if (!name || typeof name !== 'string') return;
    if (name.toLowerCase() === 'everyone') return;
    if (aliasLookup[name.toLowerCase()]) return;
    if (!current[name]) {
      current[name] = { aliases: [] };
      added++;
    }
  });

  const validation = validatePeopleConfig(current);
  if (!validation.ok) {
    return createMessageCard(t('invalidSettings'), validation.message || '');
  }

  props.setProperty('PEOPLE_CONFIG', JSON.stringify(current, null, 2));
  const msg = added > 0 ? t('addedPeople', { count: added }) : t('noNewPeople');
  return createMessageCard(t('done'), msg);
}
