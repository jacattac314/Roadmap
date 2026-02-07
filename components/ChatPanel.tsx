
import React, { useState, useRef, useEffect } from 'react';
import { NodeData, Edge, ChatMessage, NodeType } from '../types';
import { generateChatResponse } from '../services/geminiService';
import { Send, X, MessageSquare, ChevronRight, User, Bot, Layers, Box, ArrowRightCircle, PlusCircle, CheckSquare, Sparkles } from 'lucide-react';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: NodeData[];
  edges: Edge[];
  selectedNodeId: string | null;
  onUpdateNode: (updatedNode: NodeData) => void;
  onCreateNode: (parentId: string, label: string) => string | null;
  onNavigate: (nodeId: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  nodes,
  edges,
  selectedNodeId,
  onUpdateNode,
  onCreateNode,
  onNavigate
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Hi! I'm your project assistant. I can help you add tasks, create new workflow nodes, or answer questions about your roadmap. What are we working on?",
      timestamp: Date.now()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scope, setScope] = useState<'project' | 'node'>('project');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-switch scope when selection changes
  useEffect(() => {
    if (selectedNodeId) setScope('node');
    else setScope('project');
  }, [selectedNodeId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const getSystemContext = () => {
    let context = `You are a project management assistant for a GenAI agent workflow builder.\n`;
    
    // 1. Graph State
    const nodesList = nodes.map(n => `- [${n.id}] "${n.label}" (${n.type})`).join('\n');
    context += `\nCURRENT PROJECT GRAPH:\n${nodesList}\n`;
    
    // 2. Scope Context
    if (scope === 'node' && selectedNode) {
      context += `\nCURRENTLY FOCUSED NODE:\nID: ${selectedNode.id}\nLabel: ${selectedNode.label}\nDescription: ${selectedNode.description}\n`;
      if (selectedNode.config.subtasks?.length) {
         context += `Subtasks: ${JSON.stringify(selectedNode.config.subtasks.map(t => t.text))}\n`;
      }
      if (selectedNode.config.summary) {
         context += `Summary: ${selectedNode.config.summary}\n`;
      }
    } else {
      context += `\nSCOPE: Global Project View. You have access to all nodes.\n`;
    }

    // 3. Action Capabilities
    context += `\nCAPABILITIES:
    - You can answer questions about the project structure.
    - You can PERFORM ACTIONS by outputting a specific JSON block at the end of your response.
    
    AVAILABLE ACTIONS (Output valid JSON inside \`\`\`json\`\`\` block):
    
    1. CREATE_NODE: Add a new child node.
    { "action": "CREATE_NODE", "parentId": "parent_node_id", "label": "New Node Label" }
    
    2. ADD_SUBTASK: Add a task to a node. If scope is 'node', nodeId is optional (defaults to current).
    { "action": "ADD_SUBTASK", "nodeId": "target_node_id", "text": "Task description", "assignee": "Name", "dueDate": "YYYY-MM-DD" }
    
    3. NAVIGATE: Jump to a node.
    { "action": "NAVIGATE", "nodeId": "target_node_id" }
    
    4. UPDATE_DESCRIPTION: Update node description.
    { "action": "UPDATE_DESCRIPTION", "nodeId": "target_node_id", "description": "New description" }

    When asked to do something, confirm in text, then output the JSON action.
    If multiple actions needed, do one at a time or list them (currently support single action per turn).
    `;

    return context;
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputValue,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsProcessing(true);

    try {
      // Construct history for Gemini
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      history.push({ role: 'user', parts: [{ text: inputValue }] });

      const response = await generateChatResponse({
        modelName: 'gemini-3-flash-preview',
        history: history,
        systemInstruction: getSystemContext()
      });

      let botText = response.text;
      let actionPerformed = undefined;

      // Parse Action
      const jsonMatch = botText.match(/```json\n([\s\S]*?)\n```/) || botText.match(/```json\n([\s\S]*?)$/);
      if (jsonMatch) {
         try {
            const actionData = JSON.parse(jsonMatch[1]);
            botText = botText.replace(jsonMatch[0], '').trim(); // Remove JSON from display text
            
            if (actionData.action === 'CREATE_NODE') {
               const newId = onCreateNode(actionData.parentId, actionData.label);
               if (newId) actionPerformed = `Created node "${actionData.label}"`;
            } 
            else if (actionData.action === 'ADD_SUBTASK') {
               const targetId = actionData.nodeId || selectedNodeId;
               const targetNode = nodes.find(n => n.id === targetId);
               if (targetNode) {
                  const newTask = {
                     id: Date.now().toString(),
                     text: actionData.text,
                     isCompleted: false,
                     assignee: actionData.assignee,
                     dueDate: actionData.dueDate
                  };
                  const updatedNode = {
                     ...targetNode,
                     config: {
                        ...targetNode.config,
                        subtasks: [...(targetNode.config.subtasks || []), newTask]
                     }
                  };
                  onUpdateNode(updatedNode);
                  actionPerformed = `Added task to "${targetNode.label}"`;
               }
            }
            else if (actionData.action === 'NAVIGATE') {
               onNavigate(actionData.nodeId);
               actionPerformed = `Navigated to node`;
            }
            else if (actionData.action === 'UPDATE_DESCRIPTION') {
                const targetNode = nodes.find(n => n.id === actionData.nodeId);
                if (targetNode) {
                    onUpdateNode({ ...targetNode, description: actionData.description });
                    actionPerformed = `Updated description for "${targetNode.label}"`;
                }
            }

         } catch (e) {
            console.error("Failed to execute chat action", e);
         }
      }

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: botText,
        timestamp: Date.now(),
        isAction: !!actionPerformed
      };
      
      setMessages(prev => [...prev, botMsg]);

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: 'err', role: 'model', text: "Sorry, I encountered an error processing that request.", timestamp: Date.now() }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`fixed right-0 top-16 bottom-0 w-[400px] bg-white border-l-2 border-slate shadow-2xl transform transition-transform duration-300 ease-in-out z-30 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-slate bg-cream shrink-0">
         <div className="flex items-center gap-2">
            <div className="p-1.5 bg-teal text-white border border-slate shadow-sm">
               <Bot size={16} />
            </div>
            <h3 className="text-sm font-bold text-slate uppercase tracking-wider">Assistant</h3>
         </div>
         <div className="flex items-center gap-2">
            <div className="flex bg-white border border-slate p-0.5 rounded-sm">
               <button 
                 onClick={() => setScope('project')}
                 className={`p-1 rounded-sm transition-colors ${scope === 'project' ? 'bg-slate text-white' : 'text-slate/50 hover:bg-slate/10'}`}
                 title="Project Scope"
               >
                  <Layers size={14} />
               </button>
               <button 
                 onClick={() => setScope('node')}
                 disabled={!selectedNode}
                 className={`p-1 rounded-sm transition-colors ${scope === 'node' ? 'bg-slate text-white' : 'text-slate/50 hover:bg-slate/10'} disabled:opacity-30`}
                 title="Node Scope"
               >
                  <Box size={14} />
               </button>
            </div>
            <button onClick={onClose} className="text-slate hover:text-terra"><X size={20} /></button>
         </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 custom-scrollbar">
         {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
               <div className={`w-8 h-8 shrink-0 flex items-center justify-center border-2 border-slate rounded-full ${msg.role === 'user' ? 'bg-white text-slate' : 'bg-teal text-white'}`}>
                  {msg.role === 'user' ? <User size={14} /> : <Sparkles size={14} />}
               </div>
               <div className={`max-w-[80%] space-y-2`}>
                  <div className={`p-3 text-xs leading-relaxed border-2 border-slate shadow-sm ${msg.role === 'user' ? 'bg-white text-slate' : 'bg-cream text-slate'}`}>
                     {msg.text}
                  </div>
                  {msg.isAction && (
                     <div className="flex items-center gap-1.5 text-[10px] font-bold text-teal uppercase tracking-wider animate-pulse">
                        <CheckSquare size={12} /> Action Executed
                     </div>
                  )}
               </div>
            </div>
         ))}
         {isProcessing && (
            <div className="flex gap-3">
               <div className="w-8 h-8 shrink-0 flex items-center justify-center border-2 border-slate rounded-full bg-teal text-white">
                  <Sparkles size={14} className="animate-spin" />
               </div>
               <div className="p-3 bg-cream border-2 border-slate text-xs text-slate/50 italic">
                  Thinking...
               </div>
            </div>
         )}
         <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t-2 border-slate">
         {scope === 'node' && selectedNode ? (
            <div className="text-[10px] font-bold text-teal uppercase mb-2 flex items-center gap-1">
               <Box size={10} /> Context: {selectedNode.label}
            </div>
         ) : (
            <div className="text-[10px] font-bold text-slate/50 uppercase mb-2 flex items-center gap-1">
               <Layers size={10} /> Context: Entire Project
            </div>
         )}
         <div className="flex gap-2">
            <input
               type="text"
               value={inputValue}
               onChange={(e) => setInputValue(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleSend()}
               placeholder="Ask to create nodes, add tasks, or explain..."
               className="flex-1 px-3 py-2 text-xs border-2 border-slate focus:border-teal outline-none bg-gray-50"
            />
            <button 
               onClick={handleSend}
               disabled={!inputValue.trim() || isProcessing}
               className="p-2 bg-slate text-white border-2 border-slate hover:bg-teal transition-colors disabled:opacity-50"
            >
               <Send size={16} />
            </button>
         </div>
      </div>

    </div>
  );
};
