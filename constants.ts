
import { VoiceName, VoiceInfo } from './types';

export const VOICE_METADATA: Record<VoiceName, VoiceInfo> = {
  [VoiceName.Kore]: { 
    name: VoiceName.Kore, 
    gender: 'Female', 
    description: 'Deeply Reflective & Warm (Best for Personal Stories)' 
  },
  [VoiceName.Puck]: { 
    name: VoiceName.Puck, 
    gender: 'Male', 
    description: 'Bright & Energetic (Upbeat Tone)' 
  },
  [VoiceName.Charon]: { 
    name: VoiceName.Charon, 
    gender: 'Male', 
    description: 'Deep & Authoritative (Commanding Presence)' 
  },
  [VoiceName.Fenrir]: { 
    name: VoiceName.Fenrir, 
    gender: 'Male', 
    description: 'Dramatic & Intense (Cinematic Narration)' 
  },
  [VoiceName.Zephyr]: { 
    name: VoiceName.Zephyr, 
    gender: 'Female', 
    description: 'Clear & Professional (Best for Documentaries & News)' 
  },
};

export const STYLE_PRESETS = [
  { 
    id: 'pribadi', 
    label: '🎙️ Narasi Pribadi', 
    value: 'sincere first-person narrative, reflective, calm, and deeply emotional with natural pauses as if sharing a life secret' 
  },
  { 
    id: 'deep-story', 
    label: '📖 Deep Storytelling', 
    value: 'professional voice actor, captivating and soulful storytelling, perfect for documentaries, dramatic and engaging intonation' 
  },
  { 
    id: 'podcast', 
    label: '🎧 Podcast Santai', 
    value: 'natural conversational tone, friendly, approachable, and relaxed like talking to a close friend' 
  },
  { 
    id: 'inspirasi', 
    label: '✨ Inspiratif', 
    value: 'motivational, empowering, rising intonation, and full of hope' 
  },
  { 
    id: 'formal-news', 
    label: '💼 Narator Berita', 
    value: 'authoritative, objective, clear articulation, and professional broadcasting style' 
  },
  { 
    id: 'sedih-dalam', 
    label: '🌑 Melankolis', 
    value: 'vulnerable, somber, slow pace, and heavy with emotion for sad reflections' 
  },
  { 
    id: 'cinematic', 
    label: '🎬 Trailer / Epik', 
    value: 'epic cinematic narrator, deep resonance, slow and powerful delivery' 
  },
];

export const SAMPLE_STORY = `Aku sering bertanya pada diriku sendiri, kapan semua ini akan berakhir.
Dulu, aku hanyalah seseorang yang takut pada kegagalan.
Setiap langkah yang kuambil, selalu dibayangi oleh keraguan yang mendalam.
Tapi sekarang, saat aku melihat ke belakang, aku sadar sesuatu.
Luka-luka itulah yang sebenarnya membentuk siapa aku hari ini.
Tidak ada keberhasilan yang datang tanpa pengorbanan yang menyakitkan.
Mungkin ini adalah babak baru dalam hidupku.
Babak di mana aku tidak lagi berlari dari rasa takut.
Melainkan berjalan bersamanya, menuju cahaya yang lebih terang.
Inilah ceritaku, dan aku bangga telah melaluinya.`;

export const SAMPLE_RATE = 24000; 
export const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
export const ANALYSIS_MODEL = 'gemini-2.5-flash';
