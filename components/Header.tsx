
import React from 'react';
import { AudioWaveform, Moon, Sun, ShieldCheck, ShieldAlert } from 'lucide-react';

interface HeaderProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  apiKeyHint: string | null;
}

const Header: React.FC<HeaderProps> = ({ isDarkMode, toggleTheme, apiKeyHint }) => {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-sm">
            <AudioWaveform className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">NGABACOT BEBAS</h1>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          {/* API Key Status Badge */}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all ${
            apiKeyHint 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
              : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
          }`}>
            {apiKeyHint ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Active Key: <span className="font-mono bg-emerald-500/20 px-1 rounded ml-1 text-xs">...{apiKeyHint}</span></span>
                <ShieldCheck className="w-3 h-3 ml-1" />
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Key Not Detected</span>
                <ShieldAlert className="w-3 h-3 ml-1" />
              </>
            )}
          </div>

          <button 
            onClick={toggleTheme}
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title={isDarkMode ? "Ganti ke Mode Terang" : "Ganti ke Mode Gelap"}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
