type SpeechResultsEvent = {
  value?: string[];
};

type SpeechErrorEvent = {
  error?: {
    message?: string;
  };
};

type VoiceModule = {
  onSpeechResults?: (event: SpeechResultsEvent) => void;
  onSpeechError?: (event: SpeechErrorEvent) => void;
  onSpeechEnd?: () => void;
  start: (_locale: string) => Promise<void>;
  stop: () => Promise<void>;
  destroy: () => Promise<void>;
};

export const VOICE_NOT_AVAILABLE_MESSAGE =
  'Voice search is not available in this build. Please install native voice support.';

const unsupportedError = new Error(VOICE_NOT_AVAILABLE_MESSAGE);

const fallbackVoice: VoiceModule = {
  onSpeechResults: undefined,
  onSpeechError: undefined,
  onSpeechEnd: undefined,
  async start() {
    throw unsupportedError;
  },
  async stop() {
    return;
  },
  async destroy() {
    return;
  },
};

let voiceModule: VoiceModule = fallbackVoice;
export let isVoiceSearchAvailable = false;

try {
  // Optional native dependency: app should still run when not linked.
  const nativeVoice = require('@react-native-voice/voice')?.default as
    | VoiceModule
    | undefined;
  if (nativeVoice?.start) {
    voiceModule = nativeVoice;
    isVoiceSearchAvailable = true;
  }
} catch {
  isVoiceSearchAvailable = false;
}

export default voiceModule;
