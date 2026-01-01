export enum VoiceName {
  Kore = 'Kore',
  Puck = 'Puck',
  Charon = 'Charon',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr',
}

export type VoiceGender = 'Male' | 'Female';

export interface VoiceInfo {
  name: VoiceName;
  gender: VoiceGender;
  description: string;
}

export interface AnalysisResult {
  recommendedVoice: VoiceName;
  styleInstruction: string; // Kept for display only
  reason: string;
}

export interface TTSItem {
  id: string;
  text: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  audioUrl?: string;
  errorMsg?: string;
  voice: VoiceName;
}

export interface GenerateOptions {
  voice: VoiceName;
}
