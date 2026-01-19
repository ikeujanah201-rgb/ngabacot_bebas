import { GoogleGenAI, Modality } from "@google/genai";
import { TTS_MODEL } from "../constants";
import { VoiceName } from "../types";
import { base64ToUint8Array, pcmToWavBlob } from "../utils/audioHelper";

const getClient = () => {
  // Mengambil string API Key dari environment variable (bisa berisi banyak kunci dipisah koma)
  const keysString = process.env.API_KEY;
  
  if (!keysString) {
    throw new Error("API_KEY tidak ditemukan di environment variables.");
  }

  // LOGIKA MULTI-KEY: Pecah string dan bersihkan
  const keys = keysString.split(',').map(key => key.trim()).filter(key => key.length > 0);

  if (keys.length === 0) {
    throw new Error("Format API_KEY tidak valid.");
  }

  // ROTASI ACAK: Pilih satu kunci secara random
  const randomKey = keys[Math.floor(Math.random() * keys.length)];

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

  // Mempersiapkan memori konteks agar suara tetap konsisten
  let contextBefore = "";
  if (fullContext) {
    const index = fullContext.indexOf(text);
    if (index > 0) {
      contextBefore = fullContext.substring(Math.max(0, index - 1500), index);
    }
  }

  // Prompt Konsistensi Total (Sesuai permintaan user)
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
      if (finishReason === 'SAFETY') throw new Error("Diblokir oleh filter keamanan.");
      throw new Error(`Gagal: ${finishReason || 'Unknown'}`);
    }

    const pcmData = base64ToUint8Array(base64Audio);
    return pcmToWavBlob(pcmData);

  } catch (error: any) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
};