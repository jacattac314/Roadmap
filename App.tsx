
import React, { useState } from 'react';
import { NodeData, Edge, NodeType, ExecutionLog } from './types';
import { INITIAL_NODES, INITIAL_EDGES } from './constants';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ExecutionModal } from './components/ExecutionModal';
import { generateAgentResponse } from './services/geminiService';
import { Play, Share2, Layout, Download, Grid } from 'lucide-react';

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

  const handleCreateChildNode = (parentId: string, label: string) => {
    const parent = nodes.find(n => n.id === parentId);
    if (!parent) return null;

    const newNodeId = `node-${Date.now()}`;
    const newNode: NodeData = {
      id: newNodeId,
      type: NodeType.AGENT,
      label: label.substring(0, 30) + (label.length > 30 ? '...' : ''),
      x: parent.x + 300,
      y: parent.y,
      description: label,
      config: {
        model: 'gemini-3-flash-preview'
      }
    };

    const newEdge: Edge = {
      id: `edge-${Date.now()}`,
      source: parentId,
      target: newNodeId
    };

    setNodes(prev => [...prev, newNode]);
    setEdges(prev => [...prev, newEdge]);
    
    return newNodeId;
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
            // Default Text + URL Context + Summary
            let val = node.config.staticInput || "";
            if (node.config.summary) {
              val += `\n\n[CONTEXT SUMMARY]: ${node.config.summary}`;
            }
            if (node.config.contentUrls?.length) {
              val += `\n\n[REFERENCED URLS]: ${node.config.contentUrls.join(', ')}`;
            }
            if (!val) val = "No input provided";

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
    <div className="flex flex-col h-screen bg-cream text-slate font-sans selection:bg-teal selection:text-white">
      {/* Top Navigation */}
      <header className="h-16 border-b-2 border-slate bg-cream flex items-center justify-between px-6 z-30 relative shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate rounded-none border-2 border-slate flex items-center justify-center text-cream font-bold shadow-hard-sm">
            G
          </div>
          <div>
            <h1 className="font-bold text-slate text-xl tracking-tight">Roadmap<span className="text-terra">Gen</span></h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <span className="text-xs font-bold uppercase tracking-widest text-teal flex items-center gap-1.5 border-2 border-teal px-3 py-1 rounded-full bg-cream">
              <Grid size={12} /> Gemini Powered
           </span>
        </div>

        <div className="flex items-center gap-4">
           <button 
             onClick={exportLogs}
             disabled={logs.length === 0}
             className="px-4 py-2 text-sm font-bold text-slate hover:text-teal transition-colors flex items-center gap-2 disabled:opacity-50 uppercase tracking-wide"
           >
            <Download size={16} />
            JSON
          </button>
          <button
            onClick={runWorkflow}
            disabled={isRunning}
            className={`px-6 py-2 text-sm font-bold bg-terra text-cream border-2 border-slate shadow-hard hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-none`}
          >
            <Play size={16} fill="currentColor" />
            {isRunning ? 'GENERATING...' : 'RUN GENERATOR'}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 relative overflow-hidden flex">
        
        {/* Toolbar (Left) */}
        <div className="w-20 border-r-2 border-slate bg-cream flex flex-col items-center py-8 gap-6 z-20">
           <div className="p-3 bg-white border-2 border-slate text-slate shadow-hard-sm cursor-grab active:cursor-grabbing hover:bg-teal hover:text-white transition-colors" title="Drag Trigger">
             <Play size={20} />
           </div>
           <div className="p-3 bg-white border-2 border-slate text-slate shadow-hard-sm cursor-grab active:cursor-grabbing hover:bg-teal hover:text-white transition-colors" title="Drag Agent">
             <Layout size={20} />
           </div>
           <div className="h-[2px] w-8 bg-slate/20 my-2" />
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
          onCreateNode={handleCreateChildNode}
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
