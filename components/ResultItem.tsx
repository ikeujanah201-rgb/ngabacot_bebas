
import React, { useState, useRef, useEffect } from 'react';
import { TTSItem } from '../types';
import { Play, Pause, Download, AlertCircle, Loader2, RotateCcw, Hash, Type, CloudUpload, Link, Copy, Check } from 'lucide-react';

interface ResultItemProps {
  item: TTSItem & { 
    groupIndex?: number; 
    retryCount?: number; 
    isWaitingLimit?: boolean;
  };
  onRetry: (id: string) => void;
  onUpload: (id: string) => void;
}

const ResultItem: React.FC<ResultItemProps> = ({ item, onRetry, onUpload }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const copyLink = () => {
    if (item.cloudUrl) {
      navigator.clipboard.writeText(item.cloudUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
          </div>

          <p className="text-slate-800 dark:text-[#e3e3e3] text-sm leading-relaxed font-medium opacity-90">
            {item.text}
          </p>

          {item.cloudUrl && (
            <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-2xl">
              <Link className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-600 truncate flex-1">{item.cloudUrl}</span>
              <button onClick={copyLink} className="p-1.5 hover:bg-emerald-500/20 rounded-lg text-emerald-600 transition-colors">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {item.status === 'error' && (
             <div className="flex items-center gap-3 text-red-500 text-[10px] font-black bg-red-500/5 p-4 rounded-2xl border border-red-500/10 uppercase tracking-widest">
               <AlertCircle className="w-4 h-4 shrink-0" />
               <span className="line-clamp-1">{item.errorMsg}</span>
               <button onClick={() => onRetry(item.id)} className="ml-auto bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600"><RotateCcw className="w-3.5 h-3.5" /></button>
             </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {item.status === 'completed' && item.audioUrl && (
            <>
              <button onClick={togglePlay} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg transition-all active:scale-90">
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
              </button>
              
              {!item.cloudUrl && (
                <button 
                  onClick={() => onUpload(item.id)} 
                  disabled={item.isUploading}
                  className={`w-12 h-12 flex items-center justify-center rounded-2xl border border-slate-200 dark:border-[#444746] ${item.isUploading ? 'text-indigo-500' : 'text-slate-500 dark:text-gray-400 hover:text-indigo-500'} transition-all`}
                  title="Upload ke Server (Gratis)"
                >
                  {item.isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CloudUpload className="w-5 h-5" />}
                </button>
              )}
              <audio ref={audioRef} src={item.audioUrl} />
            </>
          )}
          {item.status === 'processing' && (
            <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-indigo-500/5">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultItem;
