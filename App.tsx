import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Trash2, Wand2, PlayCircle, DownloadCloud, Loader2, Volume2, Check, Timer, ListOrdered, FileAudio, Sparkles, History, Quote, Zap, RotateCcw } from 'lucide-react';
import Header from './components/Header';
import ResultItem from './components/ResultItem';
import { TTSItem, VoiceName, VoiceGender } from './types';
import { VOICE_METADATA, STYLE_PRESETS, SAMPLE_STORY } from './constants';
import { generateSpeech } from './services/geminiService';
import { createZipFromItems } from './utils/audioHelper';

const STORAGE_KEY = 'bacot_pro_v1';

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
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setItems(parsed.map(i => ({ 
            ...i, 
            status: i.status === 'processing' ? 'pending' : i.status,
            isWaitingLimit: false
          })));
        }
      }
    } catch (e) {
      console.error("History recovery failed:", e);
    }
  }, []);

  // Persistence: Save
  useEffect(() => {
    try {
      if (items.length > 0) {
        const toSave = items.map(({ audioUrl, ...rest }) => rest);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      }
    } catch (e) {
      console.error("History saving failed:", e);
    }
  }, [items]);

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
      plan.push({ id: `p-${i}-${Date.now()}`, group: Math.floor(i / linesPerBatch) + 1, text: chunk });
    }
    return plan;
  }, [allLines, linesPerBatch]);

  const handlePreview = async () => {
    if (!inputText.trim()) return;
    setPreviewStatus('generating');
    try {
      const sample = allLines[0] || inputText.substring(0, 100);
      const blob = await generateSpeech(sample, selectedVoice, styleInstruction, inputText);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      setPreviewStatus('playing');
      await audio.play();
      audio.onended = () => { setPreviewStatus('idle'); URL.revokeObjectURL(url); };
    } catch (e: any) {
      alert(`Preview Error: ${e.message}`);
      setPreviewStatus('idle');
    }
  };

  const handleGenerateBatch = useCallback(async () => {
    if (batchPlan.length === 0) return;
    setIsProcessing(true);

    const newItems = batchPlan.map(p => ({
      id: Math.random().toString(36).substring(2, 9),
      text: p.text,
      status: 'pending' as const,
      voice: selectedVoice,
      groupIndex: p.group
    }));

    setItems(prev => [...newItems, ...prev]);

    for (let i = 0; i < newItems.length; i++) {
      const current = newItems[i];
      let success = false;
      let attempt = 0;

      while (!success && attempt < 3) {
        attempt++;
        setItems(prev => prev.map(it => it.id === current.id ? { ...it, status: 'processing', retryCount: attempt } : it));
        
        try {
          const blob = await generateSpeech(current.text, current.voice, styleInstruction, inputText);
          const url = URL.createObjectURL(blob);
          setItems(prev => prev.map(it => it.id === current.id ? { ...it, status: 'completed', audioUrl: url, isWaitingLimit: false } : it));
          success = true;
        } catch (err: any) {
          const msg = err.message.toLowerCase();
          const isLimit = msg.includes('429') || msg.includes('quota') || msg.includes('limit');
          
          if (isLimit) {
            setItems(prev => prev.map(it => it.id === current.id ? { ...it, isWaitingLimit: true, errorMsg: 'Mencoba rotasi kunci...' } : it));
            for (let t = 3; t > 0; t--) { setLimitWaitTime(t); await new Promise(r => setTimeout(r, 1000)); }
            setLimitWaitTime(null);
            // Lanjut ke percobaan berikutnya dengan kunci berbeda (rotasi terjadi di getClient)
          } else {
            setItems(prev => prev.map(it => it.id === current.id ? { ...it, status: 'error', errorMsg: err.message } : it));
            break;
          }
        }
      }

      if (success && i < newItems.length - 1) {
        for (let t = delaySec; t > 0; t--) { setCooldownTime(t); await new Promise(r => setTimeout(r, 1000)); }
        setCooldownTime(null);
      }
    }
    setIsProcessing(false);
  }, [batchPlan, selectedVoice, styleInstruction, delaySec, inputText]);

  const handleUploadToCloud = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || !item.audioUrl || item.isUploading) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, isUploading: true } : i));
    try {
      const response = await fetch(item.audioUrl);
      const blob = await response.blob();
      const fileName = `bacot_${id.substring(0, 6)}.wav`;
      const up = await fetch(`https://transfer.sh/${fileName}`, { method: 'PUT', body: blob });
      const cloudUrl = await up.text();
      setItems(prev => prev.map(i => i.id === id ? { ...i, cloudUrl, isUploading: false } : i));
    } catch (e: any) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, isUploading: false, errorMsg: e.message } : i));
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c0d] text-[#e3e3e3] flex flex-col font-sans selection:bg-indigo-500/30">
      <Header isDarkMode={isDarkMode} toggleTheme={toggleTheme} />

      <main className="flex-grow max-w-[1400px] w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Kontrol Studio */}
        <div className="lg:col-span-5">
          <div className="bg-[#1e1f20] rounded-[2.5rem] border border-[#444746] p-8 shadow-2xl sticky top-24">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                    <Zap className="w-6 h-6 text-indigo-500 fill-current" />
                    Studio Produksi
                </h2>
                <button onClick={() => { if(confirm('Reset semua data?')) { localStorage.clear(); window.location.reload(); } }} className="p-2 text-slate-500 hover:text-indigo-400 transition-all">
                    <RotateCcw className="w-5 h-5" />
                </button>
            </div>

            <div className="space-y-6">
                <div className="bg-[#131314] p-5 rounded-2xl border border-[#444746] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ListOrdered className="w-5 h-5 text-indigo-500" />
                        <span className="text-[10px] font-black uppercase text-slate-400">Baris Per Grup</span>
                    </div>
                    <input type="number" value={linesPerBatch} onChange={e => setLinesPerBatch(Math.max(1, parseInt(e.target.value) || 1))} className="bg-transparent w-10 text-center text-lg font-black text-indigo-500 focus:outline-none" />
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 px-1">Gaya Narasi</label>
                    <div className="flex flex-wrap gap-2">
                        {STYLE_PRESETS.map(s => (
                            <button key={s.id} onClick={() => setStyleInstruction(s.value)} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${styleInstruction === s.value ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-[#131314] border-[#444746] text-slate-400 hover:border-indigo-500/50'}`}>
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                         <label className="text-[10px] font-black uppercase text-slate-400">Naskah Master</label>
                         <button onClick={() => setInputText(SAMPLE_STORY)} className="text-[9px] font-black text-indigo-400 hover:underline flex items-center gap-1 uppercase">
                             <Quote className="w-3 h-3" /> Muat Contoh
                         </button>
                    </div>
                    <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Masukkan naskah narasi..." className="w-full h-40 bg-[#131314] border border-[#444746] rounded-2xl p-5 text-sm focus:border-indigo-500 outline-none resize-none transition-all" />
                </div>

                <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-indigo-400 uppercase flex items-center gap-2">
                            <Timer className="w-4 h-4" /> Delay Antar Grup
                        </label>
                        <span className="text-sm font-black text-indigo-400">{delaySec}s</span>
                    </div>
                    <input type="range" min="1" max="10" value={delaySec} onChange={e => setDelaySec(parseInt(e.target.value))} className="w-full accent-indigo-600 h-1" />
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase text-slate-400">Karakter Suara</label>
                        <div className="flex bg-[#131314] p-1 rounded-xl border border-[#444746]">
                            {['Male', 'Female'].map(g => (
                                <button key={g} onClick={() => setActiveGenderTab(g as any)} className={`px-3 py-1.5 text-[9px] font-black rounded-lg transition-all ${activeGenderTab === g ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>
                                    {g === 'Male' ? 'PRIA' : 'WANITA'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        {filteredVoices.map(v => (
                            <button key={v.name} onClick={() => setSelectedVoice(v.name)} className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between ${selectedVoice === v.name ? 'border-indigo-500 bg-indigo-500/5 text-indigo-500' : 'border-[#444746] hover:border-slate-600'}`}>
                                <div>
                                    <div className="text-sm font-black">{v.name}</div>
                                    <div className="text-[10px] opacity-60 font-medium uppercase">{v.description}</div>
                                </div>
                                {selectedVoice === v.name && <Check className="w-4 h-4" />}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pt-4 grid grid-cols-1 gap-3">
                    <button onClick={handlePreview} disabled={isProcessing || !inputText} className="w-full py-4 border border-[#444746] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#131314] flex items-center justify-center gap-3 transition-all">
                         {previewStatus === 'generating' ? <Loader2 className="w-4 h-4 animate-spin" /> : previewStatus === 'playing' ? <Volume2 className="w-4 h-4 animate-bounce" /> : <PlayCircle className="w-4 h-4" />}
                         Test Sample Suara
                    </button>
                    <button onClick={handleGenerateBatch} disabled={isProcessing || batchPlan.length === 0} className={`w-full py-6 rounded-3xl text-white font-black text-lg shadow-xl transition-all ${isProcessing ? 'bg-slate-800' : 'bg-indigo-600 hover:scale-[1.02] shadow-indigo-500/20 active:scale-95'}`}>
                         <div className="flex flex-col items-center">
                            <div className="flex items-center gap-3">
                                {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Wand2 className="w-6 h-6" />}
                                {isProcessing ? (limitWaitTime ? `ROTATING KEYS... (${limitWaitTime}s)` : cooldownTime ? `PAUSE... (${cooldownTime}s)` : `PROCESSING BATCH...`) : `MULAI PRODUKSI`}
                            </div>
                            {!isProcessing && <span className="text-[9px] opacity-60 font-bold uppercase tracking-widest mt-1 italic">{batchPlan.length} Grup • {inputText.length} Karakter</span>}
                         </div>
                    </button>
                </div>
            </div>
          </div>
        </div>

        {/* Output Logs */}
        <div className="lg:col-span-7 space-y-8">
          <div className="flex items-center justify-between border-b border-[#444746] pb-6 px-2">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-4">
                  <History className="w-8 h-8 text-indigo-500" />
                  Gudang Produksi
                  <span className="bg-indigo-600 text-white text-[10px] px-3 py-1 rounded-full not-italic tracking-normal">{items.length}</span>
              </h2>
              <div className="flex items-center gap-3">
                {items.some(i => i.status === 'completed') && (
                    <button onClick={async () => {
                        setZipStatus('processing');
                        try {
                            const blob = await createZipFromItems(items);
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a'); a.href = url; a.download = `bacot_batch_${Date.now()}.zip`; a.click();
                            setZipStatus('success'); setTimeout(() => setZipStatus('idle'), 3000);
                        } catch { setZipStatus('error'); }
                    }} disabled={zipStatus === 'processing'} className="bg-white text-[#0b0c0d] px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
                        {zipStatus === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                        Simpan ZIP
                    </button>
                )}
                <button onClick={() => { if(confirm('Hapus histori?')) setItems([]); }} className="p-3 text-slate-500 hover:text-red-400 transition-all"><Trash2 className="w-6 h-6" /></button>
              </div>
          </div>

          <div className="flex flex-col gap-4">
              {items.length === 0 ? (
                  <div className="py-40 flex flex-col items-center justify-center border-2 border-dashed border-[#444746] rounded-[3rem] opacity-20">
                      <FileAudio className="w-16 h-16 mb-4" />
                      <p className="text-xs font-black uppercase tracking-[0.3em] italic">Belum Ada Hasil Produksi</p>
                  </div>
              ) : (
                  items.map(item => <ResultItem key={item.id} item={item} onRetry={() => {}} onUpload={handleUploadToCloud} />)
              )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;