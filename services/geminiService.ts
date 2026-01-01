
import { GoogleGenAI, Modality } from "@google/genai";
import { TTS_MODEL } from "../constants";
import { VoiceName } from "../types";
import { base64ToUint8Array, pcmToWavBlob } from "../utils/audioHelper";

const getClient = () => {
  // 1. GANTI INI: Kita cari variabel 'GEMINI_API_KEYS' (Pake S, Jamak)
  const keysString = process.env.GEMINI_API_KEYS;

  // Cek apakah kuncinya ada
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
 * Generates speech with a smart context window to ensure flow without breaking API limits.
 */
export const generateSpeech = async (
  text: string, 
  voice: VoiceName,
  styleInstruction?: string,
  fullContext?: string 
): Promise<Blob> => {
  const ai = getClient();
  const style = styleInstruction || "professional and natural narrative";

  // Membersihkan teks dari tanda kutip yang mungkin tidak sengaja terbawa
  const cleanText = text.replace(/^["']|["']$/g, '').trim();

  // Sliding window context untuk emosi yang menyambung
  let contextBefore = "";
  if (fullContext) {
    const index = fullContext.indexOf(text);
    if (index > 0) {
      contextBefore = fullContext.substring(Math.max(0, index - 1000), index);
    }
  }

  // Prompt yang lebih cair agar tidak terdengar seperti "membaca kutipan"
  const prompt = `
INSTRUCTION:
You are a professional voice actor. Speak the following segment naturally.
This text is PART OF A CONTINUOUS NARRATION. 
Maintain a ${style} tone.

CRITICAL RULES for SEAMLESS FLOW:
- DO NOT add leading or trailing silence.
- DO NOT use "quotation" intonation (no air quotes or citation style).
- Ensure the prosody flows as if this is the middle of a sentence or paragraph.
- ONLY speak the words provided in the segment below.

PREVIOUS CONTEXT (FOR EMOTIONAL FLOW ONLY - DO NOT SPEAK THIS):
${contextBefore || 'Beginning of narration.'}

CURRENT SEGMENT TO SPEAK:
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
      if (finishReason === 'SAFETY') {
        throw new Error("Konten diblokir oleh filter keamanan.");
      }
      throw new Error(`Gagal generate audio: ${finishReason || 'Unknown'}`);
    }

    const pcmData = base64ToUint8Array(base64Audio);
    return pcmToWavBlob(pcmData);

  } catch (error: any) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
};
