import { Tool } from '../core/Tool';
import { getActionPointsExtractorTool } from './action-points-extractor/tool';
import { getCommentsExtractorTool } from './comments-extractor/tool';
import { getCommitteeCreatorTool } from './committee-creator/tool';

const tools: Tool[] = [
  getActionPointsExtractorTool(),
  getCommentsExtractorTool(),
  getCommitteeCreatorTool(),
];

export function getTools(): Tool[] {
  return tools;
}
