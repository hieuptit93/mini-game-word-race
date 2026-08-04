/**
 * Mock Host Bridge for standalone development.
 *
 * This simulates the host app's native capabilities so you can
 * develop and test your mini-game without the main app.
 */

import { HostBridge, PronunciationResult, SpeechResultCallback } from '../src/types';

// Simulate recording state
let isRecording = false;
let recordingStartTime = 0;

// Simulate continuous speech state
let isSpeechListening = false;
let speechCallback: SpeechResultCallback | null = null;
let speechInterval: ReturnType<typeof setInterval> | null = null;

// Running counter so each analytics call is easy to spot/count in logs
let analyticsEventCount = 0;

// Configure mock behavior (edit these for testing)
const MOCK_CONFIG = {
  // Mock access token for API calls (replace with real token for testing)
  accessToken: '__DEV_TOKEN__',
  // Mock user ID
  userId: 'dev-user-123',
  // Mock API URL
  apiUrl: 'https://api.example.com',
  // Mock WebSocket URL
  wsUrl: 'wss://ws.example.com',
  // Mock environment
  env: 'development',
  // Set to a number (0-100) to always return this score, or null for random
  fixedScore: null as number | null,
  // Minimum recording time in ms (like real API)
  minRecordingMs: 700,
  // Simulate network delay range [min, max] ms
  networkDelay: [800, 1300] as [number, number],
  // Chance to throw error (0-1), set > 0 to test error handling
  errorChance: 0,
};

// Track background music state
let currentMusic: { source: string; volume: number } | null = null;

/**
 * Generate a random score for testing different UI states.
 */
const randomScore = (min = 40, max = 100): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Generate letter-by-letter scores for a word.
 */
const generateLetterScores = (word: string) =>
  [...word].map((letter) => ({
    letter,
    score: randomScore(50, 100),
  }));

/**
 * Simulate async delay (like network/native calls).
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mock implementation of the host bridge.
 * Edit these to test different scenarios.
 */
