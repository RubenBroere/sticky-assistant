// Define your groups here. (This stays in the code as a central team config)
const GROUP_ALIASES = {
  "everyone": ["Alice", "Bob", "Charlie", "David"],
  "devs": ["Alice", "Bob"]
};

// 1. Homepage: Shows the main menu
function onHomepage(e) {
  let builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle("Action Point Scanner"));

  let section = CardService.newCardSection();

  let scanAction = CardService.newAction().setFunctionName('scanDocument');
  section.addWidget(CardService.newTextButton()
      .setText("Scan Document")
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(scanAction));

  let settingsAction = CardService.newAction().setFunctionName('buildSettingsCard');
  section.addWidget(CardService.newTextButton()
      .setText("⚙️ Settings")
      .setOnClickAction(settingsAction));

  builder.addSection(section);
  return builder.build();
}

// 2. Settings UI: Let users save their own Config
function buildSettingsCard(e) {
  let props = PropertiesService.getUserProperties();
  let token = props.getProperty('TODOIST_TOKEN') || '';
  let projectId = props.getProperty('TODOIST_PROJECT_ID') || '';
  let isEnabled = props.getProperty('TODOIST_ENABLED') === 'true';

  let builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle("User Settings"));

  let section = CardService.newCardSection();

  section.addWidget(CardService.newTextInput()
      .setFieldName("todoistToken")
      .setTitle("Todoist API Token")
      .setValue(token));

  section.addWidget(CardService.newTextInput()
      .setFieldName("todoistProjectId")
      .setTitle("Todoist Project ID")
      .setValue(projectId));

  section.addWidget(CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.CHECK_BOX)
      .setFieldName("enableTodoist")
      .addItem("Enable Sending to Todoist", "true", isEnabled));

  let saveAction = CardService.newAction().setFunctionName('saveSettings');
  section.addWidget(CardService.newTextButton()
      .setText("Save Settings")
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setOnClickAction(saveAction));

  let backAction = CardService.newAction().setFunctionName('onHomepage');
  section.addWidget(CardService.newTextButton()
      .setText("Back to Menu")
      .setOnClickAction(backAction));

  builder.addSection(section);
  return builder.build();
}

// 3. Save Settings Handler
function saveSettings(e) {
  let formInputs = e.formInput;
  let props = PropertiesService.getUserProperties();
  
  props.setProperty('TODOIST_TOKEN', formInputs.todoistToken || '');
  props.setProperty('TODOIST_PROJECT_ID', formInputs.todoistProjectId || '');
  
  // If the checkbox is unchecked, it won't appear in formInputs
  let isEnabled = formInputs.enableTodoist ? 'true' : 'false';
  props.setProperty('TODOIST_ENABLED', isEnabled);

  return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Settings saved!"))
      .setNavigation(CardService.newNavigation().popToRoot().updateCard(onHomepage(e)))
      .build();
}

