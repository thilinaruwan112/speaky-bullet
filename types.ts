export enum Sender {
  User = 'user',
  AI = 'ai',
}

export enum CorrectionType {
  Grammar = 'grammar',
  Pronunciation = 'pronunciation',
}

export interface Correction {
  original: string;
  corrected: string;
  explanation: string;
  type: CorrectionType;
}

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  correction?: Correction;
  correctionAudio?: string | null;
}

export enum ConnectionState {
  Idle = 'Idle',
  Connecting = 'Connecting',
  Connected = 'Connected',
  Error = 'Error',
}

export enum AIVoice {
  Kore = 'Kore',
  Puck = 'Puck',
  Charon = 'Charon',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr',
}

export enum PracticeMode {
  FreeTalk = 'Free Talk',
  Practice = 'Practice',
  PronunciationPractice = 'Pronunciation Practice',
}
