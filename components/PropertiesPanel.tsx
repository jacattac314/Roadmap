
import React, { useRef, useState, useEffect } from 'react';
import { NodeData, NodeType, NodeSubtask, MeetingArtifact } from '../types';
import { MODEL_OPTIONS } from '../constants';
import { generateAgentResponse } from '../services/geminiService';
import { X, Settings, FileText, Upload, Link, Plus, CheckSquare, Calendar, User, ArrowRight, Trash2, Brain, CheckCircle2, Sparkles, Loader2, GitBranch, Video, Mic, StopCircle, Clock, ChevronDown, ChevronRight, MessageSquare, AlertCircle } from 'lucide-react';

interface PropertiesPanelProps {
  node: NodeData | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedNode: NodeData) => void;
  onCreateNode?: (parentId: string, label: string) => string | null;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ node, isOpen, onClose, onUpdate, onCreateNode }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'content' | 'meetings'>('content');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Meeting State
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [meetingTime, setMeetingTime] = useState(0);
  const [isProcessingMeeting, setIsProcessingMeeting] = useState(false);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);

  // Timer for active meeting
  useEffect(() => {
    let interval: any;
    if (isMeetingActive) {
      interval = setInterval(() => {
        setMeetingTime(prev => prev + 1);
      }, 1000);
    } else {
      setMeetingTime(0);
    }
    return () => clearInterval(interval);
  }, [isMeetingActive]);

  if (!node) return null;

  const handleChange = (field: string, value: any) => {
    const updatedNode = {
      ...node,
      config: {
        ...node.config,
        [field]: value
      }
    };
    onUpdate(updatedNode);
  };

  const handleLabelChange = (value: string) => {
    onUpdate({ ...node, label: value });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        onUpdate({
          ...node,
          config: {
            ...node.config,
            inputType: 'file',
            fileName: file.name,
            fileMimeType: file.type,
            fileData: base64String
          }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    const currentUrls = node.config.contentUrls || [];
    handleChange('contentUrls', [...currentUrls, urlInput]);
    setUrlInput('');
  };

  const removeUrl = (idx: number) => {
    const currentUrls = node.config.contentUrls || [];
    const newUrls = [...currentUrls];
    newUrls.splice(idx, 1);
    handleChange('contentUrls', newUrls);
  };

  // --- Subtask Logic ---
  const toggleSubtask = (idx: number) => {
    const subtasks = [...(node.config.subtasks || [])];
    subtasks[idx].isCompleted = !subtasks[idx].isCompleted;
    handleChange('subtasks', subtasks);
  };

  const updateSubtask = (idx: number, field: keyof NodeSubtask, value: any) => {
    const subtasks = [...(node.config.subtasks || [])];
    subtasks[idx] = { ...subtasks[idx], [field]: value };
    handleChange('subtasks', subtasks);
  };

  const deleteSubtask = (idx: number) => {
    const subtasks = [...(node.config.subtasks || [])];
    subtasks.splice(idx, 1);
    handleChange('subtasks', subtasks);
  };

  const convertSubtaskToNode = (idx: number) => {
    const subtasks = [...(node.config.subtasks || [])];
    const subtask = subtasks[idx];
    if (onCreateNode && !subtask.convertedNodeId) {
       const newNodeId = onCreateNode(node.id, subtask.text);
       if (newNodeId) {
         updateSubtask(idx, 'convertedNodeId', newNodeId);
       }
    }
  };

  // --- AI Analysis Logic ---
  const handleAnalyzeContent = async () => {
    setIsAnalyzing(true);
    try {
      let contentText = "";
      if (node.config.staticInput) contentText += `\nText Input: ${node.config.staticInput}`;
      if (node.config.contentUrls?.length) contentText += `\nURLs: ${node.config.contentUrls.join(', ')}`;
      if (node.config.fileName) contentText += `\nFile: ${node.config.fileName} (Assume file content is context)`;
      
      if (!contentText.trim()) {
        alert("Please add some text, a file, or a URL to analyze.");
        setIsAnalyzing(false);
        return;
      }

      const prompt = `
        Analyze the provided content to assist with project planning.
        1. Write a concise **Summary** (max 50 words) highlighting key decisions, specific constraints, and potential risks.
        2. Extract a list of **Actionable Subtasks**.
        
        Content to Analyze:
        ${contentText}

        Output strictly in JSON format:
        {
          "summary": "Concise summary string...",
          "subtasks": [
            { "text": "Actionable task description", "assignee": "Role/Name (optional)", "dueDate": "YYYY-MM-DD (optional)" }
          ]
        }
      `;

      const response = await generateAgentResponse({
        modelName: 'gemini-3-flash-preview',
        contents: [{ text: prompt }],
      });

      if (response.text) {
         try {
            const cleanText = response.text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
            const firstBrace = cleanText.indexOf('{');
            const lastBrace = cleanText.lastIndexOf('}');
            const json = JSON.parse(cleanText.substring(firstBrace, lastBrace + 1));
            
            const newSubtasks: NodeSubtask[] = (json.subtasks || []).map((t: any) => ({
                id: `st-${Date.now()}-${Math.random()}`,
                text: t.text,
                isCompleted: false,
                assignee: t.assignee || '',
                dueDate: t.dueDate || ''
            }));

            handleChange('summary', json.summary);
            handleChange('subtasks', [...(node.config.subtasks || []), ...newSubtasks]);
         } catch (e) {
            console.error("Failed to parse analysis", e);
            alert("Could not parse AI response. Check console for raw output.");
         }
      }

    } catch (err) {
      console.error(err);
      alert("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Meeting Logic ---
  const handleLaunchMeeting = () => {
    setIsMeetingActive(true);
  };

  const handleEndMeeting = async () => {
    setIsMeetingActive(false);
    setIsProcessingMeeting(true);

    try {
      // Aggregate context for the meeting simulation
      let context = `Node Label: ${node.label}\nDescription: ${node.description || 'N/A'}`;
      if (node.config.summary) context += `\nCurrent Summary: ${node.config.summary}`;
      if (node.config.subtasks) context += `\nPending Tasks: ${node.config.subtasks.filter(t => !t.isCompleted).map(t => t.text).join(', ')}`;
      if (node.config.staticInput) context += `\nInputs: ${node.config.staticInput}`;

      const prompt = `
        Simulate a transcript and artifacts for a product meeting that just finished regarding this topic.
        
        Context:
        ${context}

        Task:
        1. Generate a realistic **Transcript** (dialogue format) between PM, Eng, and Design (approx 10-15 lines).
        2. Generate a **Summary** of the discussion.
        3. List **Key Decisions** made.
        4. List **Action Items**.

        Output strictly in JSON format:
        {
          "title": "Meeting Title (e.g. 'Kickoff', 'Review')",
          "transcript": "Speaker: text\\nSpeaker: text...",
          "summary": "concise summary",
          "decisions": ["decision 1", "decision 2"],
          "actionItems": ["action 1", "action 2"]
        }
      `;

      const response = await generateAgentResponse({
        modelName: 'gemini-3-flash-preview',
        contents: [{ text: prompt }],
      });

      if (response.text) {
        try {
          const cleanText = response.text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
          const firstBrace = cleanText.indexOf('{');
          const lastBrace = cleanText.lastIndexOf('}');
          const json = JSON.parse(cleanText.substring(firstBrace, lastBrace + 1));

          const newMeeting: MeetingArtifact = {
            id: `mtg-${Date.now()}`,
            timestamp: Date.now(),
            title: json.title || 'Ad-hoc Sync',
            duration: `${Math.floor(meetingTime / 60)}m ${meetingTime % 60}s`,
            transcript: json.transcript || '',
            summary: json.summary || '',
            decisions: json.decisions || [],
            actionItems: json.actionItems || []
          };

          handleChange('meetings', [newMeeting, ...(node.config.meetings || [])]);
          setExpandedMeetingId(newMeeting.id); // Auto-expand the new meeting
        } catch (e) {
          console.error("Failed to parse meeting artifacts", e);
        }
      }

    } catch (err) {
      console.error(err);
      alert("Failed to process meeting artifacts.");
    } finally {
      setIsProcessingMeeting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  return (
    <div className={`fixed right-0 top-16 bottom-0 w-[500px] bg-cream border-l-2 border-slate shadow-2xl transform transition-transform duration-300 ease-in-out z-20 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b-2 border-slate bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal text-white border-2 border-slate shadow-hard-sm">
             <Settings size={18} />
          </div>
          <div>
             <input
              type="text"
              value={node.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              className="bg-transparent border-b border-transparent hover:border-slate focus:border-teal outline-none font-bold text-slate text-lg w-64"
            />
            <p className="text-[10px] uppercase font-bold text-slate/50 tracking-widest">{node.type}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate hover:text-terra transition-colors p-1">
          <X size={24} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-slate bg-cream">
         <button 
           onClick={() => setActiveTab('content')}
           className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${activeTab === 'content' ? 'bg-cream text-teal border-b-2 border-teal -mb-[2px]' : 'bg-white text-slate/50 hover:bg-cream'}`}
         >
           <FileText size={14} /> Content
         </button>
         <button 
           onClick={() => setActiveTab('meetings')}
           className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${activeTab === 'meetings' ? 'bg-cream text-teal border-b-2 border-teal -mb-[2px]' : 'bg-white text-slate/50 hover:bg-cream'}`}
         >
           <Video size={14} /> Meetings
         </button>
         <button 
           onClick={() => setActiveTab('details')}
           className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${activeTab === 'details' ? 'bg-cream text-teal border-b-2 border-teal -mb-[2px]' : 'bg-white text-slate/50 hover:bg-cream'}`}
         >
           <Settings size={14} /> Config
         </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-cream custom-scrollbar relative">
        
        {/* ACTIVE MEETING OVERLAY (If Meeting is Running) */}
        {isMeetingActive && (
           <div className="absolute inset-0 bg-slate/90 z-50 flex flex-col items-center justify-center text-white p-8 space-y-8 backdrop-blur-sm">
              <div className="w-24 h-24 rounded-full border-4 border-teal flex items-center justify-center bg-slate relative">
                 <div className="absolute inset-0 rounded-full border-4 border-teal animate-ping opacity-30"></div>
                 <Mic size={40} className="text-teal" />
              </div>
              
              <div className="text-center">
                 <h3 className="text-2xl font-bold font-mono tracking-widest">{formatTime(meetingTime)}</h3>
                 <p className="text-sm text-teal font-bold uppercase tracking-wide mt-2">Recording in progress...</p>
                 <p className="text-xs text-white/50 mt-1">Google Meet Connected</p>
              </div>

              <div className="flex gap-4">
                 <button 
                   onClick={handleEndMeeting}
                   className="px-8 py-3 bg-terra text-white font-bold uppercase tracking-widest border-2 border-white/20 hover:bg-red-600 transition-colors flex items-center gap-2"
                 >
                    <StopCircle size={18} /> End Meeting
                 </button>
              </div>
           </div>
        )}

        {activeTab === 'content' && (
          <>
            {/* 1. UPLOAD & INPUT */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate uppercase tracking-widest">Source Material</h3>
                <span className="text-[10px] bg-slate/10 px-2 py-1 rounded text-slate/60">Files, URLs, Text</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                 {/* File Upload Area */}
                 <div 
                   onClick={() => fileInputRef.current?.click()}
                   className="col-span-2 border-2 border-dashed border-slate bg-white hover:bg-teal/5 transition-colors cursor-pointer p-4 flex flex-col items-center justify-center gap-2 group"
                 >
                    <div className="p-2 rounded-full bg-cream border border-slate group-hover:border-teal group-hover:text-teal transition-colors">
                       <Upload size={16} />
                    </div>
                    <span className="text-xs font-bold text-slate truncate max-w-full px-2">
                       {node.config.fileName || 'Drop files or click to upload'}
                    </span>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.pdf,.docx,.md" onChange={handleFileUpload} />
                 </div>

                 {/* Text Input */}
                 <textarea
                    rows={4}
                    value={node.config.staticInput || ''}
                    onChange={(e) => handleChange('staticInput', e.target.value)}
                    className="col-span-2 w-full px-3 py-2 bg-white border-2 border-slate text-xs font-mono focus:border-teal resize-none"
                    placeholder="Paste project requirements, emails, or notes..."
                  />

                 {/* URL Input */}
                 <div className="col-span-2 flex gap-2">
                   <div className="flex-1 flex items-center bg-white border-2 border-slate px-2">
                      <Link size={14} className="text-slate/50 mr-2" />
                      <input 
                        type="text" 
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="Add reference URL..."
                        className="flex-1 py-2 text-xs outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                      />
                   </div>
                   <button onClick={handleAddUrl} className="px-3 bg-slate text-white border-2 border-slate hover:bg-teal transition-colors">
                      <Plus size={16} />
                   </button>
                 </div>
                 
                 {/* URL List */}
                 {node.config.contentUrls?.map((url, idx) => (
                    <div key={idx} className="col-span-2 flex items-center justify-between bg-teal/10 border border-teal/30 px-3 py-1.5 rounded-sm">
                       <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-teal hover:underline truncate flex-1">{url}</a>
                       <button onClick={() => removeUrl(idx)} className="text-slate/50 hover:text-terra ml-2"><X size={12} /></button>
                    </div>
                 ))}
              </div>

              {/* GENERATE BUTTON */}
              <button 
                onClick={handleAnalyzeContent}
                disabled={isAnalyzing}
                className="w-full py-3 bg-teal text-white font-bold uppercase tracking-widest border-2 border-slate shadow-hard hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} className="group-hover:scale-110 transition-transform" />}
                {isAnalyzing ? 'Analyzing...' : 'Generate Summary & Tasks'}
              </button>
            </div>

            <div className="border-t-2 border-slate/10" />

            {/* 2. SUMMARY (Auto-populated) */}
            <div className="space-y-3">
               <h3 className="text-xs font-bold text-terra uppercase tracking-widest flex items-center gap-2">
                  <Sparkles size={14} /> Key Decisions & Risks
               </h3>
               <textarea
                  rows={4}
                  value={node.config.summary || ''}
                  onChange={(e) => handleChange('summary', e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-slate text-xs leading-relaxed focus:border-terra"
                  placeholder="AI will generate a concise summary here..."
               />
            </div>

            {/* 3. SUBTASKS (Auto-populated) */}
            <div className="space-y-3">
               <div className="flex items-center justify-between">
                 <h3 className="text-xs font-bold text-slate uppercase tracking-widest flex items-center gap-2">
                    <CheckSquare size={14} /> Subtasks
                 </h3>
                 <button 
                   onClick={() => handleChange('subtasks', [...(node.config.subtasks || []), { id: Date.now().toString(), text: '', isCompleted: false }])}
                   className="text-[10px] font-bold bg-slate text-white px-2 py-1 flex items-center gap-1 hover:bg-teal transition-colors"
                 >
                    <Plus size={10} /> Add Item
                 </button>
               </div>
               
               <div className="space-y-2">
                  {(node.config.subtasks || []).map((task, idx) => (
                     <div key={task.id} className={`group p-3 border-2 border-slate bg-white hover:shadow-hard-sm transition-all ${task.isCompleted ? 'opacity-60 bg-gray-50' : ''}`}>
                        <div className="flex items-start gap-3 mb-2">
                           <input 
                             type="checkbox" 
                             checked={task.isCompleted} 
                             onChange={() => toggleSubtask(idx)}
                             className="mt-1 w-4 h-4 rounded-sm border-2 border-slate checked:bg-teal cursor-pointer" 
                           />
                           <textarea
                             rows={2}
                             value={task.text}
                             onChange={(e) => updateSubtask(idx, 'text', e.target.value)}
                             className={`flex-1 text-xs border-none p-0 bg-transparent focus:ring-0 resize-none ${task.isCompleted ? 'line-through text-slate/50' : 'text-slate font-medium'}`}
                             placeholder="Describe task..."
                           />
                           <button onClick={() => deleteSubtask(idx)} className="text-slate/20 hover:text-terra transition-colors"><Trash2 size={14} /></button>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate/10">
                           {/* Assignee */}
                           <div className="flex items-center gap-1 bg-cream px-2 py-1 border border-slate/20 rounded-sm">
                              <User size={10} className="text-slate/50" />
                              <input 
                                type="text" 
                                value={task.assignee || ''} 
                                onChange={(e) => updateSubtask(idx, 'assignee', e.target.value)}
                                placeholder="Unassigned" 
                                className="bg-transparent text-[10px] w-16 focus:outline-none placeholder:text-slate/30"
                              />
                           </div>
                           {/* Due Date */}
                           <div className="flex items-center gap-1 bg-cream px-2 py-1 border border-slate/20 rounded-sm">
                              <Calendar size={10} className="text-slate/50" />
                              <input 
                                type="text" 
                                value={task.dueDate || ''} 
                                onChange={(e) => updateSubtask(idx, 'dueDate', e.target.value)}
                                placeholder="Due Date" 
                                className="bg-transparent text-[10px] w-16 focus:outline-none placeholder:text-slate/30"
                              />
                           </div>
                           
                           <div className="flex-1" />
                           
                           {/* Convert to Node Action */}
                           {task.convertedNodeId ? (
                              <span className="text-[9px] font-bold text-teal flex items-center gap-1 bg-teal/10 px-2 py-1 rounded border border-teal/20">
                                 <CheckCircle2 size={10} /> LINKED NODE
                              </span>
                           ) : (
                              <button 
                                 onClick={() => convertSubtaskToNode(idx)}
                                 className="text-[9px] font-bold text-slate hover:text-white bg-slate/10 hover:bg-slate px-2 py-1 flex items-center gap-1 transition-colors rounded-sm"
                                 title="Convert this task to a new Agent Node"
                              >
                                 <GitBranch size={10} /> CONVERT TO NODE
                              </button>
                           )}
                        </div>
                     </div>
                  ))}
                  {(!node.config.subtasks || node.config.subtasks.length === 0) && (
                     <div className="text-center py-8 border-2 border-dashed border-slate/20 rounded">
                        <p className="text-xs text-slate/40 italic">No subtasks yet.</p>
                        <p className="text-[10px] text-slate/30 mt-1">Use "Generate" or add manually.</p>
                     </div>
                  )}
               </div>
            </div>
          </>
        )}

        {/* --- MEETINGS TAB --- */}
        {activeTab === 'meetings' && (
           <div className="space-y-6">
              
              {/* Launcher */}
              <div className="bg-white border-2 border-slate p-6 text-center space-y-4 shadow-hard-sm">
                 <div className="w-16 h-16 bg-teal/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Video size={32} className="text-teal" />
                 </div>
                 <div>
                    <h3 className="text-sm font-bold text-slate uppercase tracking-wider">Launch Node Meeting</h3>
                    <p className="text-xs text-slate/60 mt-1 px-4">Start a context-aware meeting for this specific workflow step.</p>
                 </div>
                 <button 
                   onClick={handleLaunchMeeting}
                   className="w-full py-3 bg-slate text-white font-bold uppercase tracking-widest hover:bg-teal transition-colors flex items-center justify-center gap-2"
                 >
                    <Video size={16} /> Start Meeting
                 </button>
                 <p className="text-[10px] text-slate/40">Synced with Google Meet</p>
              </div>

              {/* Loader for artifacts */}
              {isProcessingMeeting && (
                 <div className="p-4 bg-cream border border-teal/30 text-teal text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
                    <Loader2 size={14} className="animate-spin" /> Generating Meeting Artifacts...
                 </div>
              )}

              {/* History */}
              <div className="space-y-4">
                 <div className="flex items-center gap-2 pb-2 border-b border-slate/20">
                    <Clock size={14} className="text-slate/60" />
                    <h3 className="text-xs font-bold text-slate uppercase tracking-widest">Past Meetings</h3>
                 </div>

                 {(node.config.meetings || []).map((mtg) => (
                    <div key={mtg.id} className="border-2 border-slate bg-white group">
                       <div 
                         onClick={() => setExpandedMeetingId(expandedMeetingId === mtg.id ? null : mtg.id)}
                         className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                       >
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-cream border border-slate flex items-center justify-center text-slate font-bold text-[10px]">
                                {mtg.duration}
                             </div>
                             <div>
                                <h4 className="text-xs font-bold text-slate">{mtg.title}</h4>
                                <p className="text-[10px] text-slate/50">{new Date(mtg.timestamp).toLocaleString()}</p>
                             </div>
                          </div>
                          {expandedMeetingId === mtg.id ? <ChevronDown size={16} className="text-slate/40" /> : <ChevronRight size={16} className="text-slate/40" />}
                       </div>

                       {expandedMeetingId === mtg.id && (
                          <div className="p-4 border-t border-slate/10 bg-cream/30 space-y-4 text-xs">
                             {/* Transcript Snippet */}
                             <div>
                                <h5 className="font-bold text-slate uppercase text-[10px] mb-2 flex items-center gap-1"><MessageSquare size={10} /> Transcript Snippet</h5>
                                <div className="font-mono text-slate/70 bg-white p-2 border border-slate/10 max-h-32 overflow-y-auto whitespace-pre-wrap">
                                   {mtg.transcript}
                                </div>
                             </div>

                             {/* Summary */}
                             <div>
                                <h5 className="font-bold text-slate uppercase text-[10px] mb-1">Summary</h5>
                                <p className="text-slate leading-relaxed">{mtg.summary}</p>
                             </div>

                             {/* Decisions */}
                             <div>
                                <h5 className="font-bold text-terra uppercase text-[10px] mb-1">Key Decisions</h5>
                                <ul className="list-disc list-inside text-slate/80 space-y-1">
                                   {mtg.decisions.map((d, i) => <li key={i}>{d}</li>)}
                                </ul>
                             </div>

                             {/* Action Items */}
                             <div>
                                <h5 className="font-bold text-teal uppercase text-[10px] mb-1">Action Items</h5>
                                <ul className="space-y-1">
                                   {mtg.actionItems.map((item, i) => (
                                      <li key={i} className="flex items-start gap-2">
                                         <input type="checkbox" className="mt-0.5" />
                                         <span className="text-slate/80">{item}</span>
                                      </li>
                                   ))}
                                </ul>
                             </div>
                          </div>
                       )}
                    </div>
                 ))}

                 {(!node.config.meetings || node.config.meetings.length === 0) && (
                    <div className="text-center py-6 text-xs text-slate/40 italic">
                       No meetings recorded yet.
                    </div>
                 )}
              </div>
           </div>
        )}

        {activeTab === 'details' && (
           <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate uppercase tracking-wider mb-2">Description</label>
                <textarea
                  rows={4}
                  value={node.description || ''}
                  onChange={(e) => onUpdate({...node, description: e.target.value})}
                  className="w-full px-3 py-3 bg-white border-2 border-slate focus:border-teal text-sm text-slate"
                  placeholder="What is the purpose of this step?"
                />
              </div>

              {node.type === NodeType.AGENT && (
                <>
                  <div className="border-t-2 border-slate/10 pt-4">
                    <label className="block text-xs font-bold text-slate uppercase tracking-wider mb-2">Model Selection</label>
                    <select
                      value={node.config.model || 'gemini-3-flash-preview'}
                      onChange={(e) => handleChange('model', e.target.value)}
                      className="w-full px-3 py-3 border-2 border-slate bg-white text-sm font-bold text-slate"
                    >
                      {MODEL_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate uppercase tracking-wider mb-2">System Instructions</label>
                    <textarea
                      rows={4}
                      value={node.config.systemInstruction || ''}
                      onChange={(e) => handleChange('systemInstruction', e.target.value)}
                      className="w-full px-3 py-3 border-2 border-slate bg-white text-sm font-mono text-slate/80"
                      placeholder="Define the persona and rules for this agent..."
                    />
                  </div>
                </>
              )}
           </div>
        )}

      </div>
    </div>
  );
};
