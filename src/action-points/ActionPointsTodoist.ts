import { createMessageCard } from '../core/Ui';

export function formatDateForTodoist(ddmmyyyy: string) {
  if (!ddmmyyyy) return null;
  const parts = ddmmyyyy.split('-');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

export function sendToTodoist(e: any) {
  const tasks = JSON.parse(e.parameters.tasksJson);
  let props = PropertiesService.getUserProperties();
  const token = props.getProperty('TODOIST_TOKEN');
  const projectId = props.getProperty('TODOIST_PROJECT_ID');
  
  if (!token || !projectId) {
    return createMessageCard("Missing Config", "Please add your Todoist Token and Project ID in Settings.");
  }

  let successCount = 0;
  const url = 'https://api.todoist.com/rest/v2/tasks';
  
  tasks.forEach((task: any) => {
    const content = `${task.person}: ${task.action}`;
    let payloadObj: any = { content: content, project_id: projectId };

    if (task.date) {
      const formatted = formatDateForTodoist(task.date);
      if (formatted) payloadObj.due_date = formatted;
    }

    const options = {
      method: 'post' as GoogleAppsScript.URL_Fetch.HttpMethod,
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
