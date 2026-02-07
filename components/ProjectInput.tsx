
import React, { useState } from 'react';
import { Search, Globe, ChevronDown, Sparkles, ArrowRight, Notebook, Clock, AlertTriangle, CheckCircle2, Ban, Brain } from 'lucide-react';
import { MODEL_OPTIONS } from '../constants';
import { Project } from '../types';

interface ProjectInputProps {
  onStart: (input: string, model: string, options: { useSearch: boolean, useThinking: boolean }) => void;
  projects: Project[];
  onLoadProject: (project: Project) => void;
}

export const ProjectInput: React.FC<ProjectInputProps> = ({ onStart, projects, onLoadProject }) => {
  const [input, setInput] = useState('');
  const [model, setModel] = useState(MODEL_OPTIONS[0].value);
  const [isWebEnabled, setIsWebEnabled] = useState(false);
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(false);

  const handleStart = () => {
    if (input.trim()) {
      onStart(input, model, { useSearch: isWebEnabled, useThinking: isThinkingEnabled });
    }
  };

  const getProjectHealth = (p: Project) => {
    if (!p.roadmapData) return { status: 'Draft', color: 'text-zinc-500', bg: 'bg-zinc-500/10', icon: Clock };
    
    const highRisks = p.roadmapData.features.filter(f => f.risk === 'high').length;
    const blocked = p.roadmapData.features.filter(f => f.status === 'blocked').length;
    const atRisk = p.roadmapData.features.filter(f => f.status === 'at_risk').length;
    
    if (blocked > 0) return { status: 'Blocked', color: 'text-rose-400', bg: 'bg-rose-500/10', icon: Ban };
    if (highRisks > 0 || atRisk > 0) return { status: 'At Risk', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: AlertTriangle };
    return { status: 'On Track', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 };
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 md:p-6 animate-fade-in relative overflow-hidden">
      {/* Background radial gradient */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[800px] h-[600px] md:h-[800px] bg-indigo-500/5 rounded-full blur-[100px] md:blur-[120px]" />
      </div>

      <div className="w-full max-w-3xl flex flex-col gap-8 relative z-10">
        <div className="flex flex-col gap-6">
          <div className="bg-[#1E1F20] border border-[#444746] rounded-3xl md:rounded-[28px] p-3 md:p-4 flex flex-col gap-3 md:gap-4 shadow-2xl focus-within:border-[#A8C7FA] transition-all">
             <div className="flex items-start gap-3 md:gap-4 px-1 md:px-2 pt-1">
                <Search className="text-zinc-400 mt-1.5 shrink-0 w-5 h-5 md:w-6 md:h-6" />
                <textarea 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe your product idea..."
                  className="w-full bg-transparent text-white text-lg md:text-xl placeholder-zinc-500 resize-none outline-none font-normal leading-relaxed min-h-[40px] max-h-[300px]"
                  style={{ height: input ? 'auto' : '40px' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleStart();
                    }
                  }}
                />
                <div className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-[#A142F4] shrink-0 mt-2.5" />
             </div>
             
             <div className="flex items-center justify-between px-1 md:px-2 pb-1">
                <div className="flex gap-1 md:gap-2">
                   <div className="relative flex items-center">
                      <Sparkles className="absolute left-3 w-3 h-3 md:w-3.5 md:h-3.5 text-zinc-300 pointer-events-none z-10" />
                      <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="appearance-none pl-8 pr-8 py-1.5 rounded-full bg-[#2B2C2E] border border-[#444746] text-white text-[10px] md:text-xs font-medium hover:bg-[#37393B] transition-colors outline-none cursor-pointer min-w-[120px]"
                      >
                        {MODEL_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 w-2.5 h-2.5 md:w-3 md:h-3 text-zinc-500 pointer-events-none" />
                   </div>
                   
                   <div className="flex items-center gap-1">
                      <button 
                         onClick={() => setIsWebEnabled(!isWebEnabled)}
                         className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-colors text-[10px] md:text-xs font-medium ${isWebEnabled ? 'bg-[#A8C7FA] text-[#062E6F] border-[#A8C7FA]' : 'bg-[#2B2C2E] border-[#444746] text-white hover:bg-[#37393B]'}`}
                         title="Toggle Google Search Grounding"
                      >
                          <Globe className="w-3 h-3 md:w-3.5 md:h-3.5" /> <span className="hidden xs:inline">Web</span>
                      </button>

                      <button 
                         onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
                         className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-colors text-[10px] md:text-xs font-medium ${isThinkingEnabled ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-[#2B2C2E] border-[#444746] text-white hover:bg-[#37393B]'}`}
                         title="Enable Deep Reasoning (Gemini 3 Pro + Thinking)"
                      >
                          <Brain className="w-3 h-3 md:w-3.5 md:h-3.5" /> <span className="hidden xs:inline">Reason</span>
                      </button>

                      <button className="flex items-center justify-center p-1.5 rounded-full bg-[#2B2C2E] border border-[#444746] text-white hover:bg-[#37393B] transition-colors" title="Attach NotebookLM">
                          <Notebook className="w-3.5 h-3.5" />
                      </button>
                   </div>
                </div>
                <button 
                  onClick={handleStart}
                  disabled={!input.trim()}
                  className={`p-2 rounded-full transition-all ${input.trim() ? 'bg-[#A8C7FA] text-[#062E6F] hover:scale-110 shadow-lg shadow-indigo-500/20' : 'bg-[#3C4043] text-zinc-500 opacity-50'}`}
                >
                   <ArrowRight size={20} />
                </button>
             </div>
          </div>
        </div>

        {/* Project List */}
        {projects.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Your Projects</h3>
                <span className="text-[10px] text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">{projects.length} Total</span>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projects.map(project => {
                   const health = getProjectHealth(project);
                   const HealthIcon = health.icon;
                   
                   return (
                      <div 
                        key={project.id}
                        onClick={() => onLoadProject(project)}
                        className="group bg-[#1E1F20] border border-[#27272A] hover:border-indigo-500/30 p-4 rounded-2xl cursor-pointer hover:bg-[#232425] transition-all hover:shadow-xl hover:shadow-black/20"
                      >
                         <div className="flex justify-between items-start mb-3">
                            <div className={`p-2 rounded-lg ${health.bg} ${health.color}`}>
                               <HealthIcon size={16} />
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono">
                               {new Date(project.updatedAt).toLocaleDateString()}
                            </span>
                         </div>
                         <h4 className="text-sm font-bold text-zinc-200 group-hover:text-white mb-1 truncate">{project.name}</h4>
                         <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${health.status === 'On Track' ? 'bg-emerald-500' : health.status === 'Blocked' ? 'bg-rose-500' : health.status === 'At Risk' ? 'bg-amber-500' : 'bg-zinc-500'}`} />
                            <span className={`text-[10px] font-medium uppercase tracking-wider ${health.color}`}>
                               {health.status}
                            </span>
                         </div>
                      </div>
                   );
                })}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
