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
    inputType?: 'text' | 'file' | 'audio';
    staticInput?: string; // Text input
    fileData?: string; // Base64
    fileName?: string;
    fileMimeType?: string;
    audioData?: string; // Base64
    
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