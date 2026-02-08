import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { NodeData, Edge, NodeType, ExecutionLog, Project, RoadmapData, MeetingArtifact } from './types';
import { INITIAL_NODES, INITIAL_EDGES, MARS_ROVER_PROJECT } from './constants';
import { ProjectInput } from './components/ProjectInput';
import { GenerationProgress } from './components/GenerationProgress';
import { RoadmapVisualizer } from './components/RoadmapVisualizer';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { LandingPage } from './components/LandingPage';
import { ChatPanel } from './components/ChatPanel';
import { generateAgentResponse, transcribeAudio } from './services/geminiService';
import { parseRoadmapData } from './utils/roadmapParser';
import { User, LogOut, ChevronDown, Plus, FolderOpen, Check, AlertTriangle, Clock, Trash2, LayoutTemplate, Workflow, Video, StopCircle, Loader2, Mic, MessageSquare } from 'lucide-react';

type AppState = 'landing' | 'input' | 'executing' | 'result';
type ViewMode = 'roadmap' | 'workflow';
type MeetingState = 'idle' | 'recording' | 'processing';

const STORAGE_KEY = 'agent_builder_v1_projects';

export default function App() {
  const [view, setView] = useState<AppState>('landing');
  const [resultMode, setResultMode] = useState<ViewMode>('roadmap');
  
  const [nodes, setNodes] = useState<NodeData[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [projectName, setProjectName] = useState('New Roadmap');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [recordingNodeId, setRecordingNodeId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<'details' | 'content' | 'meetings' | undefined>(undefined);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const [meetingState, setMeetingState] = useState<MeetingState>('idle');
  const [meetingProjectId, setMeetingProjectId] = useState<string | null>(null);
  const [meetingTimer, setMeetingTimer] = useState(0);
  
  const globalMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const globalAudioChunksRef = useRef<Blob[]>([]);

  const [currentRoadmap, setCurrentRoadmap] = useState<RoadmapData | null>(null);
  const [roadmapVersion, setRoadmapVersion] = useState(0);

  // Load Projects
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    let loadedProjects: Project[] = [];
    if (saved) {
      try { loadedProjects = JSON.parse(saved); } catch (e) { console.error(e); }
    }
    const hasDemo = loadedProjects.some(p => p.id === MARS_ROVER_PROJECT.id);
    if (!hasDemo) loadedProjects.unshift(MARS_ROVER_PROJECT);
    setProjects(loadedProjects);
    
    // Auto-login check
    if (localStorage.getItem('agent_builder_user')) {
      setView('input');
    }
  }, []);

  // Auto-save logic
  useEffect(() => {
    if (currentProjectId && view !== 'landing') {
      const timer = setTimeout(() => {
        handleSaveProject();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [nodes, edges, currentRoadmap, projectName]);

  const saveToLocalStorage = useCallback((updatedProjects: Project[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
  }, []);

  const handleSaveProject = useCallback(() => {
    const projectId = currentProjectId || `proj-${Date.now()}`;
    const newProject: Project = {
      id: projectId,
      name: projectName,
      nodes,
      edges,
      logs,
      roadmapData: currentRoadmap || undefined,
      updatedAt: Date.now()
    };

    setProjects(prev => {
      const existingIdx = prev.findIndex(p => p.id === projectId);
      let updated;
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], ...newProject };
      } else {
        updated = [newProject, ...prev];
      }
      saveToLocalStorage(updated);
      return updated;
    });
    setCurrentProjectId(projectId);
  }, [currentProjectId, projectName, nodes, edges, logs, currentRoadmap, saveToLocalStorage]);

  const handleLoadProject = (project: Project) => {
    setProjectName(project.name);
    setCurrentProjectId(project.id);
    setNodes(project.nodes);
    setEdges(project.edges);
    setLogs(project.logs);
    if (project.roadmapData) {
      setCurrentRoadmap(project.roadmapData);
    } else {
      setCurrentRoadmap(null);
    }
    setRoadmapVersion(v => v + 1);
    setView('result');
    setIsProjectDropdownOpen(false);
  };

  const handleNewProject = () => {
    setProjectName('New Roadmap');
    setCurrentProjectId(null);
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setLogs([]);
    setCurrentRoadmap(null);
    setView('input');
    setIsProjectDropdownOpen(false);
  };

  const resolvePath = (path: string, obj: any) => {
    return path.split('.').reduce((prev, curr) => {
      return prev ? prev[curr] : null;
    }, obj);
  };

  const handleStart = async (input: string, model: string = 'gemini-3-flash-preview', options: { useSearch: boolean, useThinking: boolean }) => {
    const name = input.substring(0, 30) + (input.length > 30 ? '...' : '');
    setProjectName(name);
    setView('executing');
    setIsRunning(true);
    setLogs([]);
    setCurrentRoadmap(null);

    // Initial Node configuration based on user selection
    const updatedNodes = nodes.map(n => {
      if (n.id === 'trigger-input') return { ...n, config: { ...n.config, inputType: 'text' as const, staticInput: input } };
      if (n.type === NodeType.AGENT) {
        let nodeModel = model;
        let thinkingBudget = 0;
        let useSearch = n.config.useSearch || options.useSearch;
        if (options.useThinking && model.includes('pro')) {
           thinkingBudget = 32768; 
        }
        return { ...n, config: { ...n.config, model: nodeModel, useSearch, thinkingBudget } };
      }
      return n;
    });
    setNodes(updatedNodes);

    const context: Record<string, any> = {};
    const localLogs: ExecutionLog[] = [];

    // Execute through nodes based on edges (simplified sequential for demo)
    for (const node of updatedNodes) {
      const logEntry: ExecutionLog = { nodeId: node.id, nodeLabel: node.label, status: 'running', timestamp: Date.now() };
      setLogs(prev => [...prev, logEntry]);
      localLogs.push(logEntry);

      try {
        if (node.type === NodeType.TRIGGER) {
          context['userInput'] = { text: input };
          logEntry.status = 'success';
          logEntry.output = input;
        } else if (node.type === NodeType.AGENT) {
          const prompt = node.config.prompt || '';
          // Robust interpolation supporting nested paths
          const interpolatedPrompt = prompt.replace(/{{([^}]+)}}/g, (_, key) => {
             const path = key.trim();
             const value = resolvePath(path, context);
             if (value === null || value === undefined) return '';
             return typeof value === 'object' ? value?.text || JSON.stringify(value) : String(value);
          });
          
          const result = await generateAgentResponse({
            modelName: node.config.model || 'gemini-3-flash-preview',
            contents: [{ text: interpolatedPrompt }],
            systemInstruction: node.config.systemInstruction,
            useSearch: node.config.useSearch,
            thinkingBudget: node.config.thinkingBudget
          });

          if (result.error) throw new Error(result.error);
          
          let parsedOutput = result.text;
          try {
             const clean = result.text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
             const jsonStart = clean.indexOf('{');
             const jsonEnd = clean.lastIndexOf('}');
             if (jsonStart !== -1 && jsonEnd !== -1) {
                parsedOutput = JSON.parse(clean.substring(jsonStart, jsonEnd + 1));
             }
          } catch(e) {}

          // FIXED: Ensure parsedOutput is a non-null object before spreading to fix "Spread types may only be created from object types" error.
          context[node.config.outputVar || 'output'] = (typeof parsedOutput === 'object' && parsedOutput !== null) ? { ...parsedOutput, text: result.text } : { text: result.text };
          logEntry.status = 'success';
          logEntry.output = result.text;
        }
        
        setLogs(prev => prev.map(l => l.nodeId === node.id ? { ...logEntry, status: 'success' } : l));
        await new Promise(r => setTimeout(r, 600));
      } catch (err: any) {
        setLogs(prev => prev.map(l => l.nodeId === node.id ? { ...logEntry, status: 'error', output: err.message } : l));
        setIsRunning(false);
        return;
      }
    }

    const extractLog = localLogs.find(l => l.nodeLabel === 'Extract & Prioritize');
    const planLog = localLogs.find(l => l.nodeLabel === 'Plan & Intelligence');
    if (extractLog?.output && planLog?.output) {
       const parsed = parseRoadmapData(extractLog.output, planLog.output);
       setCurrentRoadmap(parsed);
       setRoadmapVersion(v => v + 1);
    }
    setIsRunning(false);
    setTimeout(() => setView('result'), 800);
  };

  const handleNodeSelect = (id: string | null) => {
     setSelectedNodeId(id);
     if (id) setPanelTab('content');
  };

  const handleUpdateNode = (updated: NodeData) => setNodes(prev => prev.map(n => n.id === updated.id ? updated : n));

  const handleCreateNode = (parentId: string, label: string) => {
    const parentNode = nodes.find(n => n.id === parentId);
    if (!parentNode) return null;
    const newNodeId = `node-${Date.now()}`;
    const newNode: NodeData = {
      id: newNodeId,
      type: NodeType.AGENT,
      label: label.substring(0, 25),
      x: parentNode.x + 350,
      y: parentNode.y + (Math.random() * 200 - 100),
      config: { status: 'planned', model: 'gemini-3-flash-preview', prompt: `Process child task: ${label}` }
    };
    setNodes(prev => [...prev, newNode]);
    setEdges(prev => [...prev, { id: `edge-${Date.now()}`, source: parentId, target: newNodeId }]);
    return newNodeId;
  };

  const handleStartMeeting = (nodeId: string) => {
     setSelectedNodeId(nodeId);
     setPanelTab('meetings');
     if (resultMode !== 'workflow') setResultMode('workflow');
  };
  
  const handleRecordingStateChange = (isRecording: boolean) => setRecordingNodeId(isRecording ? selectedNodeId : null);
  const handleLogout = () => {
     localStorage.removeItem('agent_builder_user');
     setView('landing');
  };

  if (view === 'landing') {
     return <LandingPage onStart={(input, model, opts) => {
        handleStart(input, model, opts);
     }} />;
  }

  const currentUser = JSON.parse(localStorage.getItem('agent_builder_user') || '{"name": "Guest"}');

  return (
    <div className="min-h-screen bg-[#09090B] text-[#E3E3E3] font-sans flex flex-col">
      <header className="h-16 px-6 border-b border-[#27272A] flex items-center justify-between shrink-0 z-50 bg-[#09090B]/80 backdrop-blur-xl sticky top-0 shadow-lg">
        <div className="flex items-center gap-6">
          <div className="w-8 h-8 bg-[#A8C7FA] text-[#062E6F] font-bold flex items-center justify-center rounded-lg cursor-pointer" onClick={() => setView('input')}>A</div>
          <div className="relative">
            <button onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)} className="flex flex-col items-start group">
              <span className="text-sm font-bold truncate max-w-[150px] group-hover:text-white transition-colors">{projectName}</span>
              <span className="text-[10px] text-zinc-500 uppercase flex items-center gap-1 font-black">
                {currentProjectId ? 'SAVED' : 'DRAFT'} <ChevronDown size={10} className={isProjectDropdownOpen ? 'rotate-180' : ''} />
              </span>
            </button>
            {isProjectDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-[#1E1F20] border border-[#3C4043] rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="p-2 border-b border-[#3C4043] flex items-center justify-between bg-black/20">
                   <span className="text-[10px] font-black text-zinc-500 ml-2 uppercase">My Roadmaps</span>
                   <button onClick={handleNewProject} className="p-1.5 text-indigo-400 hover:bg-white/5 rounded-md"><Plus size={16} /></button>
                </div>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  {projects.length === 0 ? <p className="p-8 text-center text-xs text-zinc-600 italic">No stored roadmaps</p> : projects.map(p => (
                    <div key={p.id} onClick={() => handleLoadProject(p)} className={`flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors border-l-2 ${currentProjectId === p.id ? 'bg-indigo-500/10 border-indigo-500' : 'border-transparent'}`}>
                       <div className="flex flex-col min-w-0 pr-4">
                          <span className={`text-xs font-bold truncate ${currentProjectId === p.id ? 'text-indigo-400' : 'text-zinc-300'}`}>{p.name}</span>
                          <span className="text-[9px] text-zinc-600">{new Date(p.updatedAt).toLocaleDateString()}</span>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {view === 'result' && (
           <div className="flex items-center bg-[#1E1F20] rounded-lg p-0.5 border border-[#27272A] shadow-inner">
               <button onClick={() => setResultMode('roadmap')} className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-md flex items-center gap-2 transition-all ${resultMode === 'roadmap' ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}><LayoutTemplate size={14} /> Roadmap</button>
               <button onClick={() => setResultMode('workflow')} className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-md flex items-center gap-2 transition-all ${resultMode === 'workflow' ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}><Workflow size={14} /> Workflow</button>
           </div>
        )}

        <div className="flex items-center gap-4">
          <button onClick={() => setIsChatOpen(!isChatOpen)} className={`p-2 rounded-full transition-all ${isChatOpen ? 'bg-indigo-600 text-white' : 'bg-[#1E1F20] text-zinc-400 border border-[#27272A] hover:text-white'}`}>
             <MessageSquare size={18} />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1E1F20] border border-[#27272A]">
            <div className="w-5 h-5 bg-[#10B981] rounded-full flex items-center justify-center text-[8px] font-bold text-black ring-2 ring-emerald-500/20">{currentUser.name?.[0] || 'U'}</div>
            <button onClick={handleLogout} className="ml-2 text-zinc-600 hover:text-rose-400 transition-colors"><LogOut size={14} /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {view === 'input' && <ProjectInput onStart={handleStart} projects={projects} onLoadProject={handleLoadProject} />}
        {view === 'executing' && <GenerationProgress logs={logs} isRunning={isRunning} onViewRoadmap={() => setView('result')} />}
        {view === 'result' && (
            <div className="h-full flex overflow-hidden">
               <div className="flex-1 relative overflow-hidden">
                  {resultMode === 'roadmap' ? (
                     currentRoadmap ? <RoadmapVisualizer key={roadmapVersion} data={currentRoadmap} onChange={setCurrentRoadmap} onSave={handleSaveProject} onBack={() => setView('input')} /> : 
                     <div className="h-full flex flex-col items-center justify-center space-y-6"><AlertTriangle size={32} className="text-amber-500" /><h3 className="text-xl font-bold">Incomplete Data Model</h3><button onClick={() => setView('input')} className="px-8 py-3 bg-white text-black rounded-full font-bold uppercase text-xs">Return to Input</button></div>
                  ) : (
                     <Canvas nodes={nodes} edges={edges} selectedNodeId={selectedNodeId} recordingNodeId={recordingNodeId} onNodeSelect={handleNodeSelect} onNodesChange={setNodes} onStartMeeting={handleStartMeeting} />
                  )}
               </div>
               
               <PropertiesPanel 
                 isOpen={!!selectedNodeId} 
                 onClose={() => setSelectedNodeId(null)} 
                 node={nodes.find(n => n.id === selectedNodeId) || null} 
                 onUpdate={handleUpdateNode} 
                 onCreateNode={handleCreateNode} 
                 onRecordingStateChange={handleRecordingStateChange} 
                 initialTab={panelTab} 
               />

               <ChatPanel 
                 isOpen={isChatOpen} 
                 onClose={() => setIsChatOpen(false)} 
                 nodes={nodes} 
                 edges={edges} 
                 selectedNodeId={selectedNodeId} 
                 onUpdateNode={handleUpdateNode} 
                 onCreateNode={handleCreateNode} 
                 onNavigate={(id) => {
                    setSelectedNodeId(id);
                    setResultMode('workflow');
                 }} 
               />
            </div>
        )}
      </main>
    </div>
  );
}
