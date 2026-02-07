
import React, { useRef, useState, useEffect } from 'react';
import { NodeData, NodeType, NodeSubtask, MeetingArtifact, Status } from '../types';
import { MODEL_OPTIONS } from '../constants';
import { generateAgentResponse, transcribeAudio } from '../services/geminiService';
import { X, Settings, FileText, Upload, Link, Plus, CheckSquare, Calendar, User, ArrowRight, Trash2, Brain, CheckCircle2, Sparkles, Loader2, GitBranch, Video, Mic, StopCircle, Clock, ChevronDown, ChevronRight, MessageSquare, AlertCircle, Ban, Activity } from 'lucide-react';

interface PropertiesPanelProps {
  node: NodeData | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedNode: NodeData) => void;
  onCreateNode?: (parentId: string, label: string) => string | null;
  onRecordingStateChange?: (isRecording: boolean) => void;
  initialTab?: 'details' | 'content' | 'meetings';
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ node, isOpen, onClose, onUpdate, onCreateNode, onRecordingStateChange, initialTab }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'content' | 'meetings'>('content');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Meeting State
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [meetingTime, setMeetingTime] = useState(0);
  const [isProcessingMeeting, setIsProcessingMeeting] = useState(false);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Watch for initialTab prop changes to switch tabs programmatically
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, node?.id]); 

  // Sync internal meeting state with parent
  useEffect(() => {
    if (onRecordingStateChange) {
      onRecordingStateChange(isMeetingActive);
    }
  }, [isMeetingActive]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
         mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
         if (onRecordingStateChange) onRecordingStateChange(false);
      }
    };
  }, []);

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
    if (onCreateNode && !subtask.convertedNodeId && !subtask.isCompleted) {
       const newNodeId = onCreateNode(node.id, subtask.text);
       if (newNodeId) {
         updateSubtask(idx, 'convertedNodeId', newNodeId);
       }
    }
  };

  const handleAnalyzeContent = async () => {
    setIsAnalyzing(true);
    try {
      let contentText = "";
      if (node.config.staticInput) contentText += `\nText Input: ${node.config.staticInput}`;
      if (node.config.contentUrls?.length) contentText += `\nURLs: ${node.config.contentUrls.join(', ')}`;
      if (node.config.fileName) contentText += `\nFile: ${node.config.fileName}`;
      
      if (!contentText.trim()) {
        alert("Please add some text, a file, or a URL to analyze.");
        setIsAnalyzing(false);
        return;
      }

      const prompt = `
        Analyze content for planning.
        1. Write a Summary (max 50 words).
        2. Extract Actionable Subtasks with Owners and Dates.
        
        Content:
        ${contentText}

        Output strictly JSON:
        {
          "summary": "...",
          "subtasks": [
            { "text": "Task", "assignee": "Role", "dueDate": "YYYY-MM-DD" }
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
            console.error(e);
         }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsMeetingActive(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isMeetingActive) {
      mediaRecorderRef.current.stop();
      setIsMeetingActive(false);
      setIsProcessingMeeting(true);

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64String = (reader.result as string).split(',')[1];
          const mimeType = audioBlob.type || 'audio/webm';
          
          try {
            const response = await transcribeAudio(base64String, mimeType);
            
            if (response.text) {
              const cleanText = response.text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
              const json = JSON.parse(cleanText.substring(cleanText.indexOf('{'), cleanText.lastIndexOf('}') + 1));
              
              const newMeeting: MeetingArtifact = {
                id: `mtg-${Date.now()}`,
                timestamp: Date.now(),
                title: json.summary ? `Recording: ${json.summary.substring(0, 30)}...` : 'Audio Recording',
                duration: `${Math.floor(meetingTime / 60)}m ${meetingTime % 60}s`,
                transcript: json.transcript || '',
                summary: json.summary || '',
                decisions: json.decisions || [],
                actionItems: json.actionItems || []
              };
              handleChange('meetings', [newMeeting, ...(node.config.meetings || [])]);
              setExpandedMeetingId(newMeeting.id);
            }
          } catch (e) {
            console.error("Transcription failed", e);
            alert("Failed to transcribe audio. Please try again.");
          } finally {
            setIsProcessingMeeting(false);
            // Stop all tracks to release microphone
            mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
          }
        };
      };
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const STATUS_OPTIONS: Status[] = ['planned', 'in_progress', 'completed', 'blocked', 'at_risk'];

  return (
    <div className={`fixed right-0 top-16 bottom-0 w-[500px] bg-cream border-l-2 border-slate shadow-2xl transform transition-transform duration-300 ease-in-out z-20 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
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

      <div className="flex border-b-2 border-slate bg-cream">
         <button onClick={() => setActiveTab('content')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${activeTab === 'content' ? 'bg-cream text-teal border-b-2 border-teal -mb-[2px]' : 'bg-white text-slate/50 hover:bg-cream'}`}><FileText size={14} /> Content</button>
         <button onClick={() => setActiveTab('meetings')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${activeTab === 'meetings' ? 'bg-cream text-teal border-b-2 border-teal -mb-[2px]' : 'bg-white text-slate/50 hover:bg-cream'}`}><Video size={14} /> Meetings</button>
         <button onClick={() => setActiveTab('details')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${activeTab === 'details' ? 'bg-cream text-teal border-b-2 border-teal -mb-[2px]' : 'bg-white text-slate/50 hover:bg-cream'}`}><Settings size={14} /> Config</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-cream custom-scrollbar relative">
        {(isMeetingActive || isProcessingMeeting) && (
           <div className="absolute inset-0 bg-slate/90 z-50 flex flex-col items-center justify-center text-white p-8 space-y-8 backdrop-blur-sm">
              <div className="w-24 h-24 rounded-full border-4 border-teal flex items-center justify-center bg-slate relative">
                 <div className={`absolute inset-0 rounded-full border-4 border-teal ${isMeetingActive ? 'animate-ping opacity-30' : ''}`}></div>
                 {isProcessingMeeting ? <Loader2 size={40} className="text-teal animate-spin" /> : <Mic size={40} className="text-teal" />}
              </div>
              <div className="text-center">
                 <h3 className="text-2xl font-bold font-mono tracking-widest">{isProcessingMeeting ? 'Processing...' : formatTime(meetingTime)}</h3>
                 <p className="text-sm text-teal font-bold uppercase tracking-wide mt-2">
                    {isProcessingMeeting ? 'Transcribing Audio' : 'Recording In Progress'}
                 </p>
              </div>
              {!isProcessingMeeting && (
                  <button onClick={handleStopRecording} className="px-8 py-3 bg-terra text-white font-bold uppercase tracking-widest border-2 border-white/20 hover:bg-red-600 transition-colors flex items-center gap-2">
                    <StopCircle size={18} /> Stop & Transcribe
                  </button>
              )}
           </div>
        )}
        {/* ... rest of component ... */}
        {activeTab === 'content' && (
          <>
            {/* Manual Node Metadata Section */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate uppercase tracking-widest flex items-center gap-2">
                 <Activity size={14} /> Manual Tracking
              </h3>
              <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate/40 uppercase tracking-widest ml-1">Stage Status</label>
                    <div className="relative">
                       <select 
                         value={node.config.status || 'planned'} 
                         onChange={(e) => handleChange('status', e.target.value)}
                         className="w-full bg-white border-2 border-slate text-xs font-bold px-3 py-2 rounded-none outline-none focus:border-teal appearance-none"
                       >
                          {STATUS_OPTIONS.map(opt => (
                             <option key={opt} value={opt}>{opt.replace('_', ' ').toUpperCase()}</option>
                          ))}
                       </select>
                       <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate" />
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate/40 uppercase tracking-widest ml-1">Target Date</label>
                    <div className="flex items-center bg-white border-2 border-slate px-3 py-2">
                       <Calendar size={14} className="text-slate/40 mr-2" />
                       <input 
                         type="text" 
                         placeholder="YYYY-MM-DD"
                         value={node.config.dueDate || ''}
                         onChange={(e) => handleChange('dueDate', e.target.value)}
                         className="flex-1 bg-transparent text-xs font-bold outline-none"
                       />
                    </div>
                 </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate uppercase tracking-widest">Source Material</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <div onClick={() => fileInputRef.current?.click()} className="col-span-2 border-2 border-dashed border-slate bg-white hover:bg-teal/5 transition-colors cursor-pointer p-4 flex flex-col items-center justify-center gap-2 group">
                    <Upload size={16} />
                    <span className="text-xs font-bold text-slate truncate max-w-full">{node.config.fileName || 'Upload project file'}</span>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.pdf,.docx,.md" onChange={handleFileUpload} />
                 </div>
                 <textarea rows={3} value={node.config.staticInput || ''} onChange={(e) => handleChange('staticInput', e.target.value)} className="col-span-2 w-full px-3 py-2 bg-white border-2 border-slate text-xs font-mono focus:border-teal resize-none" placeholder="Paste requirements..." />
                 <div className="col-span-2 flex gap-2">
                   <div className="flex-1 flex items-center bg-white border-2 border-slate px-2">
                      <Link size={14} className="text-slate/50 mr-2" />
                      <input type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="Reference URL..." className="flex-1 py-2 text-xs outline-none" onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()} />
                   </div>
                   <button onClick={handleAddUrl} className="px-3 bg-slate text-white border-2 border-slate hover:bg-teal transition-colors"><Plus size={16} /></button>
                 </div>
              </div>
              <button onClick={handleAnalyzeContent} disabled={isAnalyzing} className="w-full py-3 bg-teal text-white font-bold uppercase tracking-widest border-2 border-slate shadow-hard hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
                {isAnalyzing ? 'Analyzing...' : 'Analyze & Plan Step'}
              </button>
            </div>

            <div className="space-y-3">
               <h3 className="text-xs font-bold text-terra uppercase tracking-widest flex items-center gap-2"><Sparkles size={14} /> AI Analysis</h3>
               <textarea rows={3} value={node.config.summary || ''} onChange={(e) => handleChange('summary', e.target.value)} className="w-full px-4 py-3 bg-white border-2 border-slate text-xs leading-relaxed focus:border-terra" placeholder="Insights summary..." />
            </div>

            <div className="space-y-3 pb-20">
               <div className="flex items-center justify-between">
                 <h3 className="text-xs font-bold text-slate uppercase tracking-widest flex items-center gap-2"><CheckSquare size={14} /> Subtasks</h3>
                 <div className="flex gap-2">
                    <button 
                       onClick={() => handleChange('subtasks', [...(node.config.subtasks || []), { id: Date.now().toString(), text: '', isCompleted: false }])}
                       className="text-[10px] font-bold bg-slate text-white px-2 py-1 flex items-center gap-1 hover:bg-teal transition-colors rounded-sm"
                    >
                        <Plus size={10} /> Add Item
                    </button>
                 </div>
               </div>
               
               <div className="space-y-3">
                  {(node.config.subtasks || []).map((task, idx) => (
                     <div key={task.id} className={`group p-4 border-2 border-slate bg-white shadow-hard-sm transition-all ${task.isCompleted ? 'opacity-60 grayscale-[0.5]' : ''} ${task.isBlocked ? 'border-terra/40 bg-terra/5' : ''}`}>
                        <div className="flex items-start gap-3">
                           <button 
                             onClick={() => toggleSubtask(idx)}
                             className={`mt-1 flex-shrink-0 w-5 h-5 border-2 border-slate flex items-center justify-center transition-colors ${task.isCompleted ? 'bg-teal text-white' : 'bg-white text-transparent hover:text-teal/30'}`}
                           >
                              {task.isCompleted ? <CheckCircle2 size={12} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-current" />}
                           </button>
                           
                           <div className="flex-1 space-y-3">
                              <textarea
                                rows={1}
                                value={task.text}
                                onChange={(e) => updateSubtask(idx, 'text', e.target.value)}
                                className={`w-full text-xs font-bold border-none p-0 bg-transparent focus:ring-0 resize-none ${task.isCompleted ? 'line-through text-slate/40' : 'text-slate'}`}
                                placeholder="Task description..."
                                style={{ height: 'auto' }}
                              />
                              
                              <div className="grid grid-cols-2 gap-2">
                                 <div className="flex items-center gap-2 bg-cream/50 px-2 py-1.5 border border-slate/10 rounded">
                                    <User size={12} className="text-slate/40" />
                                    <input 
                                      type="text" 
                                      value={task.assignee || ''} 
                                      onChange={(e) => updateSubtask(idx, 'assignee', e.target.value)}
                                      placeholder="Owner" 
                                      className="bg-transparent text-[10px] w-full focus:outline-none font-bold text-slate/70"
                                    />
                                 </div>
                                 <div className="flex items-center gap-2 bg-cream/50 px-2 py-1.5 border border-slate/10 rounded">
                                    <Calendar size={12} className="text-slate/40" />
                                    <input 
                                      type="text" 
                                      value={task.dueDate || ''} 
                                      onChange={(e) => updateSubtask(idx, 'dueDate', e.target.value)}
                                      placeholder="Due Date" 
                                      className="bg-transparent text-[10px] w-full focus:outline-none font-bold text-slate/70"
                                    />
                                 </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate/5">
                                 <div className="flex gap-2">
                                    <button 
                                      onClick={() => updateSubtask(idx, 'isBlocked', !task.isBlocked)}
                                      className={`flex items-center gap-1 text-[9px] font-black tracking-widest px-1.5 py-1 rounded border transition-colors ${task.isBlocked ? 'bg-terra text-white border-terra' : 'text-slate/40 hover:text-terra border-slate/10 hover:border-terra/40'}`}
                                    >
                                       <Ban size={10} /> {task.isBlocked ? 'BLOCKED' : 'NO BLOCKERS'}
                                    </button>
                                 </div>

                                 <div className="flex items-center gap-2">
                                    {task.convertedNodeId ? (
                                       <span className="text-[8px] font-black text-teal flex items-center gap-1 bg-teal/10 px-2 py-1 rounded-sm border border-teal/20 uppercase tracking-widest">
                                          Linked Node
                                       </span>
                                    ) : !task.isCompleted && (
                                       <button 
                                          onClick={() => convertSubtaskToNode(idx)}
                                          className="text-[8px] font-black px-2 py-1 flex items-center gap-1 transition-colors rounded-sm uppercase tracking-widest text-slate hover:text-white bg-slate/10 hover:bg-slate"
                                       >
                                          <GitBranch size={10} /> Convert Task to Node
                                       </button>
                                    )}
                                    <button onClick={() => deleteSubtask(idx)} className="text-slate/20 hover:text-terra transition-colors p-1"><Trash2 size={12} /></button>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
          </>
        )}

        {activeTab === 'meetings' && (
           <div className="space-y-6">
              <div className="bg-white border-2 border-slate p-6 text-center space-y-4 shadow-hard-sm">
                 <Mic size={32} className="mx-auto text-teal" />
                 <h3 className="text-sm font-bold text-slate uppercase tracking-wider">Record Meeting / Notes</h3>
                 <p className="text-xs text-slate/60">Audio will be transcribed and action items extracted automatically.</p>
                 <button onClick={handleStartRecording} className="w-full py-3 bg-slate text-white font-bold uppercase tracking-widest hover:bg-teal transition-colors flex items-center justify-center gap-2">
                    <Mic size={16} /> Start Recording
                 </button>
              </div>
              <div className="space-y-4 pb-20">
                 {(node.config.meetings || []).length === 0 && (
                     <div className="text-center p-8 opacity-40">
                         <div className="text-xs font-bold uppercase tracking-widest text-slate">No recordings yet</div>
                     </div>
                 )}
                 {(node.config.meetings || []).map((mtg) => (
                    <div key={mtg.id} className="border-2 border-slate bg-white shadow-hard-sm">
                       <div onClick={() => setExpandedMeetingId(expandedMeetingId === mtg.id ? null : mtg.id)} className="flex items-center justify-between p-3 cursor-pointer">
                          <div className="flex items-center gap-2 overflow-hidden">
                              <Video size={14} className="text-teal flex-shrink-0" />
                              <h4 className="text-xs font-bold text-slate truncate">{mtg.title}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-mono text-slate/50">{mtg.duration}</span>
                             <ChevronDown size={14} className={`transform transition-transform ${expandedMeetingId === mtg.id ? 'rotate-180' : ''}`} />
                          </div>
                       </div>
                       {expandedMeetingId === mtg.id && (
                           <div className="p-4 border-t border-slate/10 bg-cream/30 space-y-4">
                               <div className="space-y-1">
                                   <div className="text-[9px] font-black uppercase tracking-widest text-slate/40">Summary</div>
                                   <p className="text-xs text-slate leading-relaxed">{mtg.summary}</p>
                               </div>
                               {mtg.actionItems.length > 0 && (
                                   <div className="space-y-1">
                                       <div className="text-[9px] font-black uppercase tracking-widest text-teal">Action Items</div>
                                       <ul className="list-disc pl-4 space-y-1">
                                           {mtg.actionItems.map((item, i) => (
                                               <li key={i} className="text-[10px] text-slate font-bold">{item}</li>
                                           ))}
                                       </ul>
                                   </div>
                               )}
                               <div className="pt-2 border-t border-slate/5">
                                   <div className="text-[9px] font-black uppercase tracking-widest text-slate/30 mb-1">Transcript</div>
                                   <p className="text-[10px] text-slate/60 font-mono leading-relaxed max-h-32 overflow-y-auto">{mtg.transcript}</p>
                               </div>
                           </div>
                       )}
                    </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'details' && (
           <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate uppercase tracking-wider mb-2">Instructions</label>
                <textarea rows={4} value={node.config.systemInstruction || ''} onChange={(e) => handleChange('systemInstruction', e.target.value)} className="w-full px-3 py-3 border-2 border-slate bg-white text-xs font-mono text-slate/80" placeholder="Persona rules..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate uppercase tracking-wider mb-2">Output Variable</label>
                <input type="text" value={node.config.outputVar || ''} onChange={(e) => handleChange('outputVar', e.target.value)} className="w-full px-3 py-2 border-2 border-slate bg-white text-xs font-mono text-slate/80" placeholder="e.g. extractedData" />
              </div>
           </div>
        )}
      </div>
    </div>
  );
};
