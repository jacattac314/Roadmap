
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NodeData, Edge, NodeType, ExecutionLog, Project, RoadmapData } from './types';
import { INITIAL_NODES, INITIAL_EDGES, MARS_ROVER_PROJECT } from './constants';
import { ProjectInput } from './components/ProjectInput';
import { GenerationProgress } from './components/GenerationProgress';
import { RoadmapVisualizer } from './components/RoadmapVisualizer';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { generateAgentResponse } from './services/geminiService';
import { parseRoadmapData } from './utils/roadmapParser';
import { User, LogOut, ChevronDown, Plus, FolderOpen, Check, AlertTriangle, Clock, Trash2, LayoutTemplate, Workflow } from 'lucide-react';

type AppState = 'input' | 'executing' | 'result';
type ViewMode = 'roadmap' | 'workflow';

const STORAGE_KEY = 'roadmap_gen_projects';

export default function App() {
  const [view, setView] = useState<AppState>('input');
  // Sub-view mode for 'result' state
  const [resultMode, setResultMode] = useState<ViewMode>('roadmap');
  
  const [nodes, setNodes] = useState<NodeData[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [projectName, setProjectName] = useState('New Roadmap');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  
  // Workflow Editor State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [recordingNodeId, setRecordingNodeId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<'details' | 'content' | 'meetings' | undefined>(undefined);
  
  // State for the editable roadmap data
  const [currentRoadmap, setCurrentRoadmap] = useState<RoadmapData | null>(null);
  // Version key to force visualizer remount on new projects
  const [roadmapVersion, setRoadmapVersion] = useState(0);

  // Persistence and Demo Loading
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    let loadedProjects: Project[] = [];
    if (saved) {
      try { loadedProjects = JSON.parse(saved); } catch (e) { console.error(e); }
    }
    
    // Inject the demo project if it's not already in the list
    const hasDemo = loadedProjects.some(p => p.id === MARS_ROVER_PROJECT.id);
    if (!hasDemo) {
        loadedProjects.unshift(MARS_ROVER_PROJECT);
    }
    
    setProjects(loadedProjects);
  }, []);

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
        updated[existingIdx] = newProject;
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
    
    // Load persisted roadmap data if available, otherwise try to parse from logs
    if (project.roadmapData) {
      setCurrentRoadmap(project.roadmapData);
    } else {
      // Fallback for older projects
      const extractLog = project.logs.find(l => l.nodeLabel === 'Extract & Prioritize' && l.status === 'success');
      const planLog = project.logs.find(l => l.nodeLabel === 'Plan & Intelligence' && l.status === 'success');
      if (extractLog?.output && planLog?.output) {
         setCurrentRoadmap(parseRoadmapData(extractLog.output, planLog.output));
      } else {
         setCurrentRoadmap(null);
      }
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

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== id);
      saveToLocalStorage(updated);
      return updated;
    });
    if (currentProjectId === id) {
      handleNewProject();
    }
  };

  const handleStart = async (input: string, model: string = 'gemini-3-flash-preview', options: { useSearch: boolean, useThinking: boolean }) => {
    const name = input.substring(0, 30) + (input.length > 30 ? '...' : '');
    setProjectName(name);
    setView('executing');
    setIsRunning(true);
    setLogs([]);
    setCurrentRoadmap(null);

    const updatedNodes = nodes.map(n => {
      if (n.id === 'trigger-input') {
        return { ...n, config: { ...n.config, inputType: 'text' as const, staticInput: input } };
      }
      if (n.type === NodeType.AGENT) {
        let nodeModel = model;
        let thinkingBudget = 0;
        let useSearch = n.config.useSearch; // preserve default setting from node config

        // Enhanced Logic for "Plan & Intelligence" Node
        // This node handles complex logic, so we apply Thinking and Search here specifically if enabled.
        if (n.id === 'agent-plan') {
           useSearch = options.useSearch; // Enable search if requested
           
           if (options.useThinking) {
              // If Thinking is enabled, upgrade to Gemini 3 Pro and allocate budget
              nodeModel = 'gemini-3-pro-preview';
              thinkingBudget = 32768; 
           }
        }

        return { 
           ...n, 
           config: { 
             ...n.config, 
             model: nodeModel, 
             useSearch: useSearch,
             thinkingBudget: thinkingBudget
           } 
        };
      }
      return n;
    });
    setNodes(updatedNodes);

    const context: Record<string, any> = {};
    const executionOrder = updatedNodes.slice(0, 5);
    const localLogs: ExecutionLog[] = [];

    for (const node of executionOrder) {
      const logEntry: ExecutionLog = {
        nodeId: node.id,
        nodeLabel: node.label,
        status: 'running',
        timestamp: Date.now()
      };
      // Optimistic update for UI
      setLogs(prev => [...prev, logEntry]);
      localLogs.push(logEntry);

      try {
        if (node.type === NodeType.TRIGGER) {
          context['userInput'] = { text: input };
          logEntry.status = 'success';
          logEntry.output = input;
        } else if (node.type === NodeType.AGENT) {
          const prompt = node.config.prompt || '';
          const interpolatedPrompt = prompt.replace(/{{([^}]+)}}/g, (_, key) => context[key.trim()]?.text || '');
          
          const result = await generateAgentResponse({
            modelName: node.config.model || 'gemini-3-flash-preview',
            contents: [{ text: interpolatedPrompt }],
            systemInstruction: node.config.systemInstruction,
            useSearch: node.config.useSearch,
            thinkingBudget: node.config.thinkingBudget
          });

          if (result.error) throw new Error(result.error);
          
          context[node.config.outputVar || 'output'] = { text: result.text };
          logEntry.status = 'success';
          logEntry.output = result.text;
        }
        
        // Update both local and state logs
        const updatedEntry = { ...logEntry };
        setLogs(prev => prev.map(l => l.nodeId === node.id ? updatedEntry : l));
        const localIndex = localLogs.findIndex(l => l.nodeId === node.id);
        if (localIndex >= 0) localLogs[localIndex] = updatedEntry;

        await new Promise(r => setTimeout(r, 1200));
      } catch (err: any) {
        logEntry.status = 'error';
        logEntry.output = err.message;
        setLogs(prev => prev.map(l => l.nodeId === node.id ? { ...logEntry } : l));
        setIsRunning(false);
        return;
      }
    }

    // Generation Complete: Parse and set roadmap data
    const extractLog = localLogs.find(l => l.nodeLabel === 'Extract & Prioritize' && l.status === 'success');
    const planLog = localLogs.find(l => l.nodeLabel === 'Plan & Intelligence' && l.status === 'success');
    
    if (extractLog?.output && planLog?.output) {
       const parsed = parseRoadmapData(extractLog.output, planLog.output);
       setCurrentRoadmap(parsed);
       setRoadmapVersion(v => v + 1);
    }

    setIsRunning(false);
    setTimeout(() => {
      setView('result');
      // Auto-save initial version
    }, 1000);
  };

  const handleLogout = () => {
    localStorage.removeItem('agent_builder_user');
    window.location.reload();
  };

  const handleNodeSelect = (id: string | null) => {
     setSelectedNodeId(id);
     // Default back to content tab when normally clicking nodes, unless it's a deselect
     if (id) setPanelTab('content');
  };

  const handleUpdateNode = (updated: NodeData) => {
    setNodes(prev => prev.map(n => n.id === updated.id ? updated : n));
  };

  const handleCreateNode = (parentId: string, label: string) => {
    const parentNode = nodes.find(n => n.id === parentId);
    if (!parentNode) return null;

    const newNodeId = `node-${Date.now()}`;
    const newNode: NodeData = {
      id: newNodeId,
      type: NodeType.AGENT,
      label: label.length > 25 ? label.substring(0, 25) + '...' : label,
      x: parentNode.x + 350,
      y: parentNode.y + (Math.random() * 200 - 100),
      description: `Subtask extracted from ${parentNode.label}: ${label}`,
      config: {
        status: 'planned',
        model: 'gemini-3-flash-preview',
        prompt: `Execute subtask: ${label}\nContext from parent: ${parentNode.config.prompt || ''}`
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

  const handleStartMeeting = (nodeId: string) => {
     setSelectedNodeId(nodeId);
     setPanelTab('meetings');
     // Ensure we are in workflow view if not already
     if (resultMode !== 'workflow') {
        setResultMode('workflow');
     }
  };
  
  const handleRecordingStateChange = (isRecording: boolean) => {
     if (isRecording) {
        setRecordingNodeId(selectedNodeId);
     } else {
        setRecordingNodeId(null);
     }
  };

  const currentUser = JSON.parse(localStorage.getItem('agent_builder_user') || '{"name": "Guest"}');

  return (
    <div className="min-h-screen bg-[#09090B] text-[#E3E3E3] font-sans flex flex-col">
      {/* Dynamic Header */}
      <header className={`h-16 px-4 md:px-6 border-b border-[#27272A] flex items-center justify-between shrink-0 z-50 bg-[#09090B] ${view === 'result' ? 'sticky top-0 shadow-lg' : ''}`}>
        <div className="flex items-center gap-4 md:gap-6">
          <div 
            className="w-8 h-8 bg-[#A8C7FA] text-[#062E6F] font-bold flex items-center justify-center rounded-lg cursor-pointer hover:scale-105 transition-transform"
            onClick={() => setView('input')}
          >
            A
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
              className="flex flex-col items-start group"
            >
              <span className="text-sm font-bold text-zinc-200 max-w-[150px] md:max-w-xs truncate">{projectName}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest flex items-center gap-1 font-black">
                <span className="hidden xs:inline">{currentProjectId ? 'SAVED STRATEGY' : 'DRAFT ROADMAP'}</span>
                <span className="xs:hidden">ROADMAP</span>
                <ChevronDown size={10} className={`transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>

            {isProjectDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-[#1E1F20] border border-[#3C4043] rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-2 border-b border-[#3C4043] flex items-center justify-between bg-black/20">
                   <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-2">My Roadmaps</span>
                   <button 
                     onClick={handleNewProject}
                     className="p-1.5 hover:bg-white/5 rounded-lg text-indigo-400"
                   >
                     <Plus size={16} />
                   </button>
                </div>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  {projects.length === 0 ? (
                    <div className="p-8 text-center text-zinc-600">
                       <FolderOpen size={24} className="mx-auto mb-2 opacity-20" />
                       <p className="text-xs">No saved roadmaps yet</p>
                    </div>
                  ) : (
                    projects.map(p => (
                      <div 
                        key={p.id}
                        onClick={() => handleLoadProject(p)}
                        className={`group flex items-center justify-between p-3 cursor-pointer border-b border-white/[0.03] hover:bg-white/5 transition-colors ${currentProjectId === p.id ? 'bg-indigo-500/10' : ''}`}
                      >
                         <div className="flex flex-col min-w-0 pr-4">
                            <span className={`text-xs font-bold truncate ${currentProjectId === p.id ? 'text-indigo-400' : 'text-zinc-300'}`}>{p.name}</span>
                            <span className="text-[9px] text-zinc-600 flex items-center gap-1">
                               <Clock size={8} /> {new Date(p.updatedAt).toLocaleDateString()}
                            </span>
                         </div>
                         <button 
                           onClick={(e) => handleDeleteProject(e, p.id)}
                           className="p-1.5 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-500 transition-all"
                         >
                            <Trash2 size={12} />
                         </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {view === 'result' && (
           <div className="flex items-center bg-[#1E1F20] rounded-lg p-0.5 border border-[#27272A]">
               <button 
                  onClick={() => setResultMode('roadmap')}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md flex items-center gap-2 transition-all ${resultMode === 'roadmap' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
               >
                  <LayoutTemplate size={12} /> Roadmap
               </button>
               <button 
                  onClick={() => setResultMode('workflow')}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md flex items-center gap-2 transition-all ${resultMode === 'workflow' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
               >
                  <Workflow size={12} /> Workflow
               </button>
           </div>
        )}

        <div className="flex items-center gap-4">
          {view === 'result' && (
            <button 
              onClick={handleSaveProject}
              className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all flex items-center gap-2"
            >
              <FolderOpen size={12} /> <span className="hidden sm:inline">Save</span>
            </button>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1E1F20] border border-[#27272A]">
            <div className="w-5 h-5 bg-[#10B981] rounded-full flex items-center justify-center text-[8px] font-bold text-black">
              {currentUser.name?.[0] || 'U'}
            </div>
            <span className="text-xs font-medium text-zinc-400 hidden md:inline">{currentUser.name}</span>
            <button onClick={handleLogout} className="ml-2 hover:text-white transition-colors text-zinc-600">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 overflow-hidden relative">
        {view === 'input' && <ProjectInput onStart={handleStart} projects={projects} onLoadProject={handleLoadProject} />}
        {view === 'executing' && <GenerationProgress logs={logs} isRunning={isRunning} onViewRoadmap={() => setView('result')} />}
        {view === 'result' && (
            <>
               {resultMode === 'roadmap' ? (
                  currentRoadmap ? (
                    <RoadmapVisualizer 
                        key={roadmapVersion} 
                        data={currentRoadmap} 
                        onChange={setCurrentRoadmap}
                        onSave={handleSaveProject}
                        onBack={() => setView('input')} 
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center space-y-6 px-10 text-center">
                        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500">
                            <AlertTriangle size={32} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold">Incomplete Data</h3>
                            <p className="text-zinc-500 text-sm">We couldn't generate a visual timeline because the required plan data is missing or corrupted.</p>
                        </div>
                        <button onClick={() => setView('input')} className="px-8 py-3 bg-white text-black rounded-full font-bold uppercase tracking-widest text-xs">Try Again</button>
                    </div>
                  )
               ) : (
                  <div className="h-full relative flex">
                      <div className="flex-1 relative">
                          <Canvas 
                             nodes={nodes}
                             edges={edges}
                             selectedNodeId={selectedNodeId}
                             recordingNodeId={recordingNodeId}
                             onNodeSelect={handleNodeSelect}
                             onNodesChange={setNodes}
                             onStartMeeting={handleStartMeeting}
                          />
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
                  </div>
               )}
            </>
        )}
      </main>
    </div>
  );
}
