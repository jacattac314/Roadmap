
import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Search, Globe, ChevronDown, Loader2 } from 'lucide-react';
import { MODEL_OPTIONS } from '../constants';

interface LandingPageProps {
  onStart: (input: string, model?: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const [input, setInput] = useState('');
  const [model, setModel] = useState(MODEL_OPTIONS[0].value);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    // Check if user is already "logged in" via localStorage or if key is already selected
    const checkAuth = async () => {
      const savedUser = localStorage.getItem('agent_builder_user');
      const hasKey = (window as any).aistudio?.hasSelectedApiKey 
        ? await (window as any).aistudio.hasSelectedApiKey() 
        : true; // Default to true if not in AI Studio environment

      if (savedUser && hasKey) {
        setIsLoggedIn(true);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = async () => {
    setIsAuthenticating(true);
    
    // Simulate API delay for a "real" feel
    await new Promise(resolve => setTimeout(resolve, 800));

    // Attempt to use the AI Studio environment key selector (mandatory for "real" app context here)
    if ((window as any).aistudio?.openSelectKey) {
      try {
        await (window as any).aistudio.openSelectKey();
      } catch (e) {
        console.error("Key selection failed or cancelled", e);
        setIsAuthenticating(false);
        return;
      }
    }

    // Persist login state
    const mockUser = { id: 'user_' + Date.now(), name: 'Alpha Tester', email: 'tester@example.com' };
    localStorage.setItem('agent_builder_user', JSON.stringify(mockUser));
    
    setIsLoggedIn(true);
    setIsAuthenticating(false);
  };

  const handleStart = () => {
    if (input.trim()) {
      onStart(input, model);
    }
  };

  return (
    <div className="min-h-screen bg-[#131314] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden text-[#E3E3E3]">
      
      {/* Background Gradients (Subtle) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[20%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-4xl flex flex-col items-center space-y-10 relative z-10">
        
        {!isLoggedIn ? (
          <div className="flex flex-col items-center gap-8 animate-fade-in text-center">
             <div className="space-y-2">
               <h2 className="text-2xl font-semibold text-white">Agent Builder</h2>
               <p className="text-zinc-500 text-lg">Create smarter workflows with multi-agent systems.</p>
             </div>

             <button 
                onClick={handleLogin}
                disabled={isAuthenticating}
                className="group flex items-center gap-3 bg-white hover:bg-zinc-100 text-[#1F1F1F] text-lg font-bold py-4 px-10 rounded-full transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
             >
                {isAuthenticating ? (
                  <Loader2 className="animate-spin text-indigo-600" size={24} />
                ) : (
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                <span>{isAuthenticating ? 'Authenticating...' : 'Sign in with Google'}</span>
             </button>
             
             <p className="text-zinc-600 text-xs">By signing in, you agree to the Google Cloud Generative AI Terms of Service.</p>
          </div>
        ) : (
          /* Input Area - Revealed after login */
          <div className="w-full max-w-3xl flex flex-col gap-6 animate-fade-in-up">
            
            {/* Main Search/Input Box */}
            <div className="bg-[#1E1F20] border border-[#444746] rounded-[28px] p-4 flex flex-col gap-4 relative shadow-lg focus-within:border-[#A8C7FA] transition-colors">
               <div className="flex items-start gap-4 px-2 pt-1">
                  <Search className="text-[#E3E3E3] mt-1 shrink-0" size={24} />
                  <textarea 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Describe your product idea to generate a roadmap..."
                    rows={1}
                    autoFocus
                    className="w-full bg-transparent text-[#E3E3E3] text-xl placeholder-[#8E918F] resize-none outline-none font-normal leading-relaxed h-auto min-h-[32px] overflow-hidden"
                    style={{ height: input ? `${Math.min(input.split('\n').length * 28 + 20, 200)}px` : '32px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleStart();
                      }
                    }}
                  />
                  {/* Mock User/Status Indicator (Purple Dot from Screenshot) */}
                  <div className="w-2 h-2 rounded-full bg-[#A142F4] shrink-0 mt-2" />
               </div>
               
               <div className="flex items-center justify-between px-2 pb-1">
                  <div className="flex gap-2">
                     <div className="relative flex items-center">
                        <Sparkles className="absolute left-3 w-3 h-3 md:w-3.5 md:h-3.5 text-zinc-300 pointer-events-none z-10" />
                        <select
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="appearance-none pl-8 pr-8 py-1.5 rounded-full bg-[#2B2C2E] border border-[#444746] text-[#E3E3E3] text-sm font-medium hover:bg-[#37393B] transition-colors outline-none cursor-pointer min-w-[140px]"
                        >
                          {MODEL_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 w-3 h-3 text-[#C4C7C5] pointer-events-none" />
                     </div>

                     <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2B2C2E] border border-[#444746] text-[#E3E3E3] text-sm font-medium hover:bg-[#37393B] transition-colors">
                        <Globe size={16} /> Web <ChevronDown size={14} className="text-[#C4C7C5]" />
                     </button>
                  </div>
                  <button 
                    onClick={handleStart} 
                    disabled={!input.trim()}
                    className={`p-2 rounded-full transition-colors ${input.trim() ? 'bg-[#A8C7FA] text-[#062E6F] hover:bg-[#8AB4F8]' : 'bg-[#3C4043] text-[#8E918F] cursor-not-allowed'}`}
                  >
                     <ArrowRight size={20} />
                  </button>
               </div>
            </div>

          </div>
        )}
        
      </div>
    </div>
  );
};
