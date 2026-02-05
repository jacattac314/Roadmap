import React, { useState } from 'react';
import { NodeData, Edge, NodeType, ExecutionLog } from './types';
import { INITIAL_NODES, INITIAL_EDGES } from './constants';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ExecutionModal } from './components/ExecutionModal';
import { generateAgentResponse } from './services/geminiService';
import { Play, Share2, Layout, Download } from 'lucide-react';

// Helper type for context values that can be text or complex media objects
interface ContextValue {
  text?: string;
  parts?: any[];
  data?: any; // Parsed JSON data
}

export default function App() {
  // State
  const [nodes, setNodes] = useState<NodeData[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Execution State
  const [isExecutionOpen, setIsExecutionOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  const handleNodeUpdate = (updatedNode: NodeData) => {
    setNodes(nodes.map(n => n.id === updatedNode.id ? updatedNode : n));
  };

  // Helper to safely access nested properties using dot notation
  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((prev, curr) => {
      return prev ? prev[curr] : undefined;
    }, obj);
  };

  // Resolves variable strings like "{{var}}" or "{{obj.prop}}" using the context
  const interpolateVariablesText = (text: string, context: Record<string, ContextValue>) => {
    const today = new Date().toLocaleDateString();
    
    return text.replace(/{{([^}]+)}}/g, (_, key) => {
      const trimmedKey = key.trim();
      
      if (trimmedKey === 'today') return today;

      // Handle dot notation (e.g. extractedData.product_name)
      if (trimmedKey.includes('.')) {
        const [rootVar, ...path] = trimmedKey.split('.');
        const contextVal = context[rootVar];
        if (contextVal?.data) {
          const val = getNestedValue(contextVal.data, path.join('.'));
          if (val !== undefined) {
             if (typeof val === 'object') return JSON.stringify(val);
             return String(val);
          }
        }
      }

      const val = context[trimmedKey];
      // If the variable points to a JSON object (from a previous node), stringify it for the prompt
      if (val?.data) return JSON.stringify(val.data);
      return val?.text || `[Missing: ${trimmedKey}]`;
    });
  };

  // Constructs the API parts array by mixing text prompt with any referenced media variables
  const constructApiParts = (promptTemplate: string, context: Record<string, ContextValue>) => {
    const parts: any[] = [];
    
    // Check if the prompt references a variable that has media parts
    const interpolatedText = interpolateVariablesText(promptTemplate, context);
    
    // Scan for media variables to attach (simple implementation: if var is referenced and has parts, add them)
    // Note: The text is already interpolated, so we just check context for file attachments
    // that might have been referenced or imply attachment.
    // For this simple implementation, if a node inputs a file, we usually want it in context.
    // But since we use text interpolation, we only look for file parts if explicitly needed or 
    // if the prompt is simple.
    // Enhanced: Check if top-level keys used in prompt have parts.
    
    // However, simplest way for Gemini is to append media parts if they exist in the variables referenced.
    // We'll stick to text-first for this optimization unless we detect specific file inputs.
    // Since we simplified variables to text/data, we just send the text prompt.
    // If we need media, we'd need to check if 'userInput' was referenced and had parts.
    
    Object.keys(context).forEach(key => {
        if (promptTemplate.includes(`{{${key}}}`) && context[key].parts) {
            parts.push(...context[key].parts!);
        }
    });

    parts.push({ text: interpolatedText });
    
    return parts;
  };

  const runWorkflow = async () => {
    setIsExecutionOpen(true);
    setIsRunning(true);
    setLogs([]);

    // 1. Topological Sort for correct execution order
    const adjacencyList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    nodes.forEach(node => {
        adjacencyList.set(node.id, []);
        inDegree.set(node.id, 0);
    });

    edges.forEach(edge => {
        adjacencyList.get(edge.source)?.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });

    const queue: string[] = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
    const executionOrder: NodeData[] = [];

    while (queue.length > 0) {
        const nodeId = queue.shift()!;
        const node = nodes.find(n => n.id === nodeId);
        if (node) executionOrder.push(node);

        const neighbors = adjacencyList.get(nodeId) || [];
        neighbors.forEach(neighborId => {
            inDegree.set(neighborId, (inDegree.get(neighborId) || 0) - 1);
            if (inDegree.get(neighborId) === 0) {
                queue.push(neighborId);
            }
        });
    }

    if (executionOrder.length === 0 && nodes.length > 0) {
       executionOrder.push(...nodes);
    }

    // Context to store variables (outputs from nodes)
    const context: Record<string, ContextValue> = {};

    for (const node of executionOrder) {
      const logEntry: ExecutionLog = {
        nodeId: node.id,
        nodeLabel: node.label,
        status: 'running',
        timestamp: Date.now()
      };

      setLogs(prev => [...prev, logEntry]);

      try {
        if (node.type === NodeType.TRIGGER) {
          const outputVar = node.config.outputVar || 'userInput';
          
          if (node.config.inputType === 'structured') {
              const { 
                  structuredProductName, 
                  structuredPersona, 
                  structuredFeatures, 
                  structuredConstraints, 
                  structuredResources 
              } = node.config;

              const textBlock = `
PRODUCT NAME: ${structuredProductName || 'Untitled'}
TARGET PERSONA: ${structuredPersona || 'General Audience'}

KEY FEATURES:
${structuredFeatures || 'None specified'}

CONSTRAINTS & TIMELINE:
${structuredConstraints || 'None specified'}

RESOURCES:
${structuredResources || 'None specified'}
              `.trim();

              context[outputVar] = { text: textBlock };
              logEntry.output = textBlock;
              logEntry.input = { structured: node.config }; // Log structured data as input
          }
          else if (node.config.inputType === 'file' && node.config.fileData) {
             context[outputVar] = {
               text: `[File: ${node.config.fileName}]`,
               parts: [{
                 inlineData: {
                   mimeType: node.config.fileMimeType || 'application/pdf',
                   data: node.config.fileData
                 }
               }]
             };
             logEntry.output = `File loaded: ${node.config.fileName}`;
          } 
          else if (node.config.inputType === 'audio' && node.config.audioData) {
             context[outputVar] = {
               text: `[Audio Recording]`,
               parts: [{
                 inlineData: {
                   mimeType: 'audio/webm',
                   data: node.config.audioData
                 }
               }]
             };
             logEntry.output = "Audio recording loaded.";
          } 
          else {
            // Default Text
            const val = node.config.staticInput || "No input provided";
            context[outputVar] = { text: val };
            logEntry.output = val;
          }
          
          logEntry.status = 'success';
        } 
        else if (node.type === NodeType.AGENT) {
          // Prepare prompt and parts
          const promptTemplate = node.config.prompt || '';
          const apiParts = constructApiParts(promptTemplate, context);
          
          // Visual log shows interpolated text
          logEntry.input = interpolateVariablesText(promptTemplate, context);
          
          // Call Gemini
          const result = await generateAgentResponse({
            modelName: node.config.model || 'gemini-3-flash-preview',
            contents: apiParts,
            systemInstruction: node.config.systemInstruction,
            useSearch: node.config.useSearch
          });

          if (result.error) {
            throw new Error(result.error);
          }

          const outVar = node.config.outputVar || 'agentOutput';
          
          // Attempt to parse JSON to support structured variable access (e.g. {{extractedData.vision}})
          let parsedData = null;
          try {
             const cleanText = result.text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
             // Find first { and last } to handle preamble text if any (though prompt says ONLY JSON)
             const firstBrace = cleanText.indexOf('{');
             const lastBrace = cleanText.lastIndexOf('}');
             if (firstBrace !== -1 && lastBrace !== -1) {
                parsedData = JSON.parse(cleanText.substring(firstBrace, lastBrace + 1));
             }
          } catch (e) {
             // Ignore parsing error, treat as text
          }

          context[outVar] = { 
              text: result.text,
              data: parsedData 
          };
          
          logEntry.output = result.text; // Store raw text for logs
          if (parsedData) {
             // We can also store the parsed object in the log for better visualization later if needed
             logEntry.output = parsedData;
          }
          
          logEntry.status = 'success';
          if (result.groundingMetadata) {
             logEntry.groundingMetadata = result.groundingMetadata;
          }
        }
        else if (node.type === NodeType.END) {
          // Find the last agent output for a cleaner display
          const keys = Object.keys(context);
          const lastKey = keys[keys.length - 1];
          const lastVal = context[lastKey];
          
          logEntry.input = "Aggregating results...";
          logEntry.output = lastVal?.text || lastVal?.data || "Workflow Completed";
          logEntry.status = 'success';
        }

        // Update the log in state
        setLogs(prev => prev.map(l => l.nodeId === node.id ? logEntry : l));
        
        // Pacing
        await new Promise(r => setTimeout(r, 600));

      } catch (err: any) {
        logEntry.status = 'error';
        logEntry.output = err.message;
        setLogs(prev => prev.map(l => l.nodeId === node.id ? logEntry : l));
        setIsRunning(false);
        return; // Stop execution
      }
    }

    setIsRunning(false);
  };

  const exportLogs = () => {
    const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
      JSON.stringify(logs, null, 2)
    )}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "roadmap_execution.json";
    link.click();
  };

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900">
      {/* Top Navigation */}
      <header className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white z-30 relative">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-indigo-200 shadow-lg">
            P
          </div>
          <div>
            <h1 className="font-bold text-gray-900 leading-none">Product Roadmap Generator</h1>
            <span className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">Gemini Powered</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-4 py-1.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600 flex items-center gap-2">
            <Layout size={12} />
            <span>Product Mgmt Suite</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <button 
             onClick={exportLogs}
             disabled={logs.length === 0}
             className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
           >
            <Download size={16} />
            Export JSON
          </button>
          <button
            onClick={runWorkflow}
            disabled={isRunning}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-md shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={16} fill="currentColor" />
            {isRunning ? 'Generating...' : 'Run Generator'}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 relative overflow-hidden flex">
        
        {/* Toolbar (Left) */}
        <div className="w-16 border-r border-gray-200 bg-white flex flex-col items-center py-6 gap-4 z-20">
           <div className="p-2 bg-emerald-50 text-emerald-600 rounded-md cursor-grab active:cursor-grabbing hover:bg-emerald-100 transition-colors" title="Drag Trigger">
             <Play size={20} />
           </div>
           <div className="p-2 bg-blue-50 text-blue-600 rounded-md cursor-grab active:cursor-grabbing hover:bg-blue-100 transition-colors" title="Drag Agent">
             <Layout size={20} />
           </div>
           <div className="h-px w-8 bg-gray-200 my-2" />
        </div>

        {/* Canvas Area */}
        <main className="flex-1 relative h-full">
          <Canvas
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
            onNodesChange={setNodes}
          />
        </main>

        {/* Right Sidebar (Properties) */}
        <PropertiesPanel
          node={selectedNode}
          isOpen={!!selectedNode}
          onClose={() => setSelectedNodeId(null)}
          onUpdate={handleNodeUpdate}
        />
      </div>

      {/* Execution Modal */}
      <ExecutionModal
        isOpen={isExecutionOpen}
        onClose={() => setIsExecutionOpen(false)}
        logs={logs}
        isRunning={isRunning}
      />
    </div>
  );
}