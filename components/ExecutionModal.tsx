import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ExecutionLog, NodeData } from '../types';
import { CheckCircle, Circle, Loader2, XCircle, Terminal, Map as MapIcon, FileText, ArrowRight, Activity, ChevronRight, ChevronDown, X } from 'lucide-react';
import { parseRoadmapData } from '../utils/roadmapParser';
import { RoadmapVisualizer } from './RoadmapVisualizer';
import { INITIAL_NODES } from '../constants';

interface ExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ExecutionLog[];
  isRunning: boolean;
}

const STEPS = [
  { id: 'agent-extract', label: 'Extract & Prioritize', icon: FileText, desc: 'Parsing requirements...' },
  { id: 'agent-plan', label: 'Plan & Intelligence', icon: Activity, desc: 'Analyzing risks & dependencies...' },
  { id: 'agent-polish', label: 'Polish & Export', icon: CheckCircle, desc: 'Formatting output...' },
  { id: 'agent-visualize', label: 'Timeline Visualizer', icon: MapIcon, desc: 'Generating charts...' }
];

export const ExecutionModal: React.FC<ExecutionModalProps> = ({ isOpen, onClose, logs, isRunning }) => {
  const [activeTab, setActiveTab] = useState<'progress' | 'visualizer'>('progress');
  const [showLogs, setShowLogs] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Determine if we have enough data to show the roadmap
  const roadmapData = useMemo(() => {
    const extractLog = logs.find(l => l.nodeLabel === 'Extract & Prioritize' && l.status === 'success');
    const planLog = logs.find(l => l.nodeLabel === 'Plan & Intelligence' && l.status === 'success');

    if (extractLog?.output && planLog?.output) {
      return parseRoadmapData(extractLog.output, planLog.output);
    }
    return null;
  }, [logs]);

  // Switch to visualizer automatically when finished
  useEffect(() => {
    if (roadmapData && !isRunning && activeTab === 'progress') {
       // Small delay to let user see completion
       const timer = setTimeout(() => setActiveTab('visualizer'), 800);
       return () => clearTimeout(timer);
    }
  }, [roadmapData, isRunning]);

  useEffect(() => {
    if (showLogs && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  if (!isOpen) return null;

  const getStepStatus = (stepId: string) => {
    const log = logs.find(l => l.nodeId === stepId);
    if (!log) return 'pending';
    return log.status;
  };

  const currentStepIndex = STEPS.findIndex(s => getStepStatus(s.id) === 'running');
  const completedCount = STEPS.filter(s => getStepStatus(s.id) === 'success').length;
  const progressPercent = (completedCount / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/50 backdrop-blur-sm p-4 transition-all">
      <div className={`bg-cream border-2 border-slate shadow-hard flex flex-col overflow-hidden transition-all duration-500 ease-in-out ${activeTab === 'visualizer' ? 'w-[95vw] h-[95vh]' : 'w-[600px] max-h-[80vh]'}`}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-slate flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-4">
             <div className={`p-2 border-2 border-slate ${isRunning ? 'bg-cream text-teal' : 'bg-teal text-white'}`}>
               <Activity size={24} className={isRunning ? "animate-pulse" : ""} />
             </div>
             <div>
               <h3 className="text-xl font-bold text-slate leading-none uppercase tracking-wide">
                 {isRunning ? 'Building Roadmap' : 'Roadmap Ready'}
               </h3>
               <p className="text-xs text-slate/70 font-bold mt-1 uppercase tracking-widest">
                 {isRunning ? 'Agents Active' : 'Visualization Complete'}
               </p>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
            {roadmapData && (
               <div className="flex bg-cream border-2 border-slate p-1 gap-1">
                 <button
                    onClick={() => setActiveTab('progress')}
                    className={`px-3 py-1 text-xs font-bold uppercase transition-colors ${activeTab === 'progress' ? 'bg-slate text-white' : 'text-slate hover:bg-slate/10'}`}
                  >
                    Progress
                  </button>
                  <button
                    onClick={() => setActiveTab('visualizer')}
                    className={`px-3 py-1 text-xs font-bold uppercase transition-colors ${activeTab === 'visualizer' ? 'bg-teal text-white' : 'text-slate hover:bg-teal/10'}`}
                  >
                    View
                  </button>
               </div>
            )}
            <button onClick={onClose} className="text-slate hover:text-terra border-2 border-transparent hover:border-terra p-1">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative bg-cream">
          
          {activeTab === 'progress' && (
            <div className="h-full overflow-y-auto p-8">
              {/* Progress Bar */}
              <div className="mb-10">
                <div className="flex justify-between text-xs font-bold text-slate mb-2 uppercase tracking-widest">
                  <span>Sequence Progress</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="h-4 bg-white border-2 border-slate">
                  <div 
                    className="h-full bg-teal transition-all duration-500 ease-out border-r-2 border-slate"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-6">
                {STEPS.map((step, idx) => {
                  const status = getStepStatus(step.id);
                  const isCurrent = status === 'running';
                  const isDone = status === 'success';
                  const isPending = status === 'pending';
                  const Icon = step.icon;

                  return (
                    <div 
                      key={step.id} 
                      className={`relative flex items-center gap-5 p-5 border-2 transition-all duration-300 ${isCurrent ? 'bg-white border-teal shadow-hard-sm' : isDone ? 'bg-white border-slate opacity-60' : 'bg-cream border-slate/30 opacity-40'}`}
                    >
                      <div className={`w-10 h-10 flex items-center justify-center border-2 border-slate shrink-0 ${isDone ? 'bg-teal text-white' : isCurrent ? 'bg-cream text-teal animate-pulse' : 'bg-white text-slate'}`}>
                        {isDone ? <CheckCircle size={20} /> : isCurrent ? <Loader2 size={20} className="animate-spin" /> : <step.icon size={20} />}
                      </div>
                      
                      <div className="flex-1">
                        <h4 className={`text-sm font-bold uppercase tracking-wider ${isCurrent ? 'text-teal' : 'text-slate'}`}>
                          {step.label}
                        </h4>
                        
                        {/* Live Output Snippet for Current Step */}
                        {isCurrent && (
                          <div className="mt-2 text-[10px] font-mono text-slate bg-cream p-2 border border-slate/20">
                            > Processing...
                          </div>
                        )}
                      </div>

                      {isDone && <span className="text-xs font-bold text-white bg-teal px-2 py-1 border border-slate">DONE</span>}
                    </div>
                  );
                })}
              </div>

              {/* Toggle Raw Logs */}
              <div className="mt-10 pt-6 border-t-2 border-slate/10">
                <button 
                  onClick={() => setShowLogs(!showLogs)}
                  className="flex items-center gap-2 text-xs font-bold text-slate uppercase tracking-wider hover:text-teal transition-colors"
                >
                  {showLogs ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  System Output
                </button>
                
                {showLogs && (
                  <div className="mt-4 bg-slate text-cream p-4 font-mono text-[10px] h-48 overflow-y-auto border-2 border-slate">
                    {logs.map((log, i) => (
                      <div key={i} className="mb-2 border-b border-cream/10 pb-1">
                        <span className={log.status === 'error' ? 'text-terra' : 'text-teal'}>
                          [{new Date(log.timestamp).toLocaleTimeString()}]
                        </span>{' '}
                        <span className="font-bold text-white uppercase">{log.nodeLabel}</span>
                        {log.output && typeof log.output === 'string' && (
                           <div className="pl-4 text-cream/70 truncate mt-1">{log.output.substring(0, 100)}...</div>
                        )}
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

            </div>
          )}

          {activeTab === 'visualizer' && roadmapData && (
            <div className="h-full w-full">
               <RoadmapVisualizer data={roadmapData} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};