import { PeopleConfigEntry, parsePeopleConfig } from './config';
import { loadToolSettings } from '../../core/settingsStore';
import { ACTION_POINTS_SETTINGS } from './settings';

export interface ActionPointOccurrence {
  originalName: string;
  assignees: string[];
  action: string;
  date: string | null;
  isBold: boolean;
  location: {
    childIndex: number;
    matchIndex: number;
    matchLength: number;
  };
  originalText: string;
}

export interface ActionPointTask {
  person: string;
  action: string;
  date: string | null;
  order: number | null;
}

export interface ActionPointsScanResult {
  openTasks: ActionPointTask[];
  completedTasks: ActionPointTask[];
  openMatches: ActionPointOccurrence[];
  completedMatches: ActionPointOccurrence[];
  foundPeople: Record<string, boolean>;
}

function buildAliasLookup(peopleConfig: Record<string, PeopleConfigEntry>) {
  const lookup: Record<string, string> = {};
  Object.keys(peopleConfig || {}).forEach((personName) => {
    const entry = peopleConfig[personName] || {};
    lookup[personName.toLowerCase()] = personName;
    const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
    aliases.forEach((alias: string) => {
      if (alias && typeof alias === 'string') {
        lookup[alias.toLowerCase()] = personName;
      }
    });
  });
  return lookup;
}

function resolveAssignees(
  namePart: string,
  peopleConfig: Record<string, PeopleConfigEntry>,
  aliasLookup: Record<string, string>
) {
  const key = namePart.toLowerCase();
  if (key === 'everyone') {
    const people = Object.keys(peopleConfig || {});
    if (people.length > 0) return people;
  }
  const person = aliasLookup[key];
  return person ? [person] : [namePart];
}

function getOrderForPerson(personName: string, peopleConfig: Record<string, PeopleConfigEntry>) {
  const entry = peopleConfig[personName] || {};
  return typeof entry.order === 'number' ? entry.order : null;
}

export function scanActionPointsDocument(): ActionPointsScanResult | null {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) return null;

  const body = doc.getBody();
  const numChildren = body.getNumChildren();
  const raw = loadToolSettings('actionPointsExtractor', ACTION_POINTS_SETTINGS);
  const peopleConfig = parsePeopleConfig(String(raw.peopleConfig || ''));
  const aliasLookup = buildAliasLookup(peopleConfig);
  const dateRegex = /\[(\d{2}-\d{2}-\d{4})\]/;

  const openTasks: ActionPointTask[] = [];
  const completedTasks: ActionPointTask[] = [];
  const openMatches: ActionPointOccurrence[] = [];
  const completedMatches: ActionPointOccurrence[] = [];
  const foundPeople: Record<string, boolean> = {};

  for (let i = 0; i < numChildren; i++) {
    const child = body.getChild(i);
    const type = child.getType();

    if (type !== DocumentApp.ElementType.PARAGRAPH && type !== DocumentApp.ElementType.LIST_ITEM) {
      continue;
    }

    const text = (child as any).getText();
    const regex = /\bAP\s+([^:]+):\s+(.+)/gi;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const textElement = (child as any).editAsText();
      const isBold = textElement.isBold(match.index) && textElement.isBold(match.index + 1);

      let namePart = match[1].trim();
      let actionPart = match[2].trim();
      let taskDate: string | null = null;

      let dateMatch = namePart.match(dateRegex);
      if (dateMatch) {
        taskDate = dateMatch[1];
        namePart = namePart.replace(dateRegex, '').trim();
      } else {
        dateMatch = actionPart.match(dateRegex);
        if (dateMatch) {
          taskDate = dateMatch[1];
          actionPart = actionPart.replace(dateRegex, '').trim();
        }
      }

      if (actionPart.length > 0) {
        actionPart = actionPart.charAt(0).toUpperCase() + actionPart.slice(1);
      }

      const assignees = resolveAssignees(namePart, peopleConfig, aliasLookup);

      const matchObj: ActionPointOccurrence = {
        originalName: namePart,
        assignees,
        action: actionPart,
        date: taskDate,
        isBold,
        location: {
          childIndex: i,
          matchIndex: match.index,
          matchLength: match[0].length,
        },
        originalText: match[0],
      };

      assignees.forEach((assignee) => {
        foundPeople[assignee] = true;
        const task: ActionPointTask = {
          person: assignee,
          action: actionPart,
          date: taskDate,
          order: getOrderForPerson(assignee, peopleConfig),
        };
        if (isBold) {
          openTasks.push(task);
        } else {
          completedTasks.push(task);
        }
      });

      if (isBold) {
        openMatches.push(matchObj);
      } else {
        completedMatches.push(matchObj);
      }
    }
  }

  return {
    openTasks,
    completedTasks,
    openMatches,
    completedMatches,
    foundPeople,
  };
}
