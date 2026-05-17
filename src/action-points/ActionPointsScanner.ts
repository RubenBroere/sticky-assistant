import { getLanguage, t } from '../core/Locale';
import { createMessageCard } from '../core/Ui';
import { getPeopleConfig, buildAliasLookup, resolveAssignees, getOrderForPerson } from './ActionPointsConfig';

// 4. Scan Document Logic (Now separates Open and Completed)
export function scanDocument(e: any) {
  const lang = getLanguage();
  const doc = DocumentApp.getActiveDocument();
  if (!doc) return createMessageCard(t(lang, 'error'), t(lang, 'noDoc'));

  const body = doc.getBody();
  const numChildren = body.getNumChildren();

  let openTasks: any[] = [];
  let completedTasks: any[] = [];
  let openMatches: any[] = [];
  let completedMatches: any[] = [];
  let foundPeople: Record<string, boolean> = {};
  const peopleConfig = getPeopleConfig();
  const aliasLookup = buildAliasLookup(peopleConfig);
  const dateRegex = /\[(\d{2}-\d{2}-\d{4})\]/;

  // Loop through every paragraph and bullet point in the doc
  for (let i = 0; i < numChildren; i++) {
    const child = body.getChild(i);
    const type = child.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH || type === DocumentApp.ElementType.LIST_ITEM) {
      const text = (child as any).getText();
      let match;

      const regex = /\bAP\s+([^:]+):\s+(.+)/gi;

      while ((match = regex.exec(text)) !== null) {
        const textElement = (child as any).editAsText();

        // Check if both the "A" and the "P" are explicitly bolded
        const isBold = textElement.isBold(match.index) && textElement.isBold(match.index + 1);

        let namePart = match[1].trim();
        let actionPart = match[2].trim();
        let taskDate = null;

        // A. Check for date in the Name part
        let dateMatch = namePart.match(dateRegex);
        if (dateMatch) {
          taskDate = dateMatch[1];
          namePart = namePart.replace(dateRegex, '').trim();
        } else {
          // B. Check for date in the Action part
          dateMatch = actionPart.match(dateRegex);
          if (dateMatch) {
            taskDate = dateMatch[1];
            actionPart = actionPart.replace(dateRegex, '').trim();
          }
        }

        // C. Capitalize the first letter of the action
        if (actionPart.length > 0) {
          actionPart = actionPart.charAt(0).toUpperCase() + actionPart.slice(1);
        }

        // D. Assign to people via config (supports aliases)
        const assignees = resolveAssignees(namePart, peopleConfig, aliasLookup, lang);

        const matchObj = {
          originalName: namePart,
          assignees: assignees,
          action: actionPart,
          date: taskDate,
          isBold: isBold,
          location: { childIndex: i, matchIndex: match.index, matchLength: match[0].length },
          originalText: match[0]
        };

        // Expand into per-person tasks for UI and Todoist
        assignees.forEach(assignee => {
          foundPeople[assignee] = true;
          let taskObj = {
            person: assignee,
            action: actionPart,
            date: taskDate,
            order: getOrderForPerson(assignee, peopleConfig)
          };
          if (isBold) openTasks.push(taskObj); else completedTasks.push(taskObj);
        });

        // Keep the occurrence-level object for document actions
        if (isBold) {
          openMatches.push(matchObj);
        } else {
          completedMatches.push(matchObj);
        }
      }
    }
  }

  if ((openTasks.length === 0 && completedTasks.length === 0) || (openMatches.length === 0 && completedMatches.length === 0)) {
    return createMessageCard(t(lang, 'noTasksTitle'), t(lang, 'noTasksHint'));
  }

  // E. Sort the arrays alphabetically
  function sortByOrderThenName(a: any, b: any) {
    const orderA = (typeof a.order === 'number') ? a.order : Number.MAX_SAFE_INTEGER;
    const orderB = (typeof b.order === 'number') ? b.order : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.person.localeCompare(b.person);
  }

  openTasks.sort(sortByOrderThenName);
  completedTasks.sort(sortByOrderThenName);

  // F. Build the UI Card
  let builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle(t(lang, 'scanResults')));

  // --- SECTION: OPEN TASKS ---
  let openSection = CardService.newCardSection()
      .setHeader(t(lang, 'openAP', { count: openTasks.length }));

  if (openTasks.length === 0) {
    openSection.addWidget(CardService.newTextParagraph().setText(`<i>${t(lang, 'noOpen')}</i>`));
  } else {
    openTasks.forEach(task => {
      let dateText = task.date ? ` <font color="#888888"><i>[${t(lang, 'due')}: ${task.date}]</i></font>` : '';
      openSection.addWidget(CardService.newTextParagraph().setText(`<b>${task.person}</b>: ${task.action}${dateText}`));
    });
  }
  builder.addSection(openSection);

  // --- SECTION: COMPLETED TASKS ---
  let completedSection = CardService.newCardSection()
      .setHeader(t(lang, 'completedAP', { count: completedTasks.length }))
      .setCollapsible(true)
      .setNumUncollapsibleWidgets(0); // 0 means everything hides under a "Show More" toggle

  if (completedTasks.length === 0) {
    completedSection.addWidget(CardService.newTextParagraph().setText(`<i>${t(lang, 'noCompleted')}</i>`));
  } else {
    completedTasks.forEach(task => {
      let dateText = task.date ? ` <i>[${t(lang, 'due')}: ${task.date}]</i>` : '';
      // Use strikethrough <s> and grey coloring for completed tasks
      completedSection.addWidget(CardService.newTextParagraph().setText(`<font color="#999999"><s><b>${task.person}</b>: ${task.action}</s>${dateText}</font>`));
    });
  }
  builder.addSection(completedSection);

  // --- SECTION: ACTION BUTTONS ---
  let actionSection = CardService.newCardSection();
  let props = PropertiesService.getUserProperties();
  let isTodoistEnabled = props.getProperty('TODOIST_ENABLED') === 'true';

  if (isTodoistEnabled && openTasks.length > 0) {
    let sendAction = CardService.newAction()
      .setFunctionName('sendToTodoist')
      // pass the expanded OPEN tasks to Todoist
      .setParameters({ tasksJson: JSON.stringify(openTasks) });

    actionSection.addWidget(CardService.newTextButton()
      .setText(t(lang, 'sendOpenToTodoist'))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(sendAction));
  }

  if (isTodoistEnabled && openTasks.length === 0) {
    actionSection.addWidget(CardService.newTextParagraph().setText(`<i>${t(lang, 'noOpenToSync')}</i>`));
  }

  // Document actions: add formatted APs to top and/or replace aliases in-place
  if (openMatches.length > 0 || completedMatches.length > 0) {
    // Use separate checkbox inputs to ensure both options can be selected reliably
    let addToTopInput = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.CHECK_BOX)
      .setFieldName('addToTopAction')
      .addItem(t(lang, 'addToTop'), 'addToTop', false);

    let replaceInPlaceInput = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.CHECK_BOX)
      .setFieldName('replaceInPlaceAction')
      .addItem(t(lang, 'replaceInPlace'), 'replaceInPlace', false);

    actionSection.addWidget(addToTopInput);
    actionSection.addWidget(replaceInPlaceInput);

    const matchesToPass = JSON.stringify({ open: openMatches, completed: completedMatches });
    let applyAction = CardService.newAction()
      .setFunctionName('applyDocumentActions')
      .setParameters({ matchesJson: matchesToPass });

    actionSection.addWidget(CardService.newTextButton()
      .setText(t(lang, 'applyDocChanges'))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED) .setOnClickAction(applyAction));
  }

  const foundPeopleList = Object.keys(foundPeople).filter(name => name.toLowerCase() !== 'everyone');
  if (foundPeopleList.length > 0) {
    const populateAction = CardService.newAction()
      .setFunctionName('populatePeopleConfig')
      .setParameters({ peopleJson: JSON.stringify(foundPeopleList) });

    actionSection.addWidget(CardService.newTextButton()
      .setText(t(lang, 'addPeopleToSettings'))
      .setOnClickAction(populateAction));
  }

  if (!isTodoistEnabled) {
    actionSection.addWidget(CardService.newTextParagraph().setText(`<i>${t(lang, 'todoistDisabled')}</i>`));
  }

  let backAction = CardService.newAction().setFunctionName('onActionPointsHomepage');
  actionSection.addWidget(CardService.newTextButton().setText(t(lang, 'back')).setOnClickAction(backAction));

  builder.addSection(actionSection);
  return builder.build();
}
