export enum NodeType {
  TRIGGER = 'TRIGGER',
  AGENT = 'AGENT',
  TOOL = 'TOOL',
  END = 'END'
}

export interface NodeData {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  description?: string;
  // Configuration specific to execution
  config: {
    prompt?: string; // For Agent
    systemInstruction?: string; // For Agent
    model?: string; // For Agent
    outputVar?: string; // Variable name to store output
    
    // Trigger Input Config
    inputType?: 'text' | 'file' | 'audio' | 'structured';
    staticInput?: string; // Text input
    fileData?: string; // Base64
    fileName?: string;
    fileMimeType?: string;
    audioData?: string; // Base64
    
    // Structured Input Config
    structuredProductName?: string;
    structuredPersona?: string;
    structuredFeatures?: string;
    structuredConstraints?: string;
    structuredResources?: string;
    
    useSearch?: boolean; // For Agent
  };
}

export interface Edge {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
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

// --- Roadmap Visualization Types ---

export type PriorityLevel = 'must_have' | 'should_have' | 'could_have' | 'wont_have';
export type RiskLevel = 'low' | 'medium' | 'high';
export type Status = 'planned' | 'in_progress' | 'completed' | 'blocked' | 'at_risk';

export interface Workstream {
  id: string;
  name: string;
  purpose: string; // Single sentence narrative
}

export interface Subtask {
  name: string;
  status: Status;
}

export interface RoadmapFeature {
  id: string;
  name: string;
  description?: string;
  priority: PriorityLevel;
  quarters: number[]; // [1, 2] means Q1 and Q2
  dependencies?: string[]; // Names of features this depends on
  effort?: number;
  workstream: string; // Name of the workstream
  
  // Intelligent Fields
  status: Status;
  subtasks?: Subtask[]; // Broken down tasks
  risk: RiskLevel;
  riskReason?: string;
  team: string; // e.g., "Backend", "Frontend", "Design"
  confidence: number; // 0-100
  isCriticalPath?: boolean;
  predictionRationale?: string; // Reasoning based on historical/simulated data
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