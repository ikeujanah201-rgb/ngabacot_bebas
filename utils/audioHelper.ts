import { SAMPLE_RATE } from '../constants';
import JSZip from 'jszip';
import { TTSItem } from '../types';

// Decodes a base64 string into a raw Uint8Array
export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Wraps raw PCM data with a WAV header to make it playable/downloadable
export const pcmToWavBlob = (pcmData: Uint8Array, sampleRate: number = SAMPLE_RATE): Blob => {
  // Gemini returns 16-bit PCM, so 2 bytes per sample.
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * 2; 
  const blockAlign = numChannels * 2;
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write the actual PCM data
  const pcmBytes = new Uint8Array(buffer, 44);
  pcmBytes.set(pcmData);

  return new Blob([buffer], { type: 'audio/wav' });
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

/**
 * Compresses multiple audio items into a single ZIP file.
 * Files are named sequentially (01_, 02_) to maintain order.
 */
export const createZipFromItems = async (items: TTSItem[]): Promise<Blob> => {
  const zip = new JSZip();
  const completedItems = items.filter(i => i.status === 'completed' && i.audioUrl);

  if (completedItems.length === 0) {
    throw new Error("No completed audio files to zip.");
  }

  const filePromises = completedItems.map(async (item, index) => {
    // Fetch the blob data from the object URL
    const response = await fetch(item.audioUrl!);
    const blob = await response.blob();

    // Formatting filename: 01_Voice_TextSnippet.wav
    // 1. Sequence Number (01, 02, etc.) - reversed index logic or direct index? 
    // Usually user wants 01 to be the top of the list. 
    // Assuming 'items' array order is the display order.
    
    // Note: In App.tsx, new items are prepended (added to top). 
    // So the 'first' item generated is actually at the end of the array if we strictly follow chronology, 
    // but visually the user sees top-down. 
    // Let's follow the visual array order passed to this function.
    
    const sequence = (items.length - index).toString().padStart(2, '0'); // If list is reversed visually
    // OR if the user expects 01 to be the most recent generation (Top of list):
    const visualSequence = (index + 1).toString().padStart(2, '0');

    const safeText = item.text.substring(0, 20).replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').toLowerCase();
    const fileName = `${visualSequence}_${item.voice}_${safeText}.wav`;

    zip.file(fileName, blob);
  });

  await Promise.all(filePromises);
  return await zip.generateAsync({ type: 'blob' });
};