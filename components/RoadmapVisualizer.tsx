
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { RoadmapData, PriorityLevel, RiskLevel, Status, RoadmapFeature, ChatMessage } from '../types';
import { ChevronRight, AlertTriangle, Undo2, Share2, CheckCircle2, Clock, ChevronDown, ChevronUp, X, User, Flag, ArrowRight, Sparkles, Send, Loader2, Zap, Save, BarChart3, Edit2, Plus, LayoutList, CalendarRange, Brain, GitMerge, FileText, Activity, ShieldAlert, Link2 } from 'lucide-react';
import { generateChatResponse, generateAgentResponse } from '../services/geminiService';

interface Props {
  data: RoadmapData;
  onBack?: () => void;
  onSave?: () => void;
  onChange?: (updatedData: RoadmapData) => void;
}

export const RoadmapVisualizer: React.FC<Props> = ({ data, onBack, onSave, onChange }) => {
  // Local state to support editing. Initialized once from props.
  const [localFeatures, setLocalFeatures] = useState<RoadmapFeature[]>(data.features);
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'gantt'>('list');
  const [brainstormingId, setBrainstormingId] = useState<string | null>(null);
  
  const [showOnlyCriticalPath, setShowOnlyCriticalPath] = useState(false);
  const [showDependencies, setShowDependencies] = useState(false);
  const [dependencyLines, setDependencyLines] = useState<React.ReactNode[]>([]);
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: "Strategic Advisor online. I have mapped your workstreams. Where shall we focus?", timestamp: Date.now() }
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const featureRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const ganttContainerRef = useRef<HTMLDivElement>(null);

  // Helper to extract unique workstreams for Gantt view
  // Defined here to be available for useEffect dependencies
  const ganttWorkstreams = useMemo(() => {
    const defined = data.workstreams.map(ws => ws.name);
    const fromFeatures = Array.from(new Set(localFeatures.map(f => f.workstream)));
    return Array.from(new Set([...defined, ...fromFeatures]));
  }, [data.workstreams, localFeatures]);

  // Living Documentation Data Aggregation
  const docData = useMemo(() => {
    const total = localFeatures.length;
    const completed = localFeatures.filter(f => f.status === 'completed').length;
    const atRisk = localFeatures.filter(f => f.status === 'at_risk' || f.status === 'blocked').length;
    const highRisk = localFeatures.filter(f => f.risk === 'high').length;
    const inProgress = localFeatures.filter(f => f.status === 'in_progress').length;

    const riskRegistry = localFeatures.filter(f => 
      f.status === 'at_risk' || f.status === 'blocked' || f.risk === 'high'
    );

    const dependencies = localFeatures
        .filter(f => f.dependencies && f.dependencies.length > 0)
        .map(f => {
           const deps = f.dependencies!.map(dId => {
               const found = localFeatures.find(l => l.id === dId || l.name === dId);
               return found ? found.name : dId;
           });
           return { source: f.name, targets: deps, status: f.status };
        });

    return {
      snapshot: { total, completed, atRisk, highRisk, inProgress },
      riskRegistry,
      dependencies
    };
  }, [localFeatures]);

  // Helper to propagate changes to parent
  const notifyChange = (newFeatures: RoadmapFeature[]) => {
    if (onChange) {
      onChange({ ...data, features: newFeatures });
    }
  };

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  // Dependency Line Drawing Effect
  useEffect(() => {
    if (!showDependencies || viewMode !== 'gantt') {
      setDependencyLines([]);
      return;
    }

    const drawDependencies = () => {
      if (!ganttContainerRef.current) return;
      const containerRect = ganttContainerRef.current.getBoundingClientRect();
      const lines: React.ReactNode[] = [];

      localFeatures.forEach(feature => {
        if (!feature.dependencies || feature.dependencies.length === 0) return;
        
        const targetEl = featureRefs.current.get(feature.id);
        if (!targetEl) return;
        const targetRect = targetEl.getBoundingClientRect();
        
        // Skip if target is hidden/off-screen (simplification)
        if (targetRect.height === 0) return;

        feature.dependencies.forEach(dep => {
             // Find dependency feature by ID or Name
             const sourceFeature = localFeatures.find(f => f.id === dep || f.name === dep);
             if (!sourceFeature) return;

             const sourceEl = featureRefs.current.get(sourceFeature.id);
             if (!sourceEl) return;
             const sourceRect = sourceEl.getBoundingClientRect();

             // Calculate coordinates relative to the gantt container
             const x1 = sourceRect.right - containerRect.left;
             const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top;
             const x2 = targetRect.left - containerRect.left;
             const y2 = targetRect.top + targetRect.height / 2 - containerRect.top;

             // Bezier Curve
             const c1x = x1 + 30;
             const c1y = y1;
             const c2x = x2 - 30;
             const c2y = y2;
             
             const d = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;

             lines.push(
                <path 
                   key={`${sourceFeature.id}-${feature.id}`} 
                   d={d} 
                   stroke="#6366f1" 
                   strokeWidth="2" 
                   fill="none" 
                   opacity="0.6" 
                   strokeDasharray="4 4"
                   markerEnd="url(#arrowhead-rel)"
                   className="animate-in fade-in duration-500"
                />
             );
        });
      });
      setDependencyLines(lines);
    };

    // Draw initially and on resize/scroll (using RAF for smoother updates)
    let rafId: number;
    const tick = () => {
       drawDependencies();
       // rafId = requestAnimationFrame(tick); // Continuous update might be heavy, stick to events + one-off
    };
    
    // Initial draw
    setTimeout(tick, 100); // Small delay to ensure layout is stable
    
    window.addEventListener('resize', tick);
    // Observe container size changes if possible, or just rely on state triggers
    
    return () => {
      window.removeEventListener('resize', tick);
      cancelAnimationFrame(rafId);
    };
  }, [showDependencies, viewMode, localFeatures, expandedFeatures, ganttWorkstreams]);

  const toggleExpanded = (id: string) => {
    const next = new Set(expandedFeatures);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFeatures(next);
  };

  const updateFeature = (id: string, updates: Partial<RoadmapFeature>) => {
    const updated = localFeatures.map(f => f.id === id ? { ...f, ...updates } : f);
    setLocalFeatures(updated);
    notifyChange(updated);
  };

  const updateSubtask = (featureId: string, subtaskIndex: number, updates: any) => {
    const updated = localFeatures.map(f => {
      if (f.id !== featureId) return f;
      const newSubtasks = [...(f.subtasks || [])];
      newSubtasks[subtaskIndex] = { ...newSubtasks[subtaskIndex], ...updates };
      return { ...f, subtasks: newSubtasks };
    });
    setLocalFeatures(updated);
    notifyChange(updated);
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

        const updated = localFeatures.map(f => {
            if (f.id !== featureId) return f;
            return { ...f, subtasks: [...(f.subtasks || []), ...mappedTasks] };
        });
        setLocalFeatures(updated);
        notifyChange(updated);
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

  const projectId = useMemo(() => `STRAT-${Math.floor(Math.random() * 9000) + 1000}`, []);

  return (
    <div className="flex flex-col h-full bg-[#060608] text-zinc-300 font-sans animate-fade-in relative overflow-hidden">
      
      {/* Minimalistic Sub-Header */}
      <nav className="py-2 md:h-12 px-4 md:px-6 flex flex-col md:flex-row items-start md:items-center justify-between bg-black/40 backdrop-blur-xl border-b border-white/[0.04] z-50 shrink-0 gap-3 md:gap-0">
         <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3">
                <div className="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] font-mono text-zinc-500 uppercase tracking-tighter">
                   {projectId}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                   <span>Visualization</span> <ChevronRight size={12} /> <span className="text-zinc-200">Execution Plan</span>
                </div>
            </div>
         </div>
         
         <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
            {/* View Toggle */}
            <div className="flex bg-[#111114] p-0.5 rounded-lg border border-white/5 shrink-0">
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

            <div className="w-px h-3 bg-white/10 shrink-0" />

            <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  onClick={() => setShowDependencies(!showDependencies)}
                  className={`h-7 px-3 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${showDependencies ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                >
                  <GitMerge size={10} className={showDependencies ? "text-white" : ""} /> <span className="hidden sm:inline">Dependencies</span>
                </button>
                <button 
                  onClick={() => setShowOnlyCriticalPath(!showOnlyCriticalPath)}
                  className={`h-7 px-3 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${showOnlyCriticalPath ? 'bg-amber-500 text-black shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                >
                  <Zap size={10} className={showOnlyCriticalPath ? "fill-current" : ""} /> <span className="hidden sm:inline">Critical</span>
                </button>
                <div className="w-px h-3 bg-white/10 mx-1" />
                <button 
                  onClick={() => setIsDocsOpen(!isDocsOpen)}
                  className={`h-7 px-3 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${isDocsOpen ? 'bg-emerald-500 text-black shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                >
                  <Activity size={10} /> <span className="hidden sm:inline">Snapshot</span><span className="inline sm:hidden">Docs</span>
                </button>
                <button 
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className={`h-7 px-3 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${isChatOpen ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                >
                  <Sparkles size={10} /> <span className="hidden sm:inline">Advisor</span>
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
      <main className="flex-1 overflow-y-auto custom-scrollbar relative pb-40 px-0">
        
        {viewMode === 'gantt' ? (
          /* GANTT VIEW */
          <div className="max-w-6xl mx-auto pt-4 md:pt-8 space-y-8 animate-in fade-in duration-300 relative">
             <div className="overflow-x-auto pb-4">
               <div className="min-w-[1024px] px-6">
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
                 <div ref={ganttContainerRef} className="pb-20 relative z-10">
                    <div className="space-y-8">
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
                                     const isExpanded = expandedFeatures.has(feature.id);

                                     return (
                                        <React.Fragment key={feature.id}>
                                          <div className="grid grid-cols-[250px_1fr_1fr_1fr_1fr] gap-4 items-center group relative hover:bg-white/[0.02] rounded-lg transition-colors p-1">
                                             {/* Background Columns for Grid Effect */}
                                             <div className="absolute inset-0 grid grid-cols-[250px_1fr_1fr_1fr_1fr] gap-4 pointer-events-none opacity-20">
                                                 <div />
                                                 <div className="border-l border-dashed border-white/10" />
                                                 <div className="border-l border-dashed border-white/10" />
                                                 <div className="border-l border-dashed border-white/10" />
                                                 <div className="border-l border-dashed border-white/10" />
                                             </div>

                                             {/* Label */}
                                             <div 
                                                className="pl-6 pr-4 min-w-0 relative z-10 border-l-2 border-transparent group-hover:border-indigo-500/30 transition-all cursor-pointer"
                                                onClick={() => toggleExpanded(feature.id)}
                                                title={`${feature.name}\n${feature.description || ''}`}
                                             >
                                                <div className={`text-[11px] font-bold truncate transition-colors ${isExpanded ? 'text-indigo-400' : 'text-zinc-400 group-hover:text-white'}`}>
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
                                                ref={(el) => { if (el) featureRefs.current.set(feature.id, el); else featureRefs.current.delete(feature.id); }}
                                                className={`h-7 rounded-md relative flex items-center px-3 text-[9px] font-black uppercase tracking-widest text-white/90 shadow-lg cursor-pointer transition-all hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] z-20 ${getStatusColor(feature.status)} border border-white/10`}
                                                style={{
                                                   gridColumnStart: startQ + 1,
                                                   gridColumnEnd: `span ${span}`
                                                }}
                                                onClick={() => toggleExpanded(feature.id)}
                                                title={`Status: ${feature.status}\n${feature.description || 'Click to expand'}`}
                                             >
                                                <span className="truncate w-full drop-shadow-md">{feature.name}</span>
                                                {feature.isCriticalPath && <Zap size={10} className="absolute right-2 text-amber-300 fill-current" />}
                                             </div>
                                          </div>

                                          {/* Expanded Detail Panel */}
                                          {isExpanded && (
                                             <div className="grid grid-cols-[250px_1fr] gap-4 animate-in slide-in-from-top-2 duration-200 mb-4">
                                                 <div className="flex flex-col items-end pr-6 pt-2 border-r border-white/5">
                                                     <button onClick={() => updateFeature(feature.id, { status: cycleStatus(feature.status) })} className="text-[9px] font-black text-zinc-500 hover:text-white transition-colors uppercase tracking-widest mb-2">Change Status</button>
                                                     <button onClick={() => toggleExpanded(feature.id)} className="text-[9px] font-black text-zinc-500 hover:text-white transition-colors uppercase tracking-widest">Close</button>
                                                 </div>
                                                 <div className="bg-[#111114] border border-white/5 rounded-xl p-4 mr-1 relative overflow-hidden">
                                                     <div className="mb-4">
                                                          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1.5 block">Description</label>
                                                          <textarea
                                                              value={feature.description || ''}
                                                              onChange={(e) => updateFeature(feature.id, { description: e.target.value })}
                                                              className="w-full bg-black/20 border border-white/5 rounded-lg p-3 text-xs text-zinc-400 focus:text-zinc-200 focus:border-indigo-500/30 outline-none resize-none transition-all placeholder:text-zinc-700 font-medium"
                                                              placeholder="No description provided. Click to edit..."
                                                              rows={2}
                                                          />
                                                     </div>
                                                     
                                                     <div className="flex items-center gap-2 mb-3">
                                                         <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Execution Steps</span>
                                                         <div className="h-px bg-white/5 flex-1" />
                                                         <button onClick={() => handleBrainstorm(feature.id)} className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                                                             {brainstormingId === feature.id ? <Loader2 size={10} className="animate-spin" /> : <Brain size={10} />} Auto-Plan
                                                         </button>
                                                     </div>

                                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                         {feature.subtasks?.map((task, idx) => (
                                                            <div key={idx} className="flex items-center gap-2 bg-black/20 p-2 rounded-lg border border-white/5">
                                                                <div 
                                                                  onClick={() => updateSubtask(feature.id, idx, { status: task.status === 'completed' ? 'planned' : 'completed' })}
                                                                  className={`w-3 h-3 rounded-full border cursor-pointer flex items-center justify-center ${task.status === 'completed' ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-700 hover:border-zinc-500'}`}
                                                                >
                                                                    {task.status === 'completed' && <CheckCircle2 size={8} className="text-black" />}
                                                                </div>
                                                                <span className={`text-[10px] ${task.status === 'completed' ? 'text-zinc-600 line-through' : 'text-zinc-300'}`}>{task.name}</span>
                                                            </div>
                                                         ))}
                                                         {(!feature.subtasks || feature.subtasks.length === 0) && (
                                                            <div className="text-[10px] text-zinc-700 italic px-2">No subtasks defined.</div>
                                                         )}
                                                     </div>
                                                 </div>
                                             </div>
                                          )}
                                        </React.Fragment>
                                     );
                                  })}
                               </div>
                            </div>
                         );
                      })}
                    </div>

                    {/* Dependency Lines Layer - Moved to bottom for Z-index/Stacking visibility */}
                    <div className="absolute inset-0 pointer-events-none z-50">
                        <svg className="w-full h-full">
                          <defs>
                            <marker id="arrowhead-rel" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" fill="#6366f1">
                              <polygon points="0 0, 6 3, 0 6" />
                            </marker>
                          </defs>
                          {dependencyLines}
                        </svg>
                    </div>
                 </div>
               </div>
             </div>
          </div>
        ) : (
          /* LIST VIEW (Existing) */
          <>
             {/* Milestones Header */}
             <div className="max-w-4xl mx-auto pt-16 pb-12 flex justify-between px-4 md:px-8 overflow-x-auto gap-8 no-scrollbar">
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

             <div className="max-w-2xl mx-auto space-y-24 mt-12 px-6">
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
                              title={!isExpanded ? `${feature.description || 'No description'}` : ''}
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
                                  
                                  {/* Avatars & POC Assignment */}
                                  <div 
                                    className="flex -space-x-2 cursor-pointer hover:scale-105 transition-transform"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const email = window.prompt("Assign Point of Contact (Email):", feature.pocEmail || "");
                                        if (email !== null) updateFeature(feature.id, { pocEmail: email });
                                    }}
                                    title={feature.pocEmail ? `POC: ${feature.pocEmail}` : "Click to assign POC"}
                                  >
                                    {feature.pocEmail ? (
                                        <div className="w-6 h-6 rounded-full bg-indigo-500 border border-[#111114] flex items-center justify-center text-[8px] text-white font-bold">
                                            {feature.pocEmail.charAt(0).toUpperCase()}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="w-6 h-6 rounded-full bg-zinc-800 border border-[#111114] flex items-center justify-center text-[8px] text-zinc-500 font-bold">TM</div>
                                            <div className="w-6 h-6 rounded-full bg-zinc-800 border border-[#111114] flex items-center justify-center text-[8px] text-zinc-500 font-bold">PM</div>
                                        </>
                                    )}
                                  </div>

                                  {!isExpanded && (
                                    <div className="hidden sm:block text-[9px] font-black uppercase tracking-widest text-zinc-600 w-20 text-right">
                                        {feature.status.replace('_', ' ')}
                                    </div>
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

                                  <div className="mt-6">
                                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2 block">Description</label>
                                    <textarea
                                        value={feature.description || ''}
                                        onChange={(e) => updateFeature(feature.id, { description: e.target.value })}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full bg-[#09090B] border border-white/5 rounded-xl p-4 text-sm text-zinc-400 focus:text-zinc-200 focus:border-indigo-500/30 outline-none resize-none transition-all placeholder:text-zinc-700 leading-relaxed"
                                        placeholder="Add strategic context..."
                                        rows={3}
                                    />
                                  </div>

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
                                            const updated = localFeatures.map(f => {
                                                if (f.id !== feature.id) return f;
                                                return { ...f, subtasks: [...(f.subtasks || []), { name: 'New Task', status: 'planned' as Status, assignee: 'Eng', dueDate: 'TBD' }] };
                                            });
                                            setLocalFeatures(updated);
                                            notifyChange(updated);
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
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#060608] to-transparent pointer-events-none z-40" />

      {/* Ghost Drawer - Living Docs */}
      {isDocsOpen && <div className="fixed inset-0 z-[55] bg-black/20 backdrop-blur-[1px]" onClick={() => setIsDocsOpen(false)} />}
      <div 
        className={`fixed top-0 right-0 bottom-0 w-full md:w-[400px] bg-[#09090B]/95 backdrop-blur-2xl border-l border-white/10 z-[60] transform transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-2xl ${isDocsOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-6">
           <div className="flex items-center gap-2">
              <Activity size={16} className="text-emerald-500 animate-pulse" />
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Executive Snapshot</h2>
           </div>
           <button onClick={() => setIsDocsOpen(false)} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="h-[calc(100%-4rem)] overflow-y-auto custom-scrollbar">
           {/* Executive Snapshot */}
           <div className="p-6 border-b border-white/5 space-y-4">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                 <Sparkles size={10} /> Mission Overview
              </h3>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
                 <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                    Mission execution is at <span className="text-emerald-400 font-bold">{Math.round((docData.snapshot.completed / docData.snapshot.total) * 100) || 0}% velocity</span>. 
                    Currently tracking <span className="text-rose-400 font-bold">{docData.snapshot.atRisk + docData.snapshot.highRisk} risks</span> across {data.workstreams.length} active workstreams.
                 </p>
                 <div className="flex gap-2">
                    <div className="flex-1 bg-black/40 rounded p-2 text-center border border-white/5">
                       <div className="text-lg font-bold text-white">{docData.snapshot.completed}</div>
                       <div className="text-[8px] text-zinc-500 uppercase tracking-wider font-bold">Done</div>
                    </div>
                    <div className="flex-1 bg-black/40 rounded p-2 text-center border border-white/5">
                        <div className="text-lg font-bold text-indigo-400">{docData.snapshot.inProgress}</div>
                        <div className="text-[8px] text-zinc-500 uppercase tracking-wider font-bold">Active</div>
                    </div>
                    <div className="flex-1 bg-black/40 rounded p-2 text-center border border-white/5">
                        <div className="text-lg font-bold text-rose-400">{docData.snapshot.atRisk + docData.snapshot.highRisk}</div>
                        <div className="text-[8px] text-zinc-500 uppercase tracking-wider font-bold">Risks</div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Dynamic Risk Register */}
           <div className="p-6 border-b border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                 <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert size={10} /> Dynamic Risk Register
                 </h3>
                 <span className="bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded text-[9px] font-bold">{docData.riskRegistry.length} Detected</span>
              </div>
              <div className="space-y-2">
                 {docData.riskRegistry.map(item => (
                    <div key={item.id} className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/30 transition-colors group cursor-pointer">
                       <div className="flex justify-between items-start mb-1">
                          <span className="text-[11px] font-bold text-rose-200">{item.name}</span>
                          <AlertTriangle size={10} className="text-rose-500 mt-0.5" />
                       </div>
                       <p className="text-[10px] text-rose-400/60 leading-snug">{item.riskReason || 'Operational constraint detected.'}</p>
                       <div className="mt-2 flex items-center gap-2">
                          <span className="text-[8px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/10 px-1.5 rounded">{item.status.replace('_', ' ')}</span>
                          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 border border-zinc-700/50 px-1.5 rounded">{item.workstream}</span>
                       </div>
                    </div>
                 ))}
                 {docData.riskRegistry.length === 0 && <div className="text-xs text-zinc-600 italic px-2">No high priority risks detected.</div>}
              </div>
           </div>

           {/* Dependency Handshake */}
           <div className="p-6 space-y-4 pb-20">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                 <Link2 size={10} /> Dependency Handshake
              </h3>
              <div className="space-y-4 relative">
                 {docData.dependencies.map((item, i) => (
                    <div key={i} className="relative pl-4 border-l-2 border-indigo-500/10 hover:border-indigo-500/30 transition-colors">
                       <div className="absolute left-[-5px] top-1.5 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                       <div className="text-[11px] font-bold text-zinc-300 mb-1">{item.source}</div>
                       <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 rounded ${item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>{item.status}</span>
                          <span className="text-[9px] text-zinc-600 uppercase tracking-widest">Requires</span>
                       </div>
                       <div className="space-y-1">
                           {item.targets.map((t, j) => (
                              <div key={j} className="flex items-center gap-2 p-1.5 rounded bg-white/[0.02] border border-white/5 text-[10px] text-indigo-200/80">
                                 <GitMerge size={10} className="text-indigo-500" /> {t}
                              </div>
                           ))}
                       </div>
                    </div>
                 ))}
                 {docData.dependencies.length === 0 && <div className="text-xs text-zinc-600 italic px-2">No active dependencies mapped.</div>}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
