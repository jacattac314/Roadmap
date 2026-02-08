
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
  const bottomRef = useRef<HTMLDivElement>(null);

  const roadmapData = useMemo(() => {
    const extractLog = logs.find(l => l.nodeLabel === 'Extract & Prioritize' && l.status === 'success');
    const planLog = logs.find(l => l.nodeLabel === 'Plan & Intelligence' && l.status === 'success');
    if (extractLog?.output && planLog?.output) return parseRoadmapData(extractLog.output, planLog.output);
    return null;
  }, [logs]);

  useEffect(() => {
    if (roadmapData && !isRunning && activeTab === 'progress') {
       const timer = setTimeout(() => setActiveTab('visualizer'), 800);
       return () => clearTimeout(timer);
    }
  }, [roadmapData, isRunning]);

  if (!isOpen) return null;

  const getStepStatus = (stepId: string) => {
    const log = logs.find(l => l.nodeId === stepId);
    return log ? log.status : 'pending';
  };

  const completedCount = STEPS.filter(s => getStepStatus(s.id) === 'success').length;
  const progressPercent = (completedCount / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className={`bg-[#1E1F20] border border-white/10 shadow-2xl flex flex-col overflow-hidden transition-all duration-500 rounded-3xl ${activeTab === 'visualizer' ? 'w-[95vw] h-[95vh]' : 'w-[600px] max-h-[80vh]'}`}>
        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-[#111114]">
          <div className="flex items-center gap-4">
             <div className={`p-2 rounded-xl border ${isRunning ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-500 text-white border-transparent'}`}>
               <Activity size={24} className={isRunning ? "animate-pulse" : ""} />
             </div>
             <div>
               <h3 className="text-xl font-bold text-white leading-none uppercase tracking-tight">{isRunning ? 'Building Architecture' : 'Model Finalized'}</h3>
             </div>
          </div>
          <div className="flex items-center gap-4">
            {roadmapData && (
               <div className="flex bg-black/40 border border-white/10 p-1 rounded-lg">
                 <button onClick={() => setActiveTab('progress')} className={`px-3 py-1 text-xs font-bold uppercase rounded-md transition-all ${activeTab === 'progress' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Progress</button>
                 <button onClick={() => setActiveTab('visualizer')} className={`px-3 py-1 text-xs font-bold uppercase rounded-md transition-all ${activeTab === 'visualizer' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Visualizer</button>
               </div>
            )}
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X size={24} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative bg-[#09090B]">
          {activeTab === 'progress' && (
            <div className="h-full overflow-y-auto p-8 custom-scrollbar">
              <div className="mb-10 text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] flex justify-between items-center">
                 <span>Operational Pipeline</span>
                 <span className="text-white font-mono">{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-2 bg-black border border-white/5 mb-8 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="space-y-4">
                {STEPS.map((step) => {
                  const status = getStepStatus(step.id);
                  const isCurrent = status === 'running';
                  const isDone = status === 'success';
                  return (
                    <div key={step.id} className={`flex items-center gap-5 p-5 border rounded-2xl transition-all duration-300 ${isCurrent ? 'bg-[#1E1F20] border-indigo-500/40 shadow-xl' : isDone ? 'bg-[#1E1F20]/40 border-emerald-500/20' : 'border-white/5 opacity-40'}`}>
                      <div className={`w-10 h-10 flex items-center justify-center rounded-xl border-2 ${isDone ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : isCurrent ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-black border-zinc-800 text-zinc-700'}`}>
                        {isDone ? <CheckCircle size={20} /> : isCurrent ? <Loader2 size={20} className="animate-spin" /> : <step.icon size={20} />}
                      </div>
                      <div className="flex-1">
                        <h4 className={`text-xs font-black uppercase tracking-widest ${isCurrent ? 'text-indigo-400' : isDone ? 'text-zinc-400' : 'text-zinc-600'}`}>{step.label}</h4>
                        {isCurrent && (
                           <div className="mt-2 text-[10px] font-mono text-zinc-500 bg-black/40 p-2 border border-white/5 rounded-lg flex items-center gap-2">
                             <Terminal size={10} className="text-indigo-500" /> {"Processing instructions..."}
                           </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {activeTab === 'visualizer' && roadmapData && <div className="h-full w-full"><RoadmapVisualizer data={roadmapData} /></div>}
        </div>
      </div>
    </div>
  );
};