// 4. Scan Document Logic (Now separates Open and Completed)
function scanDocument(e) {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) return createMessageCard("Error", "Could not read the document.");
  
  const body = doc.getBody();
  const numChildren = body.getNumChildren();
  
  let openTasks = [];
  let completedTasks = [];
  const dateRegex = /\[(\d{2}-\d{2}-\d{4})\]/;

  // Loop through every paragraph and bullet point in the doc
  for (let i = 0; i < numChildren; i++) {
    const child = body.getChild(i);
    const type = child.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH || type === DocumentApp.ElementType.LIST_ITEM) {
      const text = child.getText();
      let match;
      
      const regex = /\bAP\s+([^:]+):\s+(.+)/gi; 

      while ((match = regex.exec(text)) !== null) {
        const textElement = child.editAsText();
        
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

        // D. Assign to users/aliases
        const lowerKey = namePart.toLowerCase();
        const assignees = GROUP_ALIASES[lowerKey] ? GROUP_ALIASES[lowerKey] : [namePart];

        assignees.forEach(assignee => {
          let taskObj = { person: assignee, action: actionPart, date: taskDate };
          // Sort into the correct bucket based on formatting
          if (isBold) {
            openTasks.push(taskObj);
          } else {
            completedTasks.push(taskObj);
          }
        });
      }
    }
  }

  if (openTasks.length === 0 && completedTasks.length === 0) {
    return createMessageCard("No Tasks Found", "Ensure you are using the format: AP Name: Task");
  }

  // E. Sort the arrays alphabetically
  openTasks.sort((a, b) => a.person.localeCompare(b.person));
  completedTasks.sort((a, b) => a.person.localeCompare(b.person));

  // F. Build the UI Card
  let builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle(`Scan Results`));

  // --- SECTION: OPEN TASKS ---
  let openSection = CardService.newCardSection()
      .setHeader(`Open Action Points (${openTasks.length})`);
  
  if (openTasks.length === 0) {
    openSection.addWidget(CardService.newTextParagraph().setText("<i>All caught up! No open tasks.</i>"));
  } else {
    openTasks.forEach(task => {
      let dateText = task.date ? ` <font color="#888888"><i>[Due: ${task.date}]</i></font>` : '';
      openSection.addWidget(CardService.newTextParagraph().setText(`<b>${task.person}</b>: ${task.action}${dateText}`));
    });
  }
  builder.addSection(openSection);

  // --- SECTION: COMPLETED TASKS ---
  let completedSection = CardService.newCardSection()
      .setHeader(`Completed Action Points (${completedTasks.length})`)
      .setCollapsible(true)
      .setNumUncollapsibleWidgets(0); // 0 means everything hides under a "Show More" toggle
  
  if (completedTasks.length === 0) {
    completedSection.addWidget(CardService.newTextParagraph().setText("<i>No completed tasks yet.</i>"));
  } else {
    completedTasks.forEach(task => {
      let dateText = task.date ? ` <i>[Due: ${task.date}]</i>` : '';
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
        // We now only pass the OPEN tasks to Todoist
        .setParameters({ tasksJson: JSON.stringify(openTasks) }); 
        
    actionSection.addWidget(CardService.newTextButton()
        .setText("Send Open APs to Todoist")
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(sendAction));
  } else if (isTodoistEnabled && openTasks.length === 0) {
    actionSection.addWidget(CardService.newTextParagraph().setText("<i>No open tasks to sync.</i>"));
  } else {
    actionSection.addWidget(CardService.newTextParagraph().setText("<i>Todoist sync is disabled in your settings.</i>"));
  }

  let backAction = CardService.newAction().setFunctionName('onHomepage');
  actionSection.addWidget(CardService.newTextButton().setText("Back").setOnClickAction(backAction));

  builder.addSection(actionSection);
  return builder.build();
}

// 5. Pushes the tasks to Todoist
function sendToTodoist(e) {
  const tasks = JSON.parse(e.parameters.tasksJson);
  let props = PropertiesService.getUserProperties();
  const token = props.getProperty('TODOIST_TOKEN');
  const projectId = props.getProperty('TODOIST_PROJECT_ID');
  
  if (!token || !projectId) {
    return createMessageCard("Missing Config", "Please add your Todoist Token and Project ID in Settings.");
  }

  let successCount = 0;
  const url = 'https://api.todoist.com/rest/v2/tasks';
  
  tasks.forEach(task => {
    const content = `**${task.person}**: ${task.action}`;
    let payloadObj = { content: content, project_id: projectId };

    // Convert DD-MM-YYYY to Todoist's required YYYY-MM-DD format
    if (task.date) {
      const parts = task.date.split('-');
      if (parts.length === 3) {
        payloadObj.due_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payloadObj),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200 || response.getResponseCode() === 204) {
      successCount++;
    }
  });
  
  return createMessageCard("Success", `Pushed ${successCount} tasks to Todoist!`);
}

// Helper: Simple message screens
function createMessageCard(title, message) {
  let builder = CardService.newCardBuilder();
  builder.setHeader(CardService.newCardHeader().setTitle(title));
  let section = CardService.newCardSection();
  section.addWidget(CardService.newTextParagraph().setText(message));
  
  let backAction = CardService.newAction().setFunctionName('onHomepage');
  section.addWidget(CardService.newTextButton().setText("Back to Menu").setOnClickAction(backAction));
  
  builder.addSection(section);
  return builder.build();
}