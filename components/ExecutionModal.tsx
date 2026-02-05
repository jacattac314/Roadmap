import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ExecutionLog } from '../types';
import { CheckCircle, Circle, Loader2, XCircle, Terminal, Globe, ExternalLink, Map as MapIcon, FileText } from 'lucide-react';
import { parseRoadmapData } from '../utils/roadmapParser';
import { RoadmapVisualizer } from './RoadmapVisualizer';

interface ExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ExecutionLog[];
  isRunning: boolean;
}

// Component to render Mermaid diagrams
const MermaidDiagram: React.FC<{ code: string }> = ({ code }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (containerRef.current && (window as any).mermaid) {
        try {
          // Unique ID for each render to prevent conflicts
          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
          // Render returns an object { svg: string } in v10
          const { svg } = await (window as any).mermaid.render(id, code);
          setSvg(svg);
          setError(null);
        } catch (err: any) {
          console.error("Mermaid rendering error:", err);
          setError("Failed to render chart. Syntax might be invalid.");
        }
      }
    };

    renderDiagram();
  }, [code]);

  if (error) {
    return (
        <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded border border-rose-100 font-mono">
            {error}
            <pre className="mt-1 text-[10px] text-gray-500 overflow-x-auto">{code}</pre>
        </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="overflow-x-auto bg-white p-2 rounded border border-gray-100"
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  );
};

export const ExecutionModal: React.FC<ExecutionModalProps> = ({ isOpen, onClose, logs, isRunning }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'logs' | 'visualizer'>('logs');

  useEffect(() => {
    if (isOpen && bottomRef.current && activeTab === 'logs') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen, activeTab]);

  // Determine if we have enough data to show the roadmap
  const roadmapData = useMemo(() => {
    // We need data from Step 1 (Extract) and Step 2 (Plan) to build the full visualizer
    const extractLog = logs.find(l => l.nodeLabel === 'Extract & Prioritize' && l.status === 'success');
    // Note: Match the exact label from constants.ts
    const planLog = logs.find(l => l.nodeLabel === 'Plan & Intelligence' && l.status === 'success');

    if (extractLog?.output && planLog?.output) {
      return parseRoadmapData(extractLog.output, planLog.output);
    }
    return null;
  }, [logs]);

  // Switch to visualizer automatically when ready, if user hasn't interacted
  useEffect(() => {
    if (roadmapData && !isRunning && activeTab === 'logs') {
      setActiveTab('visualizer');
    }
  }, [roadmapData, isRunning]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
      <div className={`bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${activeTab === 'visualizer' ? 'w-full max-w-[90vw] h-[90vh]' : 'w-[700px] max-h-[85vh]'}`}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <div className="flex items-center gap-4">
             <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Terminal size={20} className="text-gray-500" />
              Workflow Execution
            </h3>
            
            {/* Tabs */}
            <div className="flex p-1 bg-gray-200 rounded-lg">
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'logs' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <FileText size={14} /> Logs
              </button>
              <button
                onClick={() => setActiveTab('visualizer')}
                disabled={!roadmapData}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'visualizer' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed'}`}
              >
                <MapIcon size={14} /> Visual Roadmap
              </button>
            </div>
          </div>
         
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isRunning}
          >
            <XCircle size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative bg-gray-50/50">
          
          {activeTab === 'logs' && (
            <div className="h-full overflow-y-auto p-6 space-y-6">
              {logs.length === 0 && isRunning && (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="animate-spin mr-2" /> Initializing...
                </div>
              )}

              {logs.map((log, idx) => (
                <div key={idx} className="relative pl-8 pb-2">
                  {/* Timeline Line */}
                  {idx !== logs.length - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gray-200" />
                  )}

                  {/* Icon */}
                  <div className="absolute left-0 top-1">
                    {log.status === 'success' && <CheckCircle size={22} className="text-emerald-500 bg-white" />}
                    {log.status === 'running' && <Loader2 size={22} className="text-blue-500 animate-spin bg-white" />}
                    {log.status === 'error' && <XCircle size={22} className="text-rose-500 bg-white" />}
                    {log.status === 'pending' && <Circle size={22} className="text-gray-300 bg-white" />}
                  </div>

                  {/* Content */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-sm text-gray-900">{log.nodeLabel}</span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {log.status === 'running' && (
                      <p className="text-sm text-blue-600 italic">Thinking...</p>
                    )}

                    {log.input && (
                      <div className="mb-2">
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Input</p>
                        <div className="bg-gray-50 p-2 rounded text-xs text-gray-700 font-mono break-words whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {typeof log.input === 'object' ? JSON.stringify(log.input, null, 2) : log.input}
                        </div>
                      </div>
                    )}

                    {log.output && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Output</p>
                        <div className="bg-emerald-50 border border-emerald-100 p-2 rounded text-xs text-gray-800 font-mono break-words whitespace-pre-wrap">
                          {/* Parse for Mermaid blocks */}
                          {typeof log.output === 'string' && log.output.includes('```mermaid') ? (
                              <>
                                <div className="mb-2 text-gray-500 italic">Generated Chart:</div>
                                <MermaidDiagram code={log.output.replace(/```mermaid/g, '').replace(/```/g, '').trim()} />
                              </>
                          ) : (
                              typeof log.output === 'object' ? JSON.stringify(log.output, null, 2) : log.output
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Search Grounding Display */}
                    {log.groundingMetadata?.groundingChunks && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Globe size={12} className="text-blue-500" />
                          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Sources</span>
                        </div>
                        <div className="space-y-1">
                          {log.groundingMetadata.groundingChunks.map((chunk: any, i: number) => {
                            if (chunk.web?.uri) {
                              return (
                                <a 
                                  key={i} 
                                  href={chunk.web.uri} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs text-blue-600 hover:underline bg-blue-50 p-1.5 rounded"
                                >
                                  <ExternalLink size={10} />
                                  <span className="truncate">{chunk.web.title || chunk.web.uri}</span>
                                </a>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    )}
                    
                    {log.status === 'error' && log.output && (
                        <div className="bg-rose-50 border border-rose-100 p-2 rounded text-xs text-rose-800 break-words">
                            {log.output}
                        </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}

          {activeTab === 'visualizer' && roadmapData && (
            <div className="h-full p-4">
               <RoadmapVisualizer data={roadmapData} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};