export const mockHost: HostBridge = {
  auth: {
    getAccessToken: () => {
      console.log('[MockHost] getAccessToken called');
      return MOCK_CONFIG.accessToken;
    },
    getUserId: () => {
      console.log('[MockHost] getUserId called');
      return MOCK_CONFIG.userId;
    },
  },

  config: {
    getApiUrl: () => {
      console.log('[MockHost] getApiUrl called');
      return MOCK_CONFIG.apiUrl;
    },
    getWsUrl: () => {
      console.log('[MockHost] getWsUrl called');
      return MOCK_CONFIG.wsUrl;
    },
    getEnv: () => {
      console.log('[MockHost] getEnv called');
      return MOCK_CONFIG.env;
    },
    get: (key: string) => {
      console.log(`[MockHost] config.get("${key}") called`);
      return (MOCK_CONFIG as Record<string, unknown>)[key] as string | undefined;
    },
  },

  sfx: {
    play: (source: string, volume = 1) => {
      console.log(`[MockHost] 🔊 Playing SFX: ${source} (volume: ${volume})`);
    },
    preload: async (source: string) => {
      console.log(`[MockHost] 📦 Preloading: ${source}`);
      await delay(100); // Simulate load time
    },
    playMusic: (source: string, volume = 1) => {
      console.log(`[MockHost] 🎵 Playing music: ${source} (volume: ${volume})`);
      currentMusic = { source, volume };
    },
    stopMusic: () => {
      console.log('[MockHost] 🎵 Music stopped');
      currentMusic = null;
    },
    setMusicVolume: (volume: number) => {
      console.log(`[MockHost] 🎵 Music volume: ${volume}`);
      if (currentMusic) {
        currentMusic.volume = volume;
      }
    },
  },

  pronunciation: {
    startRecording: async () => {
      if (isRecording) {
        console.warn('[MockHost] Already recording');
        return;
      }
      console.log('[MockHost] 🎤 Recording started...');
      isRecording = true;
      recordingStartTime = Date.now();
      // Simulate recording initialization delay
      await delay(100);
    },

    stopAndCheck: async (targetText: string): Promise<PronunciationResult> => {
      if (!isRecording) {
        console.warn('[MockHost] Not recording');
        throw new Error('Not recording');
      }

      const elapsed = Date.now() - recordingStartTime;
      console.log(`[MockHost] 🛑 Recording stopped (${elapsed}ms). Checking: "${targetText}"`);
      isRecording = false;

      // Check minimum recording time (like real API)
      if (elapsed < MOCK_CONFIG.minRecordingMs) {
        throw new Error('Giữ nút lâu hơn (1–2 giây) rồi nói to, rõ nhé.');
      }

      // Simulate random errors for testing
      if (MOCK_CONFIG.errorChance > 0 && Math.random() < MOCK_CONFIG.errorChance) {
        throw new Error('Chưa nghe rõ, thử lại nhé');
      }

      // Simulate network delay
      const [minDelay, maxDelay] = MOCK_CONFIG.networkDelay;
      await delay(minDelay + Math.random() * (maxDelay - minDelay));

      // Split into words (real API does this)
      const wordList = targetText.trim().split(/\s+/);

      // Generate scores for each word
      const words = wordList.map((word) => {
        const letters = generateLetterScores(word);
        // Use fixed score if configured, otherwise use average of letters
        const wordScore = MOCK_CONFIG.fixedScore ?? Math.round(
          letters.reduce((sum, l) => sum + l.score, 0) / letters.length
        );
        return { word, score: wordScore, letters };
      });

      // Total score is average of all words
      const totalScore = MOCK_CONFIG.fixedScore ?? Math.round(
        words.reduce((sum, w) => sum + w.score, 0) / words.length
      );

      console.log(`[MockHost] ✅ Score: ${totalScore} (${words.length} word${words.length > 1 ? 's' : ''})`);

      return { totalScore, words };
    },

    cancel: async () => {
      console.log('[MockHost] ❌ Recording cancelled');
      isRecording = false;
    },
  },

  analytics: {
    logEvent: (name: string, params?: Record<string, unknown>) => {
      analyticsEventCount++;
      console.log(`[MockHost] 📊 #${analyticsEventCount} logEvent("${name}")`, params ?? {});
    },
    logScreenView: (screenName: string, screenClass?: string) => {
      analyticsEventCount++;
      console.log(`[MockHost] 📊 #${analyticsEventCount} logScreenView("${screenName}")`, { screenClass: screenClass ?? screenName });
    },
    setUserProperty: (name: string, value: string) => {
      analyticsEventCount++;
      console.log(`[MockHost] 📊 #${analyticsEventCount} setUserProperty("${name}" = "${value}")`);
    },
  },

  continuousSpeech: {
    start: async (onResult: SpeechResultCallback) => {
      if (isSpeechListening) {
        console.warn('[MockHost] Already listening');
        return;
      }
      console.log('[MockHost] 🎤 Continuous speech started...');
      isSpeechListening = true;
      speechCallback = onResult;

      // Simulate partial results every 500ms
      // Word Racer curriculum words for better testing
      const mockWords = [
        'sunny', 'rainy', 'windy', 'cloudy',
        'a ruler', 'an eraser', 'a book', 'a pencil',
        'a hat', 'a jacket', 'a dress',
        'a banana', 'an apple', 'an orange',
        'football', 'basketball', 'swimming',
        'it is sunny', 'this is a ruler', 'i have a hat',
      ];
      let accumulated = '';
      let wordIndex = 0;

      speechInterval = setInterval(() => {
        if (!isSpeechListening || !speechCallback) {
          return;
        }

        // Add next word
        accumulated += (accumulated ? ' ' : '') + mockWords[wordIndex % mockWords.length];
        wordIndex++;

        // Send partial result
        speechCallback({
          text: accumulated,
          confidence: 0.5 + Math.random() * 0.3,
          isFinal: false,
        });

        // Every 3 words, send final result and reset
        if (wordIndex % 3 === 0) {
          speechCallback({
            text: accumulated,
            confidence: 0.9 + Math.random() * 0.1,
            isFinal: true,
          });
          accumulated = '';
        }
      }, 500);

      await delay(100);
    },

    stop: async () => {
      console.log('[MockHost] 🛑 Continuous speech stopped');
      if (speechInterval) {
        clearInterval(speechInterval);
        speechInterval = null;
      }
      isSpeechListening = false;
      speechCallback = null;
    },

    isListening: () => isSpeechListening,
  },

};

/**
 * Mock host that always fails - useful for testing error states.
 */
export const mockHostWithErrors: HostBridge = {
  auth: mockHost.auth,
  config: mockHost.config,
  sfx: mockHost.sfx,
  pronunciation: {
    startRecording: async () => {
      throw new Error('Microphone permission denied');
    },
    stopAndCheck: async () => {
      throw new Error('Speech recognition failed');
    },
    cancel: async () => {},
  },
  continuousSpeech: {
    start: async () => {
      throw new Error('Microphone permission denied');
    },
    stop: async () => {},
    isListening: () => false,
  },
  analytics: mockHost.analytics,
};

/**
 * Mock host with slow responses - useful for testing loading states.
 */
export const mockHostSlow: HostBridge = {
  auth: mockHost.auth,
  config: mockHost.config,
  sfx: mockHost.sfx,
  pronunciation: {
    startRecording: async () => {
      await delay(2000);
      console.log('[MockHost Slow] Recording started after delay');
    },
    stopAndCheck: async (word) => {
      await delay(3000);
      return mockHost.pronunciation.stopAndCheck(word);
    },
    cancel: async () => {},
  },
  continuousSpeech: mockHost.continuousSpeech,
  analytics: mockHost.analytics,
};

export default mockHost;
