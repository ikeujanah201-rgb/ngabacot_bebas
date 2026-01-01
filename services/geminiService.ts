
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
  const style = styleInstruction || "professional and soulful narrative";

  // SLIDING WINDOW CONTEXT: 
  // Kita ambil lebih banyak teks SEBELUMNYA dan sangat sedikit teks SESUDAHNYA
  // agar model tahu emosi sebelumnya tapi tidak membaca teks masa depan.
  let contextWindow = "";
  if (fullContext && fullContext.length > text.length) {
    const index = fullContext.indexOf(text);
    if (index !== -1) {
      const start = Math.max(0, index - 800); // Lihat jauh ke belakang
      const end = Math.min(fullContext.length, index + text.length + 50); // Lihat sedikit saja ke depan
      contextWindow = fullContext.substring(start, end);
    }
  }

  // Prompt dengan pembatas super ketat (Walled Prompting)
  const prompt = `
### SYSTEM INSTRUCTION ###
You are a professional voice actor. I will provide you with a "REFERENCE CONTEXT" to understand the emotional flow.
Then I will provide the "TARGET TEXT" that you MUST speak.

CRITICAL RULES:
1. ONLY SPEAK the text inside the [TARGET_TEXT] block.
2. ABSOLUTELY DO NOT SPEAK anything inside the [REFERENCE_CONTEXT] block.
3. Maintain a ${style} tone.
4. No intro, no outro, no filler.

[REFERENCE_CONTEXT_DO_NOT_SPEAK]
${contextWindow || 'No context available.'}
[/REFERENCE_CONTEXT_DO_NOT_SPEAK]

[TARGET_TEXT]
${text}
[/TARGET_TEXT]

### FINAL REMINDER: ONLY SPEAK THE WORDS INSIDE [TARGET_TEXT] ###
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
        throw new Error("Konten diblokir oleh filter keamanan Gemini.");
      }
      throw new Error(`Gagal generate audio. Reason: ${finishReason || 'Unknown'}`);
    }

    const pcmData = base64ToUint8Array(base64Audio);
    return pcmToWavBlob(pcmData);

  } catch (error: any) {
    console.error("Gemini TTS Error:", error);
    if (error.message?.includes("fetch")) {
      throw new Error("Masalah koneksi internet atau API diblokir.");
    }
    throw error;
  }
};
