import { t } from '../core/Locale';

export function getPeopleConfig() {
  const props = PropertiesService.getUserProperties();
  const raw = props.getProperty('PEOPLE_CONFIG');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

export function buildAliasLookup(peopleConfig: Record<string, any>) {
  const lookup: Record<string, string> = {};
  Object.keys(peopleConfig || {}).forEach(personName => {
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

export function resolveAssignees(namePart: string, peopleConfig: Record<string, any>, aliasLookup: Record<string, string>) {
  const key = namePart.toLowerCase();
  const everyoneKey = t('everyoneKeyword');
  if (key === everyoneKey.toLowerCase()) {
    const people = Object.keys(peopleConfig || {});
    if (people.length > 0) return people;
  }
  const person = aliasLookup[key];
  return person ? [person] : [namePart];
}

export function getOrderForPerson(personName: string, peopleConfig: Record<string, any>) {
  const entry = peopleConfig[personName] || {};
  if (typeof entry.order === 'number') return entry.order;
  return null;
}

export function validatePeopleConfig(config: any) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    return { ok: false, message: 'People Config must be a JSON object.' };
  }

  const keys = Object.keys(config);
  for (let i = 0; i < keys.length; i++) {
    const personName = keys[i];
    const entry = config[personName];
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false, message: `Entry for "${personName}" must be an object.` };
    }

    if (entry.aliases !== undefined) {
      if (!Array.isArray(entry.aliases)) {
        return { ok: false, message: `Aliases for "${personName}" must be an array.` };
      }
      for (let j = 0; j < entry.aliases.length; j++) {
        if (typeof entry.aliases[j] !== 'string') {
          return { ok: false, message: `Aliases for "${personName}" must be strings.` };
        }
      }
    }

    if (entry.todoist_id !== undefined && typeof entry.todoist_id !== 'string') {
      return { ok: false, message: `todoist_id for "${personName}" must be a string.` };
    }

    if (entry.order !== undefined && typeof entry.order !== 'number') {
      return { ok: false, message: `order for "${personName}" must be a number.` };
    }
  }

  return { ok: true };
}
