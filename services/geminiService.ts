
import { GoogleGenAI, Modality } from "@google/genai";
import { TTS_MODEL } from "../constants";
import { VoiceName } from "../types";
import { base64ToUint8Array, pcmToWavBlob } from "../utils/audioHelper";

/**
 * Mendapatkan API Key secara aman dari environment.
 */
const getApiKeyString = (): string => {
  try {
    // Mencoba mengakses process.env dengan aman
    // @ts-ignore
    const env = typeof process !== 'undefined' ? process.env : (window as any).process?.env;
    return env?.API_KEY || "";
  } catch (e) {
    console.warn("Gagal mengakses process.env:", e);
    return "";
  }
};

const getRandomApiKey = (): string => {
  const rawKeys = getApiKeyString();
  
  if (!rawKeys || rawKeys.trim() === "") {
    // Jangan lempar error di level modul agar aplikasi tidak crash saat load
    return ""; 
  }

  const keys = rawKeys.split(/[,;\s\n]+/).map(k => k.trim()).filter(k => k.length > 0);
  if (keys.length === 0) return "";

  const randomIndex = Math.floor(Math.random() * keys.length);
  return keys[randomIndex];
};

const getClient = () => {
  const apiKey = getRandomApiKey();
  if (!apiKey) {
    throw new Error("API Key tidak ditemukan. Pastikan API_KEY sudah disetel di Vercel Environment Variables.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Generates speech with consistency lock to ensure seamless narration between chunks.
 */
export const generateSpeech = async (
  text: string, 
  voice: VoiceName,
  styleInstruction?: string,
  fullContext?: string 
): Promise<Blob> => {
  const ai = getClient();
  const style = styleInstruction || "natural and professional";
  const cleanText = text.replace(/^["']|["']$/g, '').trim();

  let contextBefore = "";
  if (fullContext) {
    const index = fullContext.indexOf(text);
    if (index > 0) {
      contextBefore = fullContext.substring(Math.max(0, index - 1200), index).trim();
    }
  }

  const prompt = `
# SYSTEM INSTRUCTION: CONSISTENCY LOCK
You are a professional voice actor recording a continuous audiobook. 
Maintain 100% consistency in tone, speed, and energy.

## RULES:
1. NO INTRO/OUTRO silence or breathing.
2. CONTINUATION: Speak as if this is the middle of a sentence.
3. ENERGY: Matches the previous context exactly.
4. Voice: ${voice} | Style: ${style}

## PREVIOUS CONTEXT (DO NOT SPEAK):
"...${contextBefore || 'Beginning of the recording.'}"

## TEXT TO SPEAK NOW:
${cleanText}
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY') throw new Error("Diblokir oleh Filter Keamanan");
      throw new Error(`TTS Gagal: ${finishReason || 'Alasan tidak diketahui'}`);
    }

    const pcmData = base64ToUint8Array(base64Audio);
    return pcmToWavBlob(pcmData);

  } catch (error: any) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
};
