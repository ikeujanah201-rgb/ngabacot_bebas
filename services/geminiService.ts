
import { GoogleGenAI, Modality } from "@google/genai";
import { TTS_MODEL } from "../constants";
import { VoiceName } from "../types";
import { base64ToUint8Array, pcmToWavBlob } from "../utils/audioHelper";

const getClient = () => {
  const keysString = process.env.GEMINI_API_KEYS;
  if (!keysString) {
    throw new Error("GEMINI_API_KEYS is missing. Please check .env.local or Vercel Settings.");
  }

  // 2. LOGIKA BARU: Pecah string berdasarkan koma (,) dan bersihkan spasi
  const keys = keysString.split(',').map(key => key.trim()).filter(key => key.length > 0);

  // 3. PILIH ACAK: Ambil satu kunci secara random dari daftar
  const randomKey = keys[Math.floor(Math.random() * keys.length)];

  // 4. Masukkan kunci terpilih ke GoogleGenAI
  return new GoogleGenAI({ apiKey: randomKey });
};

/**
 * Generates speech with a strict consistency lock for professional narration.
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

  // Menyediakan konteks sebelumnya agar model "mengingat" aliran emosi
  let contextBefore = "";
  if (fullContext) {
    const index = fullContext.indexOf(text);
    if (index > 0) {
      // Ambil 1500 karakter sebelumnya untuk konteks memori suara yang kuat
      contextBefore = fullContext.substring(Math.max(0, index - 1500), index);
    }
  }

  // Prompt dengan instruksi KONSISTENSI TOTAL
  const prompt = `
# SYSTEM INSTRUCTION: CONSISTENCY LOCK
You are a high-end AI Voice Engine. You are currently in the middle of a LONG recording session.
Consistency is your HIGHEST priority. 

## YOUR PERSONA:
- Voice ID: ${voice}
- Style: ${style}
- State: Mid-narration (seamless flow required)

## RULES FOR TOTAL CONSISTENCY:
1. DO NOT change your pitch, volume, or emotional energy.
2. DO NOT change your speaking rate/speed.
3. Maintain the EXACT SAME personality as the previous segments.
4. NO intro/outro breathing or pauses at the start or end of this segment.
5. NO "citation" or "reading a list" tone. This is a FLUID narration.

## CONTEXT MEMORY (FOR REFERENCE ONLY - DO NOT SPEAK):
"${contextBefore || 'Start of the story.'}"

## CURRENT TEXT SEGMENT TO GENERATE (SPEAK ONLY THIS):
${cleanText}
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        // Menetapkan seed statis jika didukung bisa membantu, 
        // tapi di model TTS Gemini, instruksi prompt adalah kunci utama konsistensi.
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
      if (finishReason === 'SAFETY') {
        throw new Error("Konten diblokir oleh filter keamanan.");
      }
      throw new Error(`Gagal generate audio: ${finishReason || 'Unknown'}`);
    }

    const pcmData = base64ToUint8Array(base64Audio);
    return pcmToWavBlob(pcmData);

  } catch (error: any) {
    console.error("Gemini TTS Consistency Error:", error);
    throw error;
  }
};
