
import React, { useState } from 'react';
import { Search, Globe, ChevronDown, Sparkles, ArrowRight } from 'lucide-react';
import { MODEL_OPTIONS } from '../constants';

interface ProjectInputProps {
  onStart: (input: string, model?: string) => void;
}

export const ProjectInput: React.FC<ProjectInputProps> = ({ onStart }) => {
  const [input, setInput] = useState('');
  const [model, setModel] = useState(MODEL_OPTIONS[0].value);

  const handleStart = () => {
    if (input.trim()) onStart(input, model);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 md:p-6 animate-fade-in relative overflow-hidden">
      {/* Background radial gradient */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[800px] h-[600px] md:h-[800px] bg-indigo-500/5 rounded-full blur-[100px] md:blur-[120px]" />
      </div>

      <div className="w-full max-w-3xl flex flex-col gap-8 md:gap-10 relative z-10">
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
                   
                   <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#2B2C2E] border border-[#444746] text-white text-[10px] md:text-xs font-medium hover:bg-[#37393B] transition-colors">
                      <Globe className="w-3 h-3 md:w-3.5 md:h-3.5" /> <span className="hidden xs:inline">Web</span> <ChevronDown className="text-zinc-500 w-2.5 h-2.5 md:w-3 md:h-3" />
                   </button>
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
      </div>
    </div>
  );
};
