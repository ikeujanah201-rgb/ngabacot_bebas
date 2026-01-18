
import React, { useState, useRef, useEffect } from 'react';
import { TTSItem } from '../types';
import { Play, Pause, AlertCircle, Loader2, RotateCcw, Hash, Type, CloudUpload, Link, Copy, Check, Zap, Download } from 'lucide-react';

interface ResultItemProps {
  item: TTSItem & { 
    groupIndex?: number; 
    retryCount?: number; 
    isWaitingLimit?: boolean;
    cloudUrl?: string;
    isUploading?: boolean;
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

  const copyUrl = () => {
    if (item.cloudUrl) {
      navigator.clipboard.writeText(item.cloudUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadLocal = () => {
    if (!item.audioUrl) return;
    const a = document.createElement('a');
    a.href = item.audioUrl;
    const safeText = item.text.substring(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `bacot_${item.groupIndex || 'x'}_${safeText}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className={`relative bg-white dark:bg-[#1e1f20] border rounded-[2rem] p-6 transition-all group shadow-sm ${item.isWaitingLimit ? 'border-red-500 shadow-xl shadow-red-500/10 ring-2 ring-red-500/20' : 'border-slate-200 dark:border-[#444746] hover:border-indigo-500/40'}`}>
      
      {item.isWaitingLimit && (
        <div className="absolute -top-3 left-6 bg-red-600 text-white text-[9px] font-black px-4 py-1.5 rounded-full uppercase italic flex items-center gap-2 shadow-lg animate-bounce">
          <Zap className="w-3 h-3 fill-current" />
          Mencoba Ulang Otomatis...
        </div>
      )}

      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {item.groupIndex && (
              <span className={`text-[9px] font-black px-3 py-1 rounded-lg border uppercase flex items-center gap-1.5 transition-colors ${item.isWaitingLimit ? 'bg-red-500 text-white border-red-500' : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/10'}`}>
                <Hash className="w-3 h-3" />
                GRUP {item.groupIndex}
              </span>
            )}
            <span className="bg-slate-100 dark:bg-[#131314] text-slate-500 dark:text-gray-400 text-[9px] font-black px-3 py-1 rounded-lg border border-slate-200 dark:border-[#444746] uppercase">
              {item.voice}
            </span>
            {item.retryCount && item.retryCount > 0 && (
              <span className="bg-amber-500/10 text-amber-500 text-[9px] font-black px-3 py-1 rounded-lg border border-amber-500/10 uppercase">
                RETRY: {item.retryCount}
              </span>
            )}
          </div>

          <p className={`text-sm leading-relaxed font-medium transition-colors ${item.isWaitingLimit ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-800 dark:text-[#e3e3e3]'}`}>
            {item.text}
          </p>

          {item.cloudUrl && (
            <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl">
              <Link className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-600 truncate flex-1">{item.cloudUrl}</span>
              <button onClick={copyUrl} className="p-1.5 hover:bg-emerald-500/20 rounded-lg text-emerald-600">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {item.status === 'error' && !item.isWaitingLimit && (
             <div className="flex items-center gap-3 text-red-500 text-[10px] font-black bg-red-500/5 p-4 rounded-xl border border-red-500/10 uppercase tracking-widest">
               <AlertCircle className="w-4 h-4 shrink-0" />
               <span className="line-clamp-1">{item.errorMsg}</span>
             </div>
          )}

          {item.isWaitingLimit && (
             <div className="flex items-center gap-3 text-red-600 text-[10px] font-black bg-red-600/5 p-4 rounded-xl border border-red-600/20 uppercase tracking-widest animate-pulse">
               <AlertCircle className="w-4 h-4 shrink-0" />
               <span>{item.errorMsg}</span>
             </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {item.status === 'completed' && item.audioUrl && (
            <>
              {/* Tombol Play */}
              <button 
                onClick={togglePlay} 
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg active:scale-90 transition-all"
                title="Putar Audio"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
              </button>
              
              {/* Tombol Download Lokal - INI YANG BARU */}
              <button 
                onClick={handleDownloadLocal} 
                className="w-12 h-12 flex items-center justify-center rounded-2xl border border-slate-200 dark:border-[#444746] text-slate-500 dark:text-gray-400 hover:text-indigo-600 hover:border-indigo-500/50 transition-all bg-white dark:bg-transparent"
                title="Download file .wav ke komputer"
              >
                <Download className="w-5 h-5" />
              </button>

              {/* Tombol Upload Cloud */}
              {!item.cloudUrl && (
                <button 
                  onClick={() => onUpload(item.id)} 
                  disabled={item.isUploading}
                  className={`w-12 h-12 flex items-center justify-center rounded-2xl border border-slate-200 dark:border-[#444746] ${item.isUploading ? 'text-indigo-500' : 'text-slate-500 dark:text-gray-400 hover:text-indigo-500'} transition-all bg-white dark:bg-transparent`}
                  title="Upload ke transfer.sh (Cloud)"
                >
                  {item.isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CloudUpload className="w-5 h-5" />}
                </button>
              )}
              <audio ref={audioRef} src={item.audioUrl} />
            </>
          )}
          {(item.status === 'processing' || (item.isWaitingLimit && item.status !== 'completed')) && (
            <div className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-colors ${item.isWaitingLimit ? 'bg-red-500/10 text-red-500' : 'bg-indigo-500/5 text-indigo-500'}`}>
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultItem;
