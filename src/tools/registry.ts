import { Tool } from '../core/Tool';
import { getActionPointsExtractorTool } from './action-points-extractor/tool';
import { getCommentsExtractorTool } from './comments-extractor/tool';
import { getCommitteeCreatorTool } from './committee-creator/tool';
import { getCalendarSyncTool } from './calendar-sync/tool';
import { getPropertiesDebuggerTool } from './properties-debugger/tool';

const tools: Tool[] = [
  getActionPointsExtractorTool(),
  getCommentsExtractorTool(),
  getCommitteeCreatorTool(),
  getCalendarSyncTool(),
  getPropertiesDebuggerTool(),
];

export function getTools(): Tool[] {
  return tools;
}
