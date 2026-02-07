
import React, { useState } from 'react';
import { Search, Globe, ChevronDown, Sparkles, ArrowRight, Upload, Link, HardDrive, Copy } from 'lucide-react';

interface ProjectInputProps {
  onStart: (input: string) => void;
}

export const ProjectInput: React.FC<ProjectInputProps> = ({ onStart }) => {
  const [input, setInput] = useState('');

  const handleStart = () => {
    if (input.trim()) onStart(input);
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
                   <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#2B2C2E] border border-[#444746] text-white text-[10px] md:text-xs font-medium hover:bg-[#37393B] transition-colors">
                      <Globe className="w-3 h-3 md:w-3.5 md:h-3.5" /> <span className="hidden xs:inline">Web</span> <ChevronDown className="text-zinc-500 w-2.5 h-2.5 md:w-3 md:h-3" />
                   </button>
                   <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#2B2C2E] border border-[#444746] text-white text-[10px] md:text-xs font-medium hover:bg-[#37393B] transition-colors">
                      <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5" /> <span className="hidden xs:inline">Research</span> <ChevronDown className="text-zinc-500 w-2.5 h-2.5 md:w-3 md:h-3" />
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

          <div className="flex flex-col items-center gap-2">
             <p className="text-zinc-300 text-base md:text-lg">or drop your files</p>
             <p className="text-zinc-500 text-[10px] md:text-xs text-center">pdf, images, docs, audio, and more</p>
             
             <div className="flex flex-wrap justify-center gap-2 md:gap-3 mt-4 px-4">
                <button className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-full bg-[#1E1F20] border border-[#444746] text-white text-[10px] md:text-xs font-medium hover:bg-[#2B2C2E] transition-colors">
                   <Upload size={14} className="text-[#A8C7FA]" /> Upload
                </button>
                <button className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-full bg-[#1E1F20] border border-[#444746] text-white text-[10px] md:text-xs font-medium hover:bg-[#2B2C2E] transition-colors">
                   <Link size={14} className="text-[#F28B82]" /> Link
                </button>
                <button className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-full bg-[#1E1F20] border border-[#444746] text-white text-[10px] md:text-xs font-medium hover:bg-[#2B2C2E] transition-colors">
                   <HardDrive size={14} className="text-[#81C995]" /> Drive
                </button>
                <button className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-full bg-[#1E1F20] border border-[#444746] text-white text-[10px] md:text-xs font-medium hover:bg-[#2B2C2E] transition-colors">
                   <Copy size={14} className="text-[#FDD663]" /> Text
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
