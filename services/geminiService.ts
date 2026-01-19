import { GoogleGenAI, Modality } from "@google/genai";
import { TTS_MODEL } from "../constants";
import { VoiceName } from "../types";
import { base64ToUint8Array, pcmToWavBlob } from "../utils/audioHelper";

/**
 * Mendapatkan API Key secara aman dari environment variables.
 * Mendukung format string tunggal atau daftar kunci dipisahkan koma.
 */
const getApiKeySafe = (): string => {
  try {
    // Mencoba akses process.env dengan berbagai fallback
    const rawKey = (typeof process !== 'undefined' && process.env?.API_KEY) || 
                   (window as any).process?.env?.API_KEY || 
                   "";
    
    if (!rawKey) return "";

    // Memecah kunci jika ada banyak (Multi-Key Rotation)
    const keys = rawKey.split(',').map(k => k.trim()).filter(k => k.length > 0);
    if (keys.length === 0) return "";

    // Memilih satu kunci secara acak untuk load balancing/rotasi
    return keys[Math.floor(Math.random() * keys.length)];
  } catch (e) {
    console.warn("Gagal mengakses API_KEY:", e);
    return "";
  }
};

const getClient = () => {
  const apiKey = getApiKeySafe();
  if (!apiKey) {
    throw new Error("API_KEY tidak ditemukan. Pastikan variabel lingkungan sudah disetel di Vercel/Studio.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Melakukan generate speech dengan instruksi konsistensi suara yang ketat.
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

  // Membangun konteks memori untuk AI agar intonasi tetap terjaga
  let contextBefore = "";
  if (fullContext) {
    const index = fullContext.indexOf(text);
    if (index > 0) {
      contextBefore = fullContext.substring(Math.max(0, index - 1500), index);
    }
  }

  const prompt = `
# SYSTEM INSTRUCTION: CONSISTENCY LOCK
You are a high-end AI Voice Engine in a long recording session.
TOTAL CONSISTENCY IS REQUIRED.

## PERSONA:
- Voice ID: ${voice}
- Style: ${style}
- Flow: Mid-narration continuation

## RULES:
1. NO pitch, volume, or energy shifts.
2. NO speed changes.
3. Keep the exact same personality as before.
4. NO intro/outro pauses or breathing sounds.
5. This is a FLUID narration, not a list reading.

## MEMORY (DO NOT SPEAK):
"${contextBefore || 'Start of session.'}"

## TEXT TO SPEAK (SPEAK ONLY THIS):
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
      if (finishReason === 'SAFETY') throw new Error("Diblokir oleh filter keamanan (Safety Filter).");
      throw new Error(`TTS Gagal: ${finishReason || 'Alasan tidak diketahui'}`);
    }

    const pcmData = base64ToUint8Array(base64Audio);
    return pcmToWavBlob(pcmData);

  } catch (error: any) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
};