import { ActionPointsScanResult } from './scanning';
import { parsePeopleConfig, validateActionPointsConfig } from './config';
import { loadToolSettings, saveToolSettings } from '../../core/settingsStore';
import { ACTION_POINTS_SETTINGS } from './settings';

export interface ActionPointsOperationResult {
  ok: boolean;
  message: string;
  successCount?: number;
  addedCount?: number;
}

function formatActionPoint(nameText: string, actionText: string, dateText: string | null) {
  const dateSuffix = dateText ? ` [${dateText}]` : '';
  return `AP ${nameText}: ${actionText}${dateSuffix}`;
}

export function sendToTodoistLogic(e: any) {
  const tasks = Array.isArray(e)
    ? e
    : JSON.parse((e && e.parameters && e.parameters.tasksJson) || '[]');
  const rawConfig = loadToolSettings('actionPointsExtractor', ACTION_POINTS_SETTINGS);
  const config = {
    todoistToken: String(rawConfig.todoistToken || ''),
    todoistProjectId: String(rawConfig.todoistProjectId || ''),
  };
  if (!config.todoistToken || !config.todoistProjectId) {
    return { ok: false, message: 'Please add your Todoist Token and Project ID in Settings.' };
  }

  let successCount = 0;
  const url = 'https://api.todoist.com/rest/v2/tasks';

  tasks.forEach((task: any) => {
    const content = `${task.person}: ${task.action}`;
    const payloadObj: any = { content, project_id: config.todoistProjectId };

    if (task.date) {
      const parts = task.date.split('-');
      if (parts.length === 3) {
        payloadObj.due_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: {
        Authorization: 'Bearer ' + config.todoistToken,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify(payloadObj),
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    if (code === 200 || code === 204 || code === 201) {
      successCount++;
    }
  });

  return { ok: true, message: `Pushed ${successCount} tasks to Todoist!`, successCount };
}

export function applyDocumentActionsLogic(e: any) {
  const params = e.parameters || {};
  const form = e.formInput || {};
  const matchesJson = params.matchesJson || '{}';
  let parsed: ActionPointsScanResult | any;

  try {
    parsed = JSON.parse(matchesJson);
  } catch {
    return { ok: false, message: 'Could not read match data.' };
  }

  function isChecked(value: any, expected: string) {
    if (Array.isArray(value)) return value.indexOf(expected) !== -1;
    if (typeof value === 'string')
      return (
        value
          .split(',')
          .map((s) => s.trim())
          .indexOf(expected) !== -1
      );
    return false;
  }

  const actionsRaw = form.docActions;
  const addToTop = isChecked(actionsRaw, 'addToTop') || isChecked(form.addToTopAction, 'addToTop');
  const replaceInPlace =
    isChecked(actionsRaw, 'replaceInPlace') ||
    isChecked(form.replaceInPlaceAction, 'replaceInPlace');

  const doc = DocumentApp.getActiveDocument();
  if (!doc) return { ok: false, message: 'No active document.' };
  const body = doc.getBody();

  function doReplace(matches: any[], isOpen: boolean) {
    const groups: Record<number, any[]> = {};
    matches.forEach((m) => {
      if (!groups[m.location.childIndex]) groups[m.location.childIndex] = [];
      groups[m.location.childIndex].push(m);
    });

    const childIndices = Object.keys(groups)
      .map(Number)
      .sort((a, b) => b - a);
    childIndices.forEach((childIndex) => {
      if (childIndex < 0 || childIndex >= body.getNumChildren()) return;
      const child = body.getChild(childIndex);
      const isListItem = child.getType() === DocumentApp.ElementType.LIST_ITEM;
      const listItem = isListItem ? child.asListItem() : null;
      const glyphType = listItem ? listItem.getGlyphType() : null;
      const nestingLevel = listItem ? listItem.getNestingLevel() : null;
      const textElement = (child as any).editAsText();
      const items = groups[childIndex].sort(
        (a, b) => b.location.matchIndex - a.location.matchIndex
      );

      for (let i = 0; i < items.length; i++) {
        const m = items[i];
        let start = m.location.matchIndex;
        let end = start + m.location.matchLength - 1;
        const fullText = (child as any).getText();
        if (
          start < 0 ||
          end >= fullText.length ||
          fullText.substr(start, m.location.matchLength) !== m.originalText
        ) {
          const found = fullText.indexOf(m.originalText);
          if (found !== -1) {
            start = found;
            end = found + m.originalText.length - 1;
          } else {
            return;
          }
        }

        if (m.assignees.length > 1) {
          body.removeChild(child);
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
          const newSub = formatActionPoint(m.assignees[0], m.action, m.date);
          try {
            textElement.deleteText(start, end);
            textElement.insertText(start, newSub);
            const fullAfter = textElement.getText();
            const endBold = Math.min(start + newSub.length - 1, fullAfter.length - 1);
            if (endBold >= start) {
              textElement.setBold(start, endBold, isOpen);
            }
          } catch {
            // ignore individual failures
          }
        }
      }
    });
  }

  if (replaceInPlace) {
    try {
      if (parsed.openMatches && parsed.openMatches.length > 0) doReplace(parsed.openMatches, true);
      if (parsed.completedMatches && parsed.completedMatches.length > 0)
        doReplace(parsed.completedMatches, false);
    } catch {
      // Allow addToTop to proceed even if a replacement fails
    }
  }

  if (addToTop) {
    const openMatches = parsed.openMatches || [];
    const expanded: any[] = [];
    const raw = loadToolSettings('actionPointsExtractor', ACTION_POINTS_SETTINGS, e);
    const current = { peopleConfig: parsePeopleConfig(String(raw.peopleConfig || '')) } as any;
    openMatches.forEach((m: any) => {
      m.assignees.forEach((a: any) => {
        const entry = current.peopleConfig[a] || {};
        expanded.push({
          person: a,
          action: m.action,
          date: m.date,
          order: typeof entry.order === 'number' ? entry.order : Number.MAX_SAFE_INTEGER,
        });
      });
    });

    expanded.sort((x, y) => {
      if (x.order !== y.order) return x.order - y.order;
      return x.person.localeCompare(y.person);
    });

    body.insertParagraph(0, 'Action points').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    let lastPerson: string | null = null;
    for (let i = expanded.length - 1; i >= 0; i--) {
      const item = expanded[i];
      if (lastPerson !== null && item.person !== lastPerson) {
        body.insertParagraph(1, '');
      }
      const text = formatActionPoint(item.person, item.action, item.date);
      const listItem = body.insertListItem(1, text);
      listItem.setGlyphType(DocumentApp.GlyphType.BULLET);
      lastPerson = item.person;
    }
  }

  return { ok: true, message: 'Document updates applied.' };
}

export function savePeopleConfigFromFormLogic(formInput: Record<string, any>) {
  const validation = validateActionPointsConfig(formInput);
  if (!validation.ok) return { ok: false, message: validation.message };

  const res = saveToolSettings('actionPointsExtractor', formInput, ACTION_POINTS_SETTINGS);
  if (!res.ok) return { ok: false, message: res.message };

  const raw = loadToolSettings('actionPointsExtractor', ACTION_POINTS_SETTINGS);
  return {
    ok: true,
    message: 'Saved',
    todoistToken: String(raw.todoistToken || ''),
    todoistProjectId: String(raw.todoistProjectId || ''),
    todoistEnabled: !!raw.enableTodoist,
    peopleConfig: parsePeopleConfig(String(raw.peopleConfig || '')),
  };
}

export function populatePeopleConfigLogic(e: any, targetLayer: string = 'global') {
  const params = e.parameters || {};
  const peopleJson = params.peopleJson || '[]';
  let people: any[];
  try {
    people = JSON.parse(peopleJson);
  } catch {
    return { ok: false, message: 'Could not read people list.' };
  }

  if (!Array.isArray(people) || people.length === 0) {
    return { ok: true, message: 'No people to add.', addedCount: 0 };
  }

  const rawCurrent = loadToolSettings('actionPointsExtractor', ACTION_POINTS_SETTINGS, e);
  const current = { peopleConfig: parsePeopleConfig(String(rawCurrent.peopleConfig || '')) };
  const nextPeopleConfig = { ...current.peopleConfig };
  let added = 0;

  people.forEach((name) => {
    if (!name || typeof name !== 'string') return;
    if (name.toLowerCase() === 'everyone') return;
    if (!nextPeopleConfig[name]) {
      nextPeopleConfig[name] = { aliases: [] };
      added++;
    }
  });

  const result = saveToolSettings(
    'actionPointsExtractor',
    {
      todoistToken: rawCurrent.todoistToken || '',
      todoistProjectId: rawCurrent.todoistProjectId || '',
      enableTodoist: rawCurrent.enableTodoist || false,
      peopleConfig: JSON.stringify(nextPeopleConfig),
    },
    ACTION_POINTS_SETTINGS,
    targetLayer,
    e
  );

  if (!result.ok) {
    return { ok: false, message: result.message || 'People Config is not valid JSON.' };
  }

  const msg =
    added > 0 ? `Added ${added} people to ${targetLayer} settings.` : 'No new people to add.';
  return { ok: true, message: msg, addedCount: added };
}
