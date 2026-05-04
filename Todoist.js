// Todoist-related logic extracted from Code.js

function formatDateForTodoist(ddmmyyyy) {
  if (!ddmmyyyy) return null;
  const parts = ddmmyyyy.split('-');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

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
    const content = `${task.person}: ${task.action}`;
    let payloadObj = { content: content, project_id: projectId };

    if (task.date) {
      const formatted = formatDateForTodoist(task.date);
      if (formatted) payloadObj.due_date = formatted;
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
    const code = response.getResponseCode();
    if (code === 200 || code === 204 || code === 201) {
      successCount++;
    }
  });
  
  return createMessageCard("Success", `Pushed ${successCount} tasks to Todoist!`);
}
