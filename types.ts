
export enum NodeType {
  TRIGGER = 'TRIGGER',
  AGENT = 'AGENT',
  TOOL = 'TOOL',
  END = 'END'
}

export interface NodeSubtask {
  id: string;
  text: string;
  isCompleted: boolean;
  assignee?: string;
  dueDate?: string;
  convertedNodeId?: string;
  isBlocked?: boolean;
}

export interface MeetingArtifact {
  id: string;
  timestamp: number;
  title: string;
  duration: string;
  transcript: string;
  summary: string;
  decisions: string[];
  actionItems: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isAction?: boolean;
}

export interface NodeData {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  description?: string;
  config: {
    status?: Status;
    dueDate?: string;
    prompt?: string;
    systemInstruction?: string;
    model?: string;
    outputVar?: string;
    summary?: string;
    subtasks?: NodeSubtask[];
    contentUrls?: string[];
    meetings?: MeetingArtifact[];
    inputType?: 'text' | 'file' | 'audio' | 'structured';
    staticInput?: string;
    fileData?: string;
    fileName?: string;
    fileMimeType?: string;
    audioData?: string;
    structuredProductName?: string;
    structuredPersona?: string;
    structuredFeatures?: string;
    structuredConstraints?: string;
    structuredResources?: string;
    useSearch?: boolean;
    thinkingBudget?: number;
  };
}

export interface Edge {
  id: string;
  source: string;
  target: string;
}

export interface Project {
  id: string;
  name: string;
  nodes: NodeData[];
  edges: Edge[];
  logs: ExecutionLog[];
  roadmapData?: RoadmapData;
  updatedAt: number;
}

export interface WorkflowState {
  nodes: NodeData[];
  edges: Edge[];
  selectedNodeId: string | null;
  isRunning: boolean;
  executionLogs: ExecutionLog[];
}

export interface ExecutionLog {
  nodeId: string;
  nodeLabel: string;
  status: 'pending' | 'running' | 'success' | 'error';
  input?: any;
  output?: any;
  timestamp: number;
  groundingMetadata?: any;
}

export interface GeminiResponse {
  text: string;
  error?: string;
  groundingMetadata?: any;
}

export type PriorityLevel = 'must_have' | 'should_have' | 'could_have' | 'wont_have';
export type RiskLevel = 'low' | 'medium' | 'high';
export type Status = 'planned' | 'in_progress' | 'completed' | 'blocked' | 'at_risk';

export interface Workstream {
  id: string;
  name: string;
  purpose: string;
}

export interface Subtask {
  name: string;
  status: Status;
  assignee?: string;
  dueDate?: string;
  isBlocked?: boolean;
}

export interface RoadmapFeature {
  id: string;
  name: string;
  description?: string;
  priority: PriorityLevel;
  quarters: number[];
  dependencies?: string[];
  effort?: number;
  workstream: string;
  status: Status;
  subtasks?: Subtask[];
  risk: RiskLevel;
  riskReason?: string;
  risks?: string[];
  team: string;
  confidence: number;
  isCriticalPath?: boolean;
  predictionRationale?: string;
  pocEmail?: string;
}

export interface AIInsight {
  type: 'risk' | 'bottleneck' | 'resource' | 'suggestion';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface RoadmapData {
  workstreams: Workstream[];
  features: RoadmapFeature[];
  milestones: { name: string; quarter: number }[];
  summary: string;
  insights: AIInsight[];
}
