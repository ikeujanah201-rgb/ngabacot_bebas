
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Trash2, Wand2, Mic, Layers, PlayCircle, AlignJustify, Settings2, DownloadCloud, Loader2, Volume2, Check, AlertTriangle, Timer, ListOrdered, FileAudio, Sparkles, History, Hash, Type, ChevronRight, AlertCircle, BookOpen, Quote, Award, Zap, PauseCircle, RefreshCcw } from 'lucide-react';
import Header from './components/Header';
import ResultItem from './components/ResultItem';
import { TTSItem, VoiceName, VoiceGender } from './types';
import { VOICE_METADATA, STYLE_PRESETS, SAMPLE_STORY } from './constants';
import { generateSpeech } from './services/geminiService';
import { createZipFromItems } from './utils/audioHelper';

const STORAGE_KEY = 'ngabacot_production_v3_final';

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [inputText, setInputText] = useState('');
  const [styleInstruction, setStyleInstruction] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Kore);
  const [activeGenderTab, setActiveGenderTab] = useState<VoiceGender>('Female');
  const [linesPerBatch, setLinesPerBatch] = useState(1);
  const [delaySec, setDelaySec] = useState(2); 

  const [items, setItems] = useState<(TTSItem & { groupIndex?: number; retryCount?: number; isWaitingLimit?: boolean; cloudUrl?: string; isUploading?: boolean })[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cooldownTime, setCooldownTime] = useState<number | null>(null);
  const [limitWaitTime, setLimitWaitTime] = useState<number | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'generating' | 'playing'>('idle');
  const [zipStatus, setZipStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  // Persistence: Load
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setItems(parsed.map((i: any) => ({
          ...i,
          status: i.status === 'completed' && !i.audioUrl ? 'error' : i.status,
          errorMsg: i.status === 'completed' && !i.audioUrl ? 'Refresh lost audio data' : i.errorMsg
        })));
      } catch (e) { console.error(e); }
    }
  }, []);

  // Persistence: Save
  useEffect(() => {
    const toSave = items.map(({ audioUrl, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [items]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const handleUploadToCloud = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || !item.audioUrl || item.isUploading) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, isUploading: true } : i));
    try {
      const response = await fetch(item.audioUrl);
      const blob = await response.blob();
      const fileName = `bacot_${id.substring(0, 6)}.wav`;
      const up = await fetch(`https://transfer.sh/${fileName}`, { method: 'PUT', body: blob });
      if (!up.ok) throw new Error("Upload failed");
      const cloudUrl = await up.text();
      setItems(prev => prev.map(i => i.id === id ? { ...i, cloudUrl, isUploading: false } : i));
    } catch (e: any) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, isUploading: false, errorMsg: e.message } : i));
    }
  };

  const filteredVoices = useMemo(() => {
    return Object.values(VOICE_METADATA).filter(v => v.gender === activeGenderTab);
  }, [activeGenderTab]);

  const allLines = useMemo(() => {
    return inputText.split('\n').filter(line => line.trim().length > 0);
  }, [inputText]);

  const batchPlan = useMemo(() => {
    const plan = [];
    for (let i = 0; i < allLines.length; i += linesPerBatch) {
      const chunk = allLines.slice(i, i + linesPerBatch).join('\n');
      plan.push({
        id: `plan-${i}-${Date.now()}`,
        group: Math.floor(i / linesPerBatch) + 1,
        text: chunk,
        charCount: chunk.length
      });
    }
    return plan;
  }, [allLines, linesPerBatch]);

  const totalCharsOverall = useMemo(() => batchPlan.reduce((acc, p) => acc + p.charCount, 0), [batchPlan]);

  const handlePreview = async () => {
    if (!inputText.trim()) return;
    setPreviewStatus('generating');
    try {
      const previewText = allLines.length > 0 ? allLines.slice(0, 1).join(' ') : inputText.substring(0, 100);
      const wavBlob = await generateSpeech(previewText, selectedVoice, styleInstruction, inputText);
      const audioUrl = URL.createObjectURL(wavBlob);
      const audio = new Audio(audioUrl);
      setPreviewStatus('playing');
      await audio.play();
      audio.onended = () => { setPreviewStatus('idle'); URL.revokeObjectURL(audioUrl); };
    } catch (e: any) {
      alert(`Preview Gagal: ${e.message}`);
      setPreviewStatus('idle');
    }
  };

  const handleGenerateBatch = useCallback(async () => {
    if (batchPlan.length === 0) return;

    const currentFullContext = inputText;
    const newItems = batchPlan.map((p) => ({
      id: Math.random().toString(36).substring(2, 15),
      text: p.text.trim(),
      status: 'pending' as const,
      voice: selectedVoice,
      groupIndex: p.group,
      retryCount: 0
    }));

    setItems((prev) => [...newItems, ...prev]);
    setIsProcessing(true);

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      let success = false;
      let attempts = 0;

      while (!success) {
        attempts++;
        setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: 'processing', retryCount: attempts, isWaitingLimit: false } : it)));

        try {
          const wavBlob = await generateSpeech(item.text, item.voice, styleInstruction, currentFullContext);
          const audioUrl = URL.createObjectURL(wavBlob);
          setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, status: 'completed', audioUrl, retryCount: attempts, isWaitingLimit: false, errorMsg: undefined } : it));
          success = true; 
        } catch (error: any) {
          const errorMsg = error.message || "Unknown error";
          const isRateLimit = errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("limit");
          
          if (isRateLimit) {
             setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, isWaitingLimit: true, errorMsg: `LIMIT: RETRY KE-${attempts}` } : it)));
             for (let t = 2; t > 0; t--) {
                setLimitWaitTime(t);
                await new Promise(r => setTimeout(r, 1000));
             }
             setLimitWaitTime(null);
          } else if (errorMsg.includes("Safety")) {
             setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: 'error', errorMsg: "SAFETY: MELEWATI" } : it)));
             await new Promise(r => setTimeout(r, 2000));
             break; 
          } else {
             setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: 'error', errorMsg: errorMsg } : it)));
             await new Promise(r => setTimeout(r, 3000));
          }
        }
      }

      setLimitWaitTime(null);

      if (success && i < newItems.length - 1) {
          for (let t = delaySec; t > 0; t--) {
              setCooldownTime(t);
              await new Promise(r => setTimeout(r, 1000));
          }
          setCooldownTime(null);
      }
    }
    setIsProcessing(false);
  }, [batchPlan, selectedVoice, styleInstruction, delaySec, inputText]);

  const handleDownloadZip = async () => {
    setZipStatus('processing');
    try {
      const zipBlob = await createZipFromItems(items);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ngabacot_batch_${Date.now()}.zip`;
      a.click();
      setZipStatus('success');
      setTimeout(() => setZipStatus('idle'), 3000);
    } catch (e) {
      setZipStatus('error');
      setTimeout(() => setZipStatus('idle'), 3000);
    }
  };

  const loadSampleStory = () => {
    setInputText(SAMPLE_STORY);
    setStyleInstruction(STYLE_PRESETS.find(s => s.id === 'pribadi')?.value || '');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0c0d] text-slate-900 dark:text-[#e3e3e3] flex flex-col font-sans transition-colors duration-300">
      <Header isDarkMode={isDarkMode} toggleTheme={toggleTheme} />

      <main className="flex-grow max-w-[1600px] w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-[#1e1f20] rounded-3xl border border-slate-200 dark:border-[#444746] p-8 shadow-xl sticky top-24">
            
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold flex items-center gap-3 italic uppercase tracking-tighter">
                    <Zap className="w-6 h-6 text-indigo-500 fill-current" />
                    STUDIO PRODUKSI
                </h2>
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#131314] px-4 py-2 rounded-2xl border border-slate-200 dark:border-[#444746]">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Baris/Grup:</span>
                    <input 
                      type="number" 
                      value={linesPerBatch}
                      onChange={(e) => setLinesPerBatch(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-8 bg-transparent text-center text-sm font-bold text-indigo-500 focus:outline-none"
                    />
                </div>
            </div>

            <div className="space-y-6">
                <div className="space-y-4">
                    <label className="text-xs font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        PILIH INTONASI & STYLE
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {STYLE_PRESETS.map((style) => (
                            <button
                                key={style.id}
                                onClick={() => setStyleInstruction(style.value)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                                    styleInstruction === style.value
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
                                    : 'bg-slate-50 dark:bg-[#131314] border-slate-200 dark:border-[#444746] text-slate-600 dark:text-gray-400 hover:border-indigo-500/50'
                                }`}
                            >
                                {style.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                         <label className="text-xs font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest">NASKAH NARASI</label>
                         <button onClick={loadSampleStory} className="flex items-center gap-2 text-[10px] font-black text-amber-600 dark:text-amber-500 hover:opacity-80 transition-opacity uppercase">
                             <Quote className="w-3.5 h-3.5" />
                             Muat Contoh
                         </button>
                    </div>
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Masukkan naskah Anda di sini..."
                        className="w-full h-44 bg-slate-50 dark:bg-[#131314] border border-slate-200 dark:border-[#444746] rounded-3xl p-6 text-sm leading-relaxed focus:border-indigo-500 outline-none resize-none custom-scrollbar"
                    />
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest flex items-center gap-2">
                            <Timer className="w-4 h-4" />
                            JEDA ANTAR GRUP
                        </label>
                        <span className="text-sm font-bold text-amber-600 dark:text-amber-500">{delaySec}S</span>
                    </div>
                    <input type="range" min="1" max="10" value={delaySec} onChange={(e) => setDelaySec(parseInt(e.target.value))} className="w-full accent-amber-500" />
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest">KARAKTER SUARA</label>
                        <div className="flex bg-slate-100 dark:bg-[#131314] p-1 rounded-xl border border-slate-200 dark:border-[#444746]">
                            {['Male', 'Female'].map(g => (
                                <button key={g} onClick={() => setActiveGenderTab(g as any)} className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${activeGenderTab === g ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-gray-400'}`}>
                                    {g === 'Male' ? 'PRIA' : 'WANITA'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                        {filteredVoices.map((v) => (
                            <button key={v.name} onClick={() => setSelectedVoice(v.name)} className={`p-4 rounded-2xl border-2 transition-all text-left relative ${selectedVoice === v.name ? 'border-indigo-500 bg-indigo-500/5 text-indigo-500 shadow-inner' : 'border-slate-100 dark:border-[#444746] hover:border-slate-300 dark:hover:border-slate-500'}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-sm font-bold flex items-center gap-2">
                                            {v.name}
                                            {(v.name === VoiceName.Kore || v.name === VoiceName.Zephyr) && <span className="text-[8px] bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase font-black">TOP CHOICE</span>}
                                        </div>
                                        <div className="text-[10px] opacity-60 font-medium uppercase mt-0.5">{v.description}</div>
                                    </div>
                                    {selectedVoice === v.name && <Check className="w-4 h-4 text-indigo-500" />}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pt-6 grid grid-cols-1 gap-4">
                    <button onClick={handlePreview} disabled={isProcessing || previewStatus !== 'idle' || !inputText} className="w-full py-4 border-2 border-slate-200 dark:border-[#444746] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-[#131314] flex items-center justify-center gap-3">
                         {previewStatus === 'generating' ? <Loader2 className="w-4 h-4 animate-spin" /> : previewStatus === 'playing' ? <Volume2 className="w-4 h-4 animate-bounce" /> : <PlayCircle className="w-4 h-4" />}
                         CEK PREVIEW SUARA
                    </button>

                    <button onClick={handleGenerateBatch} disabled={isProcessing || batchPlan.length === 0} className={`w-full py-6 rounded-3xl text-white font-black text-lg shadow-2xl transition-all ${isProcessing ? (limitWaitTime ? 'bg-amber-600 animate-pulse' : 'bg-slate-800') : 'bg-indigo-600 hover:scale-[1.02] shadow-indigo-500/20'}`}>
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-3">
                                {isProcessing ? (limitWaitTime ? <RefreshCcw className="w-6 h-6 animate-spin" /> : <Loader2 className="w-6 h-6 animate-spin" />) : <Wand2 className="w-6 h-6" />}
                                {isProcessing ? (
                                    limitWaitTime ? `RETRIEVING... (${limitWaitTime}S)` : 
                                    cooldownTime ? `JEDA: ${cooldownTime}S...` : 
                                    `MEMPROSES...`
                                ) : `MULAI PRODUKSI`}
                            </div>
                            {!isProcessing && <span className="text-[10px] opacity-60 font-bold mt-1 tracking-widest uppercase italic">{batchPlan.length} GRUP • {totalCharsOverall} KARAKTER</span>}
                        </div>
                    </button>
                </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-8">
          {/* BATCH PLANNER SECTION - DENGAN PERHITUNGAN KARAKTER */}
          {batchPlan.length > 0 && !isProcessing && items.length === 0 && (
              <div className="bg-white dark:bg-[#1e1f20] rounded-3xl border border-slate-200 dark:border-[#444746] p-8 shadow-xl">
                  <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold flex items-center gap-3 uppercase italic tracking-tighter">
                          <ListOrdered className="w-6 h-6 text-indigo-500" />
                          Batch Planner
                      </h2>
                      <div className="text-[10px] font-black text-slate-400 uppercase">{totalCharsOverall} TOTAL KARAKTER</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {batchPlan.map((p) => (
                          <div key={p.id} className="p-4 bg-slate-50 dark:bg-[#131314] rounded-2xl border border-slate-100 dark:border-[#444746] flex items-center justify-between hover:border-indigo-500/30 transition-all">
                               <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1e1f20] border border-slate-200 dark:border-[#444746] flex items-center justify-center font-black text-indigo-500 text-sm">
                                       {p.group}
                                   </div>
                                   <div className="flex flex-col">
                                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Grup #{p.group}</span>
                                       <span className="text-xs text-slate-600 italic truncate max-w-[120px] dark:text-gray-400">"{p.text.substring(0, 30)}..."</span>
                                   </div>
                               </div>
                               <div className="flex items-center gap-1.5 text-[10px] font-black text-indigo-500 bg-indigo-500/5 px-3 py-1.5 rounded-lg border border-indigo-500/10">
                                   <Type className="w-3 h-3" />
                                   {p.charCount} CHARS
                               </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#444746] pb-6 px-2">
                <h2 className="text-2xl font-black flex items-center gap-4 italic tracking-tighter uppercase">
                    <History className="w-8 h-8 text-indigo-500" />
                    History Produksi
                    <span className="bg-indigo-500 text-white text-xs px-4 py-1 rounded-full not-italic">{items.length}</span>
                </h2>
                <div className="flex items-center gap-3">
                    {items.some(i => i.status === 'completed') && (
                        <button onClick={handleDownloadZip} disabled={zipStatus !== 'idle'} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl active:scale-95">
                             {zipStatus === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                             ZIP ALL
                        </button>
                    )}
                    {items.length > 0 && (
                        <button onClick={() => { if(confirm('Hapus histori?')) { setItems([]); localStorage.removeItem(STORAGE_KEY); } }} className="p-3 text-slate-400 hover:text-red-500 transition-all">
                            <Trash2 className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {items.length === 0 ? (
                    <div className="py-32 flex flex-col items-center justify-center border-4 border-dashed border-slate-100 dark:border-[#1e1f20] rounded-[3rem] opacity-30">
                        <FileAudio className="w-20 h-20 mb-6" />
                        <p className="text-sm font-black uppercase tracking-[0.4em] italic text-center">Warehouse Empty</p>
                    </div>
                ) : (
                    items.map((item) => <ResultItem key={item.id} item={item} onRetry={() => {}} onUpload={handleUploadToCloud} />)
                )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
