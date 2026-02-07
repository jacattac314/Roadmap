
import React, { useState, useEffect } from 'react';
import { ExecutionLog } from '../types';
import { CheckCircle2, Loader2, Circle, Activity, ChevronRight, Sparkles, Terminal, Cpu, FileJson, Search } from 'lucide-react';

interface GenerationProgressProps {
  logs: ExecutionLog[];
  isRunning: boolean;
  onViewRoadmap: () => void;
}

const STEPS = [
  { id: 'agent-extract', label: 'EXTRACT & PRIORITIZE', icon: Search },
  { id: 'agent-plan', label: 'PLAN & INTELLIGENCE', icon: Cpu },
  { id: 'agent-polish', label: 'POLISH & EXPORT', icon: FileJson },
  { id: 'agent-visualize', label: 'TIMELINE VISUALIZER', icon: Activity }
];

const LOADING_MESSAGES: Record<string, string[]> = {
  'agent-extract': [
    "Parsing unstructured input...",
    "Identifying core requirements...",
    "Tagging priority levels (Must/Should/Could)...",
    "Extracting constraints and resources..."
  ],
  'agent-plan': [
    "Mapping dependencies...",
    "Calculating quarterly capacity...",
    "identifying critical path risks...",
    "Assigning workstreams...",
    "Generating predictive insights..."
  ],
  'agent-polish': [
    "Formatting executive summary...",
    "Structuring markdown report...",
    "Refining language tone...",
    "Compiling risk analysis..."
  ],
  'agent-visualize': [
    "Calculating Gantt coordinates...",
    "Rendering timeline vectors...",
    "Finalizing visual assets...",
    "Preparing interactive view..."
  ]
};

export const GenerationProgress: React.FC<GenerationProgressProps> = ({ logs, isRunning, onViewRoadmap }) => {
  const [currentMessage, setCurrentMessage] = useState("");
  const [progress, setProgress] = useState(0);

  const completedCount = logs.filter(l => l.status === 'success').length;
  const totalProgress = Math.min(100, Math.round((completedCount / STEPS.length) * 100));

  const getStepStatus = (label: string) => {
    // Determine status by matching label loosely or by index if logs are sequential
    // A more robust way is matching the ID if possible, but logs use 'nodeLabel'.
    // Here we map ID to label for checking.
    const step = STEPS.find(s => s.label === label);
    const log = logs.find(l => l.nodeLabel.toUpperCase() === label);
    if (!log) return 'pending';
    return log.status;
  };

  // Effect to cycle through fake log messages for the active step
  useEffect(() => {
    if (!isRunning) return;

    const activeStep = STEPS.find(step => {
      const status = getStepStatus(step.label);
      return status === 'running';
    });

    if (activeStep) {
      const messages = LOADING_MESSAGES[activeStep.id] || ["Processing..."];
      let msgIndex = 0;
      
      setCurrentMessage(messages[0]);
      setProgress(0);

      const msgInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % messages.length;
        setCurrentMessage(messages[msgIndex]);
      }, 1500);

      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 1, 95)); // Cap at 95% until done
      }, 100);

      return () => {
        clearInterval(msgInterval);
        clearInterval(progressInterval);
      };
    }
  }, [logs, isRunning]);

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 md:p-6 bg-[#09090B] animate-fade-in relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-indigo-500/10 rounded-full blur-[100px] md:blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl bg-[#1E1F20] border border-[#27272A] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative z-10">
        
        {/* Header */}
        <div className="px-5 md:px-8 py-4 md:py-6 border-b border-[#27272A] bg-[#1E1F20]/50 backdrop-blur-md flex justify-between items-center">
          <div className="flex items-center gap-3 md:gap-5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
               <Activity size={20} className={isRunning ? "animate-pulse" : ""} />
            </div>
            <div>
               <h2 className="text-base md:text-xl font-bold text-white tracking-tight">{isRunning ? 'Orchestrating Agents' : 'Roadmap Finalized'}</h2>
               <p className="text-[10px] md:text-xs font-medium text-zinc-500 mt-0.5 uppercase tracking-widest">
                  {isRunning ? 'Gemini 2.5 Flash Pipeline' : 'Ready for Execution'}
               </p>
            </div>
          </div>
          {!isRunning && (
             <button 
                onClick={onViewRoadmap}
                className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 animate-in fade-in"
              >
                Launch
              </button>
          )}
        </div>

        <div className="p-6 md:p-8 space-y-8">
           {/* Total Progress Bar */}
           <div className="space-y-2">
              <div className="flex justify-between items-end px-1">
                 <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Total Completion</span>
                 <span className="text-sm font-black text-white tabular-nums">{totalProgress}%</span>
              </div>
              <div className="h-2 bg-black rounded-full border border-white/5 overflow-hidden">
                 <div 
                   className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-1000 ease-out"
                   style={{ width: `${totalProgress}%` }}
                 />
              </div>
           </div>

           {/* Step List */}
           <div className="grid gap-3">
              {STEPS.map((step) => {
                 const status = getStepStatus(step.label);
                 const isDone = status === 'success';
                 const isProcessing = status === 'running';
                 const Icon = step.icon;

                 return (
                    <div 
                      key={step.id} 
                      className={`relative overflow-hidden rounded-xl border transition-all duration-500 ${
                        isDone ? 'bg-[#1E1F20] border-emerald-500/10' : 
                        isProcessing ? 'bg-[#27272A] border-indigo-500/40 shadow-2xl shadow-indigo-500/10' : 
                        'bg-[#1E1F20] border-[#27272A] opacity-40'
                      }`}
                    >
                       {/* Active Progress Background for current step */}
                       {isProcessing && (
                          <div 
                            className="absolute inset-0 bg-indigo-500/5 transition-all duration-100 ease-linear pointer-events-none"
                            style={{ width: `${progress}%` }}
                          />
                       )}

                       <div className="p-4 flex items-center gap-4 relative z-10">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${
                            isDone ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 
                            isProcessing ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 
                            'bg-[#09090B] border-[#27272A] text-zinc-700'
                          }`}>
                             {isDone ? <CheckCircle2 size={16} /> : isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Icon size={14} />}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-center mb-1">
                                <h4 className={`text-[11px] font-black uppercase tracking-widest ${isProcessing ? 'text-white' : 'text-zinc-500'}`}>
                                  {step.label}
                                </h4>
                                {isProcessing && (
                                   <span className="text-[9px] font-mono text-indigo-400 animate-pulse">Running...</span>
                                )}
                             </div>
                             
                             {/* Live Console Output Area */}
                             {isProcessing ? (
                                <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-2 h-4 overflow-hidden">
                                   <Terminal size={10} className="text-indigo-500 shrink-0" />
                                   <span className="animate-pulse truncate">
                                      {currentMessage}
                                   </span>
                                </div>
                             ) : isDone ? (
                                <div className="text-[9px] text-emerald-500/70 font-mono mt-1 flex items-center gap-1">
                                   <CheckCircle2 size={8} /> Completed successfully
                                </div>
                             ) : null}
                          </div>
                       </div>
                    </div>
                 );
              })}
           </div>

           {!isRunning && (
             <button 
               onClick={onViewRoadmap}
               className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all active:scale-95 shadow-2xl animate-in fade-in slide-in-from-bottom-4"
             >
                <Sparkles size={16} />
                View Strategic Timeline
                <ChevronRight size={16} />
             </button>
           )}
        </div>
      </div>
    </div>
  );
};
