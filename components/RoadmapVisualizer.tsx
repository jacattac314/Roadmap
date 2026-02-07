
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { RoadmapData, PriorityLevel, RiskLevel, Status, RoadmapFeature, ChatMessage } from '../types';
import { ChevronRight, AlertTriangle, Undo2, Share2, CheckCircle2, Clock, ChevronDown, ChevronUp, X, User, Flag, ArrowRight, Sparkles, Send, Loader2, Zap, Save, BarChart3, Edit2, Plus, LayoutList, CalendarRange, Brain } from 'lucide-react';
import { generateChatResponse, generateAgentResponse } from '../services/geminiService';

interface Props {
  data: RoadmapData;
  onBack?: () => void;
  onSave?: () => void;
}

export const RoadmapVisualizer: React.FC<Props> = ({ data, onBack, onSave }) => {
  // Local state to support editing
  const [localFeatures, setLocalFeatures] = useState<RoadmapFeature[]>(data.features);
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'gantt'>('list');
  const [brainstormingId, setBrainstormingId] = useState<string | null>(null);
  
  const [showOnlyCriticalPath, setShowOnlyCriticalPath] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: "Strategic Advisor online. I have mapped your workstreams. Where shall we focus?", timestamp: Date.now() }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync prop data to local state if data regenerates
  useEffect(() => {
    setLocalFeatures(data.features);
  }, [data]);

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  const toggleExpanded = (id: string) => {
    const next = new Set(expandedFeatures);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFeatures(next);
  };

  const updateFeature = (id: string, updates: Partial<RoadmapFeature>) => {
    setLocalFeatures(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const updateSubtask = (featureId: string, subtaskIndex: number, updates: any) => {
    setLocalFeatures(prev => prev.map(f => {
      if (f.id !== featureId) return f;
      const newSubtasks = [...(f.subtasks || [])];
      newSubtasks[subtaskIndex] = { ...newSubtasks[subtaskIndex], ...updates };
      return { ...f, subtasks: newSubtasks };
    }));
  };

  const cycleStatus = (current: Status): Status => {
    const flow: Status[] = ['planned', 'in_progress', 'completed', 'blocked', 'at_risk'];
    const idx = flow.indexOf(current);
    return flow[(idx + 1) % flow.length];
  };

  const handleBrainstorm = async (featureId: string) => {
    const feature = localFeatures.find(f => f.id === featureId);
    if (!feature) return;

    setBrainstormingId(featureId);

    try {
      const prompt = `
        You are a technical lead. 
        For the feature "${feature.name}" (Description: ${feature.description}, Workstream: ${feature.workstream}), 
        generate 3 concrete, actionable technical subtasks to implement this.
        
        Output ONLY JSON:
        [
          { "name": "Task Name", "assignee": "Role", "dueDate": "TBD" }
        ]
      `;

      const response = await generateAgentResponse({
        modelName: 'gemini-3-flash-preview',
        contents: [{ text: prompt }]
      });

      if (response.text) {
        const cleanText = response.text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
        const newTasks = JSON.parse(cleanText);
        
        const mappedTasks = newTasks.map((t: any) => ({
            name: t.name,
            status: 'planned',
            assignee: t.assignee || 'Eng',
            dueDate: t.dueDate || 'TBD',
            isBlocked: false
        }));

        updateFeature(featureId, {
            subtasks: [...(feature.subtasks || []), ...mappedTasks]
        });
      }
    } catch (e) {
        console.error("Brainstorm failed", e);
    } finally {
        setBrainstormingId(null);
    }
  };

  const getStatusColor = (status: Status) => {
    switch (status) {
      case 'in_progress': return 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]';
      case 'completed': return 'bg-emerald-500';
      case 'blocked': return 'bg-rose-500';
      case 'at_risk': return 'bg-amber-500';
      default: return 'bg-zinc-600';
    }
  };

  const getCardStyle = (feature: RoadmapFeature) => {
    if (feature.risk === 'high') return "bg-[#1A0C0B] border-[#4A1614] text-[#F87171]";
    if (feature.isCriticalPath) return "bg-[#0C0D14] border-amber-500/20 text-white";
    if (feature.status === 'in_progress') return "bg-[#0C0D14] border-indigo-500/20 text-white";
    return "bg-[#111114] border-[#27272A] text-white";
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isThinking) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatInput, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsThinking(true);

    const roadmapContext = `
      CURRENT PLAN:
      Summary: ${data.summary}
      Workstreams: ${data.workstreams.map(w => w.name).join(', ')}
      Features: ${localFeatures.map(f => `${f.name} (Risk: ${f.risk}, Status: ${f.status})`).join('; ')}
      Milestones: ${data.milestones.map(m => `Q${m.quarter}: ${m.name}`).join(', ')}
    `;

    try {
      const history = chatMessages.concat(userMsg).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const response = await generateChatResponse({
        modelName: 'gemini-3-pro-preview',
        history: history,
        systemInstruction: `You are an elite Product Strategy Advisor. Use the provided roadmap context:
        ${roadmapContext}
        
        Rules:
        1. Give precise, work-oriented advice.
        2. Reference specific features and milestones from the data.
        3. Identify risks based on 'high risk' labels in the context.
        4. Be executive, brief, and objective.`
      });

      const botMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: response.text || "I was unable to derive a strategic conclusion. Please specify a workstream.", 
        timestamp: Date.now() 
      };
      setChatMessages(prev => [...prev, botMsg]);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { id: 'err', role: 'model', text: "Advisory sync interrupted. Please retry.", timestamp: Date.now() }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleExport = () => {
    const exportData = { ...data, features: localFeatures };
    const html = `<!DOCTYPE html><html><body style="background:#09090B;color:#eee;font-family:sans-serif;padding:40px;"><h1>Roadmap Export</h1><pre>${JSON.stringify(exportData, null, 2)}</pre></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `roadmap-${Date.now()}.html`;
    a.click();
  };

  // Helper to extract unique workstreams for Gantt view
  const ganttWorkstreams = useMemo(() => {
    const defined = data.workstreams.map(ws => ws.name);
    const fromFeatures = Array.from(new Set(localFeatures.map(f => f.workstream)));
    return Array.from(new Set([...defined, ...fromFeatures]));
  }, [data.workstreams, localFeatures]);

  const projectId = useMemo(() => `STRAT-${Math.floor(Math.random() * 9000) + 1000}`, []);

  return (
    <div className="flex flex-col h-full bg-[#060608] text-zinc-300 font-sans animate-fade-in relative overflow-hidden">
      
      {/* Minimalistic Sub-Header */}
      <nav className="h-12 px-6 flex items-center justify-between bg-black/40 backdrop-blur-xl border-b border-white/[0.04] z-50 shrink-0">
         <div className="flex items-center gap-3">
            <div className="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] font-mono text-zinc-500 uppercase tracking-tighter">
               {projectId}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
               <span>Visualization</span> <ChevronRight size={12} /> <span className="text-zinc-200">Execution Plan</span>
            </div>
         </div>
         
         <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex bg-[#111114] p-0.5 rounded-lg border border-white/5">
                <button
                    onClick={() => setViewMode('list')}
                    className={`h-6 px-2.5 rounded-md flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <LayoutList size={10} /> List
                </button>
                <button
                    onClick={() => setViewMode('gantt')}
                    className={`h-6 px-2.5 rounded-md flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'gantt' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <CalendarRange size={10} /> Roadmap
                </button>
            </div>

            <div className="w-px h-3 bg-white/10" />

            <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setShowOnlyCriticalPath(!showOnlyCriticalPath)}
                  className={`h-7 px-3 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${showOnlyCriticalPath ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                >
                  <Zap size={10} className={showOnlyCriticalPath ? "fill-current" : ""} /> Critical
                </button>
                <div className="w-px h-3 bg-white/10 mx-1" />
                <button 
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className={`h-7 px-3 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${isChatOpen ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                >
                  <Sparkles size={10} /> Advisor
                </button>
            </div>
         </div>
      </nav>

      {/* AI Advisor Panel */}
      {isChatOpen && (
        <div className="w-full bg-[#0C0D14] border-b border-indigo-500/20 max-h-[40vh] flex flex-col animate-in slide-in-from-top duration-500 z-40 overflow-hidden shadow-2xl">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth">
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-white/5 ${msg.role === 'user' ? 'bg-zinc-800 text-zinc-500' : 'bg-indigo-500/20 text-indigo-400'}`}>
                  {msg.role === 'user' ? <User size={12} /> : <Sparkles size={12} />}
                </div>
                <div className={`max-w-[75%] p-3.5 rounded-2xl text-[12px] leading-relaxed ${msg.role === 'user' ? 'bg-zinc-900 text-zinc-500 rounded-tr-none' : 'bg-indigo-500/[0.04] border border-indigo-500/10 text-indigo-100/80 rounded-tl-none'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Loader2 size={12} className="animate-spin text-indigo-400" />
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500/30 flex items-center">Consulting Plan...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="px-6 py-3 bg-black/40 border-t border-white/[0.03] flex gap-3">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Query risks, blockers, or workstreams..."
              className="flex-1 bg-white/[0.02] border border-white/10 rounded-xl px-4 py-2 text-[12px] text-white placeholder-zinc-700 outline-none focus:border-indigo-500/40"
            />
            <button 
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || isThinking}
              className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-500 disabled:opacity-20 transition-all"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area - Toggleable */}
      <main className="flex-1 overflow-y-auto custom-scrollbar relative pb-40 px-6">
        
        {viewMode === 'gantt' ? (
          /* GANTT VIEW */
          <div className="max-w-6xl mx-auto pt-8 space-y-8 animate-in fade-in duration-300">
             {/* Gantt Header */}
             <div className="grid grid-cols-[250px_1fr_1fr_1fr_1fr] gap-4 sticky top-0 bg-[#060608]/95 backdrop-blur-sm z-30 py-4 border-b border-white/10 items-end">
                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-2 pb-1">Workstream</div>
                {[1, 2, 3, 4].map(q => (
                   <div key={q} className="bg-[#111114] rounded-xl border border-white/5 p-3 text-center shadow-lg">
                      <div className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Q{q}</div>
                      <div className="text-[9px] text-indigo-400/80 truncate mt-1 font-medium">
                         {data.milestones.find(m => m.quarter === q)?.name || 'Execution Phase'}
                      </div>
                   </div>
                ))}
             </div>

             {/* Gantt Body */}
             <div className="space-y-8 pb-20">
                {ganttWorkstreams.map(ws => {
                   const wsFeatures = localFeatures.filter(f => f.workstream === ws);
                   if (showOnlyCriticalPath && wsFeatures.every(f => !f.isCriticalPath)) return null;

                   return (
                      <div key={ws} className="relative">
                         {/* Workstream Row Title */}
                         <div className="sticky left-0 z-20 mb-3 pl-2 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <div className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">{ws}</div>
                         </div>

                         {/* Features Grid */}
                         <div className="space-y-1">
                            {wsFeatures.map(feature => {
                               if (showOnlyCriticalPath && !feature.isCriticalPath) return null;
                               
                               const startQ = Math.min(...feature.quarters);
                               const endQ = Math.max(...feature.quarters);
                               const span = endQ - startQ + 1;

                               return (
                                  <div key={feature.id} className="grid grid-cols-[250px_1fr_1fr_1fr_1fr] gap-4 items-center group relative hover:bg-white/[0.02] rounded-lg transition-colors p-1">
                                     {/* Background Columns for Grid Effect */}
                                     <div className="absolute inset-0 grid grid-cols-[250px_1fr_1fr_1fr_1fr] gap-4 pointer-events-none opacity-20">
                                         <div />
                                         <div className="border-l border-dashed border-white/10" />
                                         <div className="border-l border-dashed border-white/10" />
                                         <div className="border-l border-dashed border-white/10" />
                                         <div className="border-l border-dashed border-white/10" />
                                     </div>

                                     {/* Label */}
                                     <div className="pl-6 pr-4 min-w-0 relative z-10 border-l-2 border-transparent group-hover:border-indigo-500/30 transition-all">
                                        <div className="text-[11px] font-bold text-zinc-400 group-hover:text-white truncate transition-colors" title={feature.name}>
                                           {feature.name}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                           <span className={`text-[8px] font-black uppercase tracking-widest ${feature.status === 'completed' ? 'text-emerald-500' : 'text-zinc-600'}`}>
                                              {feature.status.replace('_', ' ')}
                                           </span>
                                        </div>
                                     </div>

                                     {/* Bar */}
                                     <div 
                                        className={`h-7 rounded-md relative flex items-center px-3 text-[9px] font-black uppercase tracking-widest text-white/90 shadow-lg cursor-pointer transition-all hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] z-20 ${getStatusColor(feature.status)} border border-white/10`}
                                        style={{
                                           gridColumnStart: startQ + 1,
                                           gridColumnEnd: `span ${span}`
                                        }}
                                        onClick={() => {
                                           updateFeature(feature.id, { status: cycleStatus(feature.status) });
                                        }}
                                        title={`Status: ${feature.status} (Click to toggle)`}
                                     >
                                        <span className="truncate w-full drop-shadow-md">{feature.name}</span>
                                        {feature.isCriticalPath && <Zap size={10} className="absolute right-2 text-amber-300 fill-current" />}
                                     </div>
                                  </div>
                               );
                            })}
                         </div>
                      </div>
                   );
                })}
             </div>
          </div>
        ) : (
          /* LIST VIEW (Existing) */
          <>
             {/* Milestones Header */}
             <div className="max-w-4xl mx-auto pt-16 pb-12 flex justify-between px-8 overflow-x-auto gap-8 no-scrollbar">
                {data.milestones.map((m, i) => (
                   <div key={i} className="flex flex-col items-center gap-3 min-w-[120px] shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-700 hover:text-indigo-400 hover:border-indigo-500/30 transition-all">
                         <Flag size={14} />
                      </div>
                      <div className="text-center">
                         <p className="text-[8px] font-black text-indigo-500/40 uppercase tracking-widest mb-1">Q{m.quarter} GATE</p>
                         <p className="text-[11px] font-bold text-zinc-500 max-w-[100px] leading-tight">{m.name}</p>
                      </div>
                   </div>
                ))}
             </div>

             {/* Today Marker */}
             <div className="flex justify-center my-8 sticky top-20 z-30 pointer-events-none">
                <div className="px-4 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-2xl flex items-center gap-2 border border-white/20">
                   <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live Now
                </div>
             </div>

             <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.03] pointer-events-none" />

             <div className="max-w-2xl mx-auto space-y-24 mt-12">
                {[1, 2, 3, 4].map(q => {
                  let qFeatures = localFeatures.filter(f => f.quarters.includes(q));
                  if (showOnlyCriticalPath) qFeatures = qFeatures.filter(f => f.isCriticalPath);
                  if (qFeatures.length === 0) return null;

                  return (
                    <section key={q} className="relative">
                      <div className="flex items-center justify-center mb-16">
                        <div className="px-5 py-1.5 bg-[#09090B] border border-white/[0.04] rounded-full relative z-10">
                           <span className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.6em]">
                             Phase 0{q} Execution
                           </span>
                        </div>
                      </div>

                      <div className="space-y-6">
                        {qFeatures.map((feature) => {
                          const isExpanded = expandedFeatures.has(feature.id);
                          
                          return (
                            <div 
                              key={feature.id} 
                              className={`relative border transition-all duration-300 group ${isExpanded ? `rounded-[2rem] p-8 overflow-hidden ${getCardStyle(feature)}` : 'rounded-2xl p-4 bg-[#111114] border-[#27272A] hover:bg-[#161618] cursor-pointer'}`}
                              onClick={(e) => {
                                if (!isExpanded) toggleExpanded(feature.id);
                              }}
                            >
                              {isExpanded && <div className="absolute top-0 right-0 w-48 h-48 bg-white/[0.02] blur-[90px] -mr-24 -mt-24 pointer-events-none" />}

                              <div className={`flex justify-between items-start relative z-10 ${!isExpanded ? 'items-center' : ''}`}>
                                <div className="flex items-center gap-4 flex-1">
                                   {!isExpanded && (
                                      <div 
                                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${getStatusColor(feature.status)}`} 
                                        title={`Status: ${feature.status}`}
                                      />
                                   )}
                                   {feature.isCriticalPath && (
                                     <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                                        <Zap size={10} className="fill-current" />
                                     </div>
                                   )}
                                   <div className="flex-1 min-w-0">
                                      {isExpanded && <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">{feature.workstream}</p>}
                                      {isExpanded ? (
                                        <input 
                                          value={feature.name}
                                          onChange={(e) => updateFeature(feature.id, { name: e.target.value })}
                                          className="w-full bg-transparent border-none p-0 text-lg font-bold leading-tight tracking-tight text-white focus:ring-0 focus:outline-none placeholder-zinc-700"
                                          placeholder="Feature Name"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      ) : (
                                        <h3 className="text-sm font-bold text-zinc-300 truncate pr-4">{feature.name}</h3>
                                      )}
                                   </div>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                  {/* Expanded: Status Badge */}
                                  {isExpanded && (
                                    <div 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateFeature(feature.id, { status: cycleStatus(feature.status) });
                                      }}
                                      className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase border cursor-pointer select-none ${feature.risk === 'high' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-white/5 text-zinc-600 border-white/10'}`}
                                    >
                                       {feature.priority.replace('_', ' ')}
                                    </div>
                                  )}
                                  
                                  {/* Collapsed: Avatars & Status Text */}
                                  {!isExpanded && (
                                    <>
                                      <div className="flex -space-x-2">
                                         <div className="w-6 h-6 rounded-full bg-zinc-800 border border-[#111114] flex items-center justify-center text-[8px] text-zinc-500 font-bold">TM</div>
                                         <div className="w-6 h-6 rounded-full bg-zinc-800 border border-[#111114] flex items-center justify-center text-[8px] text-zinc-500 font-bold">PM</div>
                                      </div>
                                      <div className="hidden sm:block text-[9px] font-black uppercase tracking-widest text-zinc-600 w-20 text-right">
                                        {feature.status.replace('_', ' ')}
                                      </div>
                                    </>
                                  )}

                                  {/* Collapse/Expand Toggle */}
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpanded(feature.id);
                                    }}
                                    className="p-1 rounded-full hover:bg-white/5 text-zinc-500 transition-colors"
                                  >
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Content */}
                              {isExpanded && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                  {feature.risk === 'high' && (
                                     <div className="mt-6 bg-rose-500/5 border border-rose-500/10 rounded-xl p-4">
                                        <div className="flex items-center gap-2 text-rose-400 text-[9px] font-black uppercase tracking-widest mb-2">
                                           <AlertTriangle size={10} /> Dependency Risk
                                        </div>
                                        <p className="text-[11px] text-rose-400/60 leading-relaxed">{feature.riskReason || 'Critical path at risk due to cross-team resources.'}</p>
                                     </div>
                                  )}

                                  <div className="mt-8 space-y-4">
                                    <div className="flex items-center justify-between border-b border-white/[0.03] pb-2">
                                      <p className="text-[9px] font-black text-zinc-800 uppercase tracking-widest">Execution Pipeline</p>
                                      
                                      <div className="flex items-center gap-2">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleBrainstorm(feature.id);
                                          }}
                                          disabled={brainstormingId === feature.id}
                                          className={`text-[9px] font-bold flex items-center gap-1 transition-colors px-2 py-1 rounded-md border ${brainstormingId === feature.id ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'text-zinc-500 hover:text-indigo-400 border-transparent hover:bg-white/5'}`}
                                        >
                                          {brainstormingId === feature.id ? <Loader2 size={10} className="animate-spin" /> : <Brain size={10} />}
                                          {brainstormingId === feature.id ? 'Brainstorming...' : 'Brainstorm Implementation'}
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateFeature(feature.id, { 
                                              subtasks: [...(feature.subtasks || []), { name: 'New Task', status: 'planned', assignee: 'Eng', dueDate: 'TBD' }]
                                            });
                                          }}
                                          className="text-[9px] font-bold text-zinc-600 hover:text-indigo-400 flex items-center gap-1 transition-colors px-2 py-1"
                                        >
                                          <Plus size={10} /> Add Task
                                        </button>
                                      </div>
                                    </div>
                                    {feature.subtasks?.map((task, i) => (
                                      <div key={i} className="flex items-center justify-between gap-4 group/task">
                                        <div className="flex items-center gap-3 flex-1">
                                           <div 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateSubtask(feature.id, i, { status: task.status === 'completed' ? 'planned' : 'completed' });
                                              }}
                                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-all ${task.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-zinc-800 bg-transparent hover:border-zinc-600'}`}
                                           >
                                              <CheckCircle2 size={10} strokeWidth={4} className={task.status === 'completed' ? 'opacity-100' : 'opacity-0 group-hover/task:opacity-50'} />
                                           </div>
                                           <input 
                                             value={task.name}
                                             onChange={(e) => updateSubtask(feature.id, i, { name: e.target.value })}
                                             onClick={(e) => e.stopPropagation()}
                                             className={`flex-1 bg-transparent border-none p-0 text-[12px] font-medium focus:ring-0 focus:outline-none ${task.status === 'completed' ? 'text-zinc-700 line-through' : 'text-zinc-400'}`}
                                           />
                                        </div>
                                        <span className={`text-[8px] font-black tracking-widest uppercase px-2 py-0.5 rounded border ${task.status === 'completed' ? 'text-emerald-500 border-emerald-500/10' : 'text-zinc-800 border-white/5'}`}>
                                           {task.status}
                                        </span>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="mt-10 pt-6 border-t border-white/[0.03] flex items-center justify-between">
                                       <div 
                                         className="flex items-center gap-3 cursor-pointer select-none"
                                         onClick={(e) => {
                                            e.stopPropagation();
                                            updateFeature(feature.id, { status: cycleStatus(feature.status) });
                                         }}
                                       >
                                          <div className={`w-2 h-2 rounded-full ${feature.status === 'in_progress' ? 'bg-indigo-500 animate-pulse' : 'bg-zinc-800'}`} />
                                          <span className={`text-[9px] font-black uppercase tracking-widest ${feature.status === 'in_progress' ? 'text-indigo-400' : 'text-zinc-700'} group-hover:text-white transition-colors`}>
                                            {feature.status.replace('_', ' ')}
                                          </span>
                                       </div>
                                       <div className="flex items-center gap-3">
                                          <div className="flex -space-x-1.5">
                                             {[1,2].map(i => (
                                               <div key={i} className="w-6 h-6 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[7px] text-zinc-700 font-black ring-1 ring-[#060608]">ENG</div>
                                             ))}
                                          </div>
                                          <button className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-700 hover:text-white transition-all">
                                             <ArrowRight size={14} />
                                          </button>
                                       </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
             </div>
          </>
        )}
      </main>

      {/* Floating Strategy Controls */}
      <div className="fixed bottom-10 left-0 right-0 px-8 flex justify-between items-center pointer-events-none z-50">
         <div className="flex gap-3 pointer-events-auto bg-black/40 backdrop-blur-3xl p-2 rounded-2xl border border-white/5 shadow-2xl">
            <button className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-600 hover:text-white transition-all">
               <BarChart3 size={20} />
            </button>
            <button 
              onClick={onSave}
              className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-600 hover:text-indigo-400 transition-all"
            >
               <Save size={20} />
            </button>
         </div>

         <button 
           onClick={handleExport}
           className="pointer-events-auto h-14 px-8 rounded-2xl bg-white text-black font-black uppercase tracking-[0.15em] text-[10px] flex items-center gap-3 shadow-2xl hover:bg-zinc-200 transition-all active:scale-95"
         >
            <Share2 size={16} /> Export Strategy
         </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#060608] to-transparent pointer-events-none z-40" />
    </div>
  );
};
