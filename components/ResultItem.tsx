
import React, { useState, useRef, useEffect } from 'react';
import { TTSItem } from '../types';
import { Play, Pause, Download, AlertCircle, Loader2, CheckCircle2, RotateCcw, Hash, Type, RefreshCw, AlertTriangle } from 'lucide-react';

interface ResultItemProps {
  item: TTSItem & { 
    groupIndex?: number; 
    retryCount?: number; 
    isWaitingLimit?: boolean;
  };
  onRetry: (id: string) => void;
}

const ResultItem: React.FC<ResultItemProps> = ({ item, onRetry }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [item.audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    if (!item.audioUrl) return;
    const a = document.createElement('a');
    a.href = item.audioUrl;
    const safeText = item.text.substring(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `ngabacot_g${item.groupIndex || 0}_${item.voice}_${safeText}.wav`;
    a.click();
  };

  return (
    <div className={`bg-white dark:bg-[#1e1f20] border rounded-3xl p-6 transition-all group shadow-sm ${item.isWaitingLimit ? 'border-amber-500 shadow-amber-500/10' : 'border-slate-200 dark:border-[#444746] hover:border-indigo-500/40'}`}>
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {item.groupIndex && (
              <span className="bg-indigo-500/10 text-indigo-500 text-[9px] font-black px-3 py-1 rounded-lg border border-indigo-500/10 uppercase flex items-center gap-1.5">
                <Hash className="w-3 h-3" />
                GRUP {item.groupIndex}
              </span>
            )}
            <span className="bg-slate-100 dark:bg-[#131314] text-slate-500 dark:text-gray-400 text-[9px] font-black px-3 py-1 rounded-lg border border-slate-200 dark:border-[#444746] uppercase">
              {item.voice}
            </span>
            <span className="text-[9px] text-slate-400 font-bold px-1 flex items-center gap-1.5 uppercase tracking-wider">
                <Type className="w-3.5 h-3.5" />
                {item.text.length} CHARS
            </span>
            {item.retryCount && item.retryCount > 1 && (
               <span className="bg-amber-500/10 text-amber-600 text-[9px] font-black px-3 py-1 rounded-lg border border-amber-500/10 uppercase flex items-center gap-1.5">
                 <RefreshCw className="w-3 h-3" />
                 ATTEMPT {item.retryCount}
               </span>
            )}
          </div>

          <p className="text-slate-800 dark:text-[#e3e3e3] text-sm leading-relaxed italic font-medium opacity-90">
            "{item.text}"
          </p>

          {item.isWaitingLimit && (
             <div className="flex items-center gap-3 text-amber-600 text-[10px] font-black bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10 uppercase tracking-widest animate-pulse">
               <AlertTriangle className="w-4 h-4 shrink-0" />
               <span>RATE LIMIT DETECTED - COOLING DOWN...</span>
             </div>
          )}

          {item.status === 'error' && !item.isWaitingLimit && (
             <div className="flex items-center gap-3 text-red-500 text-[10px] font-black bg-red-500/5 p-4 rounded-2xl border border-red-500/10 uppercase tracking-widest">
               <AlertCircle className="w-4 h-4 shrink-0" />
               <span className="line-clamp-1">{item.errorMsg}</span>
               <button onClick={() => onRetry(item.id)} className="ml-auto bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600"><RotateCcw className="w-3.5 h-3.5" /></button>
             </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {item.status === 'completed' && item.audioUrl && (
            <>
              <button onClick={togglePlay} className="w-14 h-14 flex items-center justify-center rounded-2xl bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg transition-all active:scale-90">
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
              </button>
              <button onClick={handleDownload} className="w-14 h-14 flex items-center justify-center rounded-2xl border border-slate-200 dark:border-[#444746] text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-[#131314] transition-all">
                <Download className="w-6 h-6" />
              </button>
              <audio ref={audioRef} src={item.audioUrl} />
            </>
          )}
          {item.status === 'processing' && (
            <div className={`w-14 h-14 flex items-center justify-center rounded-2xl ${item.isWaitingLimit ? 'bg-amber-500/10' : 'bg-indigo-500/5'}`}>
              <Loader2 className={`w-7 h-7 animate-spin ${item.isWaitingLimit ? 'text-amber-500' : 'text-indigo-500'}`} />
            </div>
          )}
           {item.status === 'pending' && (
            <div className="w-14 h-14 flex items-center justify-center opacity-10">
              <CheckCircle2 className="w-7 h-7" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultItem;
