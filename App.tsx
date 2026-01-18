
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Trash2, Wand2, PlayCircle, Settings2, DownloadCloud, Loader2, Check, Timer, History, FileAudio, Key, FileJson, Sparkles, AlertTriangle, Zap } from 'lucide-react';
import Header from './components/Header';
import ResultItem from './components/ResultItem';
import { TTSItem, VoiceName, VoiceGender } from './types';
import { VOICE_METADATA, STYLE_PRESETS, SAMPLE_STORY } from './constants';
import { generateSpeech } from './services/geminiService';
import { createZipFromItems } from './utils/audioHelper';

const STORAGE_KEY = 'ngabacot_production_v3';

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

  const batchPlan = useMemo(() => {
    const lines = inputText.split('\n').filter(l => l.trim().length > 0);
    const plan = [];
    for (let i = 0; i < lines.length; i += linesPerBatch) {
      plan.push({
        id: `plan-${i}-${Date.now()}`,
        group: Math.floor(i / linesPerBatch) + 1,
        text: lines.slice(i, i + linesPerBatch).join('\n'),
      });
    }
    return plan;
  }, [inputText, linesPerBatch]);

  const handlePreview = async () => {
    if (!inputText.trim()) return;
    setPreviewStatus('generating');
    try {
      const wavBlob = await generateSpeech(inputText.split('\n')[0], selectedVoice, styleInstruction, inputText);
      const audioUrl = URL.createObjectURL(wavBlob);
      const audio = new Audio(audioUrl);
      setPreviewStatus('playing');
      await audio.play();
      audio.onended = () => { setPreviewStatus('idle'); URL.revokeObjectURL(audioUrl); };
    } catch (e: any) {
      alert(e.message);
      setPreviewStatus('idle');
    }
  };

  const handleGenerateBatch = useCallback(async () => {
    if (batchPlan.length === 0) return;
    const currentContext = inputText;
    const newItems = batchPlan.map(p => ({
      id: Math.random().toString(36).substring(2, 11),
      text: p.text,
      status: 'pending' as const,
      voice: selectedVoice,
      groupIndex: p.group,
      retryCount: 0
    }));
    
    setItems(prev => [...newItems, ...prev]);
    setIsProcessing(true);

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      let success = false;
      let attempt = 0;

      // INFINITE LOOP: Akan terus mencoba sampai baris ini berhasil (success = true)
      while (!success) {
        attempt++;
        setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'processing', retryCount: attempt, isWaitingLimit: false } : it));
        
        try {
          // Setiap percobaan akan memanggil generateSpeech yang mengambil process.env.API_KEY terbaru
          const wav = await generateSpeech(item.text, item.voice, styleInstruction, currentContext);
          const audioUrl = URL.createObjectURL(wav);
          setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'completed', audioUrl, isWaitingLimit: false } : it));
          success = true; // Keluar dari loop while untuk baris ini
        } catch (err: any) {
          const msg = err.message || "";
          const is429 = msg.includes("429") || msg.toLowerCase().includes("quota");
          
          if (is429) {
            // Berhenti sejenak (2 detik) agar user bisa ganti API Key di Header
            setItems(prev => prev.map(it => it.id === item.id ? { ...it, isWaitingLimit: true, errorMsg: "LIMIT! GANTI API KEY (3 DTK)..." } : it));
            for (let t = 2; t > 0; t--) {
              setLimitWaitTime(t);
              await new Promise(r => setTimeout(r, 1000));
            }
            // Setelah 2 detik, loop while akan mengulang ke atas dan memanggil API lagi dengan Key baru
          } else {
            // Jika error bukan limit (misal: sensor konten), kita menyerah pada baris ini agar tidak nyangkut selamanya
            setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'error', errorMsg: msg } : it));
            await new Promise(r => setTimeout(r, 1000));
            break; 
          }
        }
      }
      
      setLimitWaitTime(null);
      
      // Jeda antar baris normal jika sukses (Safety delay agar tidak cepat kena limit lagi)
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0c0d] text-slate-900 dark:text-[#e3e3e3] flex flex-col font-sans transition-colors duration-300">
      <Header isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
      
      <main className="flex-grow max-w-[1600px] w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Section: Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-[#1e1f20] rounded-[2rem] border border-slate-200 dark:border-[#444746] p-8 shadow-xl sticky top-24">
            <h2 className="text-xl font-black flex items-center gap-3 mb-8 uppercase italic">
              <Zap className="w-6 h-6 text-indigo-500 fill-current" />
              Studio Produksi
            </h2>
            
            <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Gaya Narasi</label>
                  <div className="flex flex-wrap gap-2">
                    {STYLE_PRESETS.map(s => (
                      <button key={s.id} onClick={() => setStyleInstruction(s.value)} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${styleInstruction === s.value ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-[#131314] border-slate-200 dark:border-[#444746] text-slate-600 dark:text-gray-400'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Input Naskah (Baris Demi Baris)</label>
                  <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Tulis naskah..." className="w-full h-40 bg-slate-50 dark:bg-[#131314] border border-slate-200 dark:border-[#444746] rounded-[2rem] p-6 text-sm outline-none resize-none custom-scrollbar" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-[#131314] p-4 rounded-2xl border border-slate-200 dark:border-[#444746]">
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 text-center">Baris per Batch</label>
                    <input type="number" value={linesPerBatch} onChange={e => setLinesPerBatch(Math.max(1, parseInt(e.target.value) || 1))} className="bg-transparent text-indigo-500 font-bold outline-none w-full text-center" />
                  </div>
                  <div className="bg-slate-50 dark:bg-[#131314] p-4 rounded-2xl border border-slate-200 dark:border-[#444746]">
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-2 text-center">Jeda Sukses: {delaySec}s</label>
                    <input type="range" min="1" max="10" value={delaySec} onChange={e => setDelaySec(parseInt(e.target.value))} className="w-full accent-indigo-500" />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Pilih Karakter</label>
                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                    {Object.values(VOICE_METADATA).map(v => (
                      <button key={v.name} onClick={() => setSelectedVoice(v.name)} className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedVoice === v.name ? 'border-indigo-500 bg-indigo-500/5 text-indigo-500' : 'border-slate-100 dark:border-[#444746]'}`}>
                        <div className="text-sm font-bold flex justify-between items-center">{v.name} {selectedVoice === v.name && <Check className="w-4 h-4" />}</div>
                        <div className="text-[9px] opacity-60 uppercase">{v.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={handleGenerateBatch} 
                    disabled={isProcessing || batchPlan.length === 0} 
                    className={`w-full py-6 rounded-[2rem] text-white font-black text-lg shadow-2xl transition-all ${
                      isProcessing 
                        ? (limitWaitTime ? 'bg-red-600 animate-pulse' : 'bg-slate-800') 
                        : 'bg-indigo-600 hover:scale-[1.02]'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-3">
                      {isProcessing ? (limitWaitTime ? <AlertTriangle className="w-6 h-6" /> : <Loader2 className="animate-spin w-6 h-6" />) : <Wand2 className="w-6 h-6" />}
                      {isProcessing 
                        ? (limitWaitTime ? `LIMIT: GANTI KEY (${limitWaitTime}s)` : `MEMPROSES BATCH...`) 
                        : `PRODUKSI BATCH SEKARANG`}
                    </div>
                  </button>
                </div>
            </div>
          </div>
        </div>

        {/* Right Section: History */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#444746] pb-6 px-2">
            <h2 className="text-2xl font-black flex items-center gap-4 italic tracking-tighter uppercase">
              <History className="w-8 h-8 text-indigo-500" />
              History Produksi
            </h2>
            <div className="flex items-center gap-2">
              {items.some(i => i.status === 'completed') && (
                <button onClick={async () => {
                  const zip = await createZipFromItems(items);
                  const url = URL.createObjectURL(zip);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ngabacot_${Date.now()}.zip`;
                  a.click();
                }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg transition-all">
                   <DownloadCloud className="w-4 h-4" /> ZIP SEMUA
                </button>
              )}
              {items.length > 0 && (
                <button onClick={() => { if(confirm('Hapus histori?')) { setItems([]); localStorage.removeItem(STORAGE_KEY); } }} className="p-3 text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-6 h-6" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {items.map(item => (
              <ResultItem 
                key={item.id} 
                item={item} 
                onRetry={() => {}} 
                onUpload={handleUploadToCloud} 
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
