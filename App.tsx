
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Trash2, Wand2, Mic, Layers, PlayCircle, AlignJustify, Settings2, DownloadCloud, Loader2, Volume2, Check, AlertTriangle, Timer, ListOrdered, FileAudio, Sparkles, History, Hash, Type, ChevronRight, AlertCircle, BookOpen, Quote, Award } from 'lucide-react';
import Header from './components/Header';
import ResultItem from './components/ResultItem';
import { TTSItem, VoiceName, VoiceGender } from './types';
import { VOICE_METADATA, STYLE_PRESETS, SAMPLE_STORY } from './constants';
import { generateSpeech } from './services/geminiService';
import { createZipFromItems } from './utils/audioHelper';

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [inputText, setInputText] = useState('');
  const [styleInstruction, setStyleInstruction] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Kore);
  const [activeGenderTab, setActiveGenderTab] = useState<VoiceGender>('Female');
  const [linesPerBatch, setLinesPerBatch] = useState(1);
  const [delaySec, setDelaySec] = useState(5); 

  const [items, setItems] = useState<(TTSItem & { groupIndex?: number; retryCount?: number; isWaitingLimit?: boolean })[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cooldownTime, setCooldownTime] = useState<number | null>(null);
  const [limitWaitTime, setLimitWaitTime] = useState<number | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'generating' | 'playing'>('idle');
  const [zipStatus, setZipStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

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
        id: `plan-${i}`,
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
    const newItems: (TTSItem & { groupIndex: number; retryCount: number })[] = batchPlan.map((p) => ({
      id: Math.random().toString(36).substring(2, 15),
      text: p.text.trim(),
      status: 'pending',
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
          setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, status: 'completed', audioUrl, retryCount: attempts } : it));
          success = true;
        } catch (error: any) {
          const errorMsg = error.message || "Unknown error";
          const isRateLimit = errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("limit");
          
          if (isRateLimit) {
             const waitSec = Math.floor(Math.random() * (120 - 90 + 1)) + 90;
             setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, isWaitingLimit: true, errorMsg: "Limit tercapai, mendinginkan..." } : it)));
             
             for (let t = waitSec; t > 0; t--) {
                setLimitWaitTime(t);
                await new Promise(r => setTimeout(r, 1000));
             }
             setLimitWaitTime(null);
          } else {
             // Berhenti sementara jika ada error serius (bukan limit)
             setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: 'error', errorMsg: errorMsg } : it)));
             await new Promise(r => setTimeout(r, 5000));
             // Lanjutkan retry otomatis setelah 5 detik
          }
        }
      }

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
                <h2 className="text-xl font-bold flex items-center gap-3">
                    <Settings2 className="w-6 h-6 text-indigo-500" />
                    STUDIO PRODUKSI
                </h2>
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#131314] px-4 py-2 rounded-2xl border border-slate-200 dark:border-[#444746]">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lines/Batch:</span>
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
                    <div className="relative group">
                        <input 
                            type="text"
                            value={styleInstruction}
                            onChange={(e) => setStyleInstruction(e.target.value)}
                            placeholder="Sesuaikan instruksi gaya di sini..."
                            className="w-full bg-slate-50 dark:bg-[#131314] border border-slate-200 dark:border-[#444746] rounded-2xl px-5 py-4 text-sm focus:border-indigo-500 outline-none italic pr-10"
                        />
                        <Mic className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 opacity-50 group-hover:opacity-100" />
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                         <label className="text-xs font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest">NASKAH NARASI</label>
                         <button 
                            onClick={loadSampleStory}
                            className="flex items-center gap-2 text-[10px] font-black text-amber-600 dark:text-amber-500 hover:opacity-80 transition-opacity"
                         >
                             <Quote className="w-3.5 h-3.5" />
                             MUAT CONTOH REFLEKSI
                         </button>
                    </div>
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Masukkan naskah personal Anda di sini..."
                        className="w-full h-48 bg-slate-50 dark:bg-[#131314] border border-slate-200 dark:border-[#444746] rounded-3xl p-6 text-sm leading-relaxed focus:border-indigo-500 outline-none resize-none custom-scrollbar"
                    />
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest flex items-center gap-2">
                            <Timer className="w-4 h-4" />
                            SAFETY DELAY (JEDA)
                        </label>
                        <span className="text-sm font-bold text-amber-600 dark:text-amber-500">{delaySec} DETIK</span>
                    </div>
                    <input 
                        type="range" min="1" max="60" 
                        value={delaySec} 
                        onChange={(e) => setDelaySec(parseInt(e.target.value))}
                        className="w-full accent-amber-500"
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest">PILIH KARAKTER SUARA</label>
                        <div className="flex bg-slate-100 dark:bg-[#131314] p-1 rounded-xl">
                            {['Male', 'Female'].map(g => (
                                <button key={g} onClick={() => setActiveGenderTab(g as any)} className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${activeGenderTab === g ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>
                                    {g === 'Male' ? 'PRIA' : 'WANITA'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {filteredVoices.map((v) => {
                            const isRecommended = v.name === VoiceName.Kore || v.name === VoiceName.Zephyr;
                            return (
                                <button key={v.name} onClick={() => setSelectedVoice(v.name)} className={`p-4 rounded-2xl border-2 transition-all text-left relative overflow-hidden ${selectedVoice === v.name ? 'border-indigo-500 bg-indigo-500/5 text-indigo-500 shadow-inner' : 'border-slate-100 dark:border-[#444746] hover:border-slate-300 dark:hover:border-slate-500'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-sm font-bold flex items-center gap-2">
                                                {v.name}
                                                {isRecommended && (
                                                    <span className="flex items-center gap-1 bg-amber-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                        <Award className="w-2.5 h-2.5" />
                                                        PRO CHOICE
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] opacity-60 font-medium uppercase mt-0.5">{v.description}</div>
                                        </div>
                                        {selectedVoice === v.name && <Check className="w-4 h-4 text-indigo-500" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="pt-6 grid grid-cols-1 gap-4">
                    <button onClick={handlePreview} disabled={isProcessing || previewStatus !== 'idle' || !inputText} className="w-full py-4 border-2 border-slate-200 dark:border-[#444746] rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-[#131314] flex items-center justify-center gap-3">
                         {previewStatus === 'generating' ? <Loader2 className="w-4 h-4 animate-spin" /> : previewStatus === 'playing' ? <Volume2 className="w-4 h-4 animate-bounce" /> : <PlayCircle className="w-4 h-4" />}
                         TES PREVIEW
                    </button>
                    
                    <button onClick={handleGenerateBatch} disabled={isProcessing || batchPlan.length === 0} className={`w-full py-6 rounded-3xl text-white font-black text-lg shadow-2xl transition-all ${isProcessing ? (limitWaitTime ? 'bg-red-600' : 'bg-slate-800') : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 shadow-indigo-500/20'}`}>
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-3">
                                {isProcessing ? (limitWaitTime ? <AlertCircle className="w-6 h-6 animate-pulse" /> : <Loader2 className="w-6 h-6 animate-spin" />) : <Wand2 className="w-6 h-6" />}
                                {isProcessing ? (
                                    limitWaitTime ? `LIMIT: TUNGGU ${limitWaitTime}S...` : 
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
          {batchPlan.length > 0 && (
              <div className="bg-white dark:bg-[#1e1f20] rounded-3xl border border-slate-200 dark:border-[#444746] p-8 shadow-xl">
                  <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold flex items-center gap-3">
                          <ListOrdered className="w-6 h-6 text-indigo-500" />
                          BATCH PLANNER
                      </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {batchPlan.map((p) => (
                          <div key={p.id} className="p-4 bg-slate-50 dark:bg-[#131314] rounded-2xl border border-slate-100 dark:border-[#444746] flex items-center justify-between hover:border-indigo-500/30 transition-all group">
                               <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#1e1f20] border border-slate-200 dark:border-[#444746] flex items-center justify-center font-black text-indigo-500 text-sm">
                                       {p.group}
                                   </div>
                                   <div className="flex flex-col">
                                       <span className="text-[10px] font-black text-slate-400 uppercase">Grup #{p.group}</span>
                                       <span className="text-xs text-slate-600 italic truncate max-w-[120px] dark:text-gray-400">"{p.text.substring(0, 30)}..."</span>
                                   </div>
                               </div>
                               <div className="flex items-center gap-3">
                                   <div className="flex items-center gap-1.5 text-[10px] font-black text-indigo-500 bg-indigo-500/5 px-3 py-1.5 rounded-lg border border-indigo-500/10">
                                       <Type className="w-3 h-3" />
                                       {p.charCount} CHARS
                                   </div>
                               </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#444746] pb-6 px-2">
                <h2 className="text-2xl font-black flex items-center gap-4 italic tracking-tighter">
                    <History className="w-8 h-8 text-indigo-500" />
                    PRODUCTION HISTORY
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
                        <button onClick={() => { if(confirm('Hapus gudang?')) setItems([]) }} className="p-3 text-slate-400 hover:text-red-500 transition-all">
                            <Trash2 className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {items.length === 0 ? (
                    <div className="py-32 flex flex-col items-center justify-center border-4 border-dashed border-slate-100 dark:border-[#1e1f20] rounded-[3rem] opacity-30">
                        <FileAudio className="w-20 h-20 mb-6" />
                        <p className="text-sm font-black uppercase tracking-[0.4em] italic">Warehouse Empty</p>
                    </div>
                ) : (
                    items.map((item) => <ResultItem key={item.id} item={item} onRetry={() => {}} />)
                )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
