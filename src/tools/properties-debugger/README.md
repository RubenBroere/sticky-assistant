# Properties Debugger

An advanced utility to inspect, add, edit, and delete raw User Properties stored in the Google Apps Script `PropertiesService.getUserProperties()` database.

## Architecture & Code Structure

- [tool.ts](./tool.ts): Registers the debugger under `propertiesDebugger` for homepage selector triggers.
- [cards.ts](./cards.ts): Houses the entire debugger interface, warning prompts, edit/create overlay forms, delete confirmations, and mutated database actions.

## Core Mechanisms

### 1. Safety Alerts & Risk Banners

Because modifying raw user properties bypasses validation schemas, the debugger renders a permanent warning alert on all pages:

> **Warning: Dangerous Operations**
> Modifying or deleting raw properties can corrupt your configurations, break background execution triggers, or delete enqueued settings. Do not modify values unless you know exactly what you are doing.

### 2. Value Safeguards (Preventing Runtime Crashes)

In Google Apps Script, calling `TextInput.setValue(value)` throws a fatal runtime exception if the argument is not a string (i.e., if it evaluates to `null` or `undefined`).
To safeguard against this, the edit form applies string fallback coercion:

```typescript
const existingVal = isNew ? '' : PropertiesService.getUserProperties().getProperty(key) || '';
// existingVal is guaranteed to be a string
```

### 3. Pop-To-Root Card Transitions

When a save or delete action is completed successfully:

1. The callback performs the database update (`setProperty` or `deleteProperty`).
2. It constructs a fresh debugger homepage card.
3. It returns an `ActionResponse` that cleans the card stack:
   ```typescript
   return CardService.newActionResponseBuilder()
     .setNavigation(CardService.newNavigation().popToRoot().updateCard(debuggerCard))
     .setNotification(CardService.newNotification().setText('Saved successfully.'))
     .build();
   ```
   This clears any intermediate forms from the Google Workspace sidebar layout, taking the user back to the primary properties list.
