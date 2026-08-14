/**
 * Type definitions for Pika mini-game host bridge.
 * These types define the contract between mini-game and host app.
 */

/** Game metadata injected by host app */
export interface GameMeta {
  /** Stable id used for score submission / analytics (e.g. "36", "word_racer") */
  id: string;
  /** Display name (e.g. "Word Racer") */
  name: string;
  /** Short description */
  description?: string;
  /** Thumbnail/icon URL */
  icon?: string;
  /** Module Federation scope */
  scope: string;
  /** Bundle version */
  version: string;
}

export interface LetterScore {
  letter: string;
  score: number;
}

export interface PronunciationResult {
  totalScore: number;
  words: { word: string; score: number; letters: LetterScore[] }[];
}

/** Speech-to-text result with confidence score */
export interface SpeechToTextResult {
  text: string;
  confidence: number;
  isFinal: boolean;
}

/** Callback for continuous speech recognition results */
export type SpeechResultCallback = (result: SpeechToTextResult) => void;

/**
 * Host bridge interface - provided by the main app.
 * In dev mode, this is mocked by MockHost.
 */
export interface HostBridge {
  /** Game metadata injected by host app */
  gameInfo?: GameMeta;

  /** Auth info from host app */
  auth: {
    /** Get current access token (empty if not logged in) */
    getAccessToken: () => string;
    /** Get current user ID (null if not logged in) */
    getUserId: () => string | null;
  };

  /** Environment config from host app (API URLs, etc.) */
  config: {
    /** Get API base URL */
    getApiUrl: () => string;
    /** Get WebSocket base URL */
    getWsUrl: () => string;
    /** Get current environment (development/staging/production) */
    getEnv: () => string;
    /** Get any config value by key */
    get: (key: string) => string | undefined;
  };

  /** Pronunciation scoring (record -> upload -> score) */
  pronunciation: {
    startRecording: () => Promise<void>;
    stopAndCheck: (target: string) => Promise<PronunciationResult>;
    cancel: () => Promise<void>;
  };

  /**
   * Low-latency sound effects for games. Backed by the host's audio stack so
   * mini-games don't need to bundle any audio library.
   */
  sfx: {
    /** Play a short sound effect from a URL. Fire-and-forget. */
    play: (source: string, volume?: number) => void;
    /** Preload + decode a sound so its first play has no fetch delay. */
    preload: (source: string) => Promise<void>;
    /** Start looping background music (replaces any current track). */
    playMusic: (source: string, volume?: number) => void;
    /** Stop and release the background music. */
    stopMusic: () => void;
    /** Set background-music volume (0 = muted, 1 = full). */
    setMusicVolume: (volume: number) => void;
  };

  /** Real-time continuous speech-to-text */
  continuousSpeech: {
    /** Start listening. Results delivered via callback. */
    start: (onResult: SpeechResultCallback) => Promise<void>;
    /** Stop listening. */
    stop: () => Promise<void>;
    /** Check if currently listening. */
    isListening: () => boolean;
  };

  /** Firebase Analytics tracking (fanned out to Datadog RUM by the host too) */
  analytics: {
    /** Log a custom event with optional parameters */
    logEvent: (name: string, params?: Record<string, any>) => void;
    /** Log a screen view event */
    logScreenView: (screenName: string, screenClass?: string) => void;
    /** Set a user property */
    setUserProperty: (name: string, value: string) => void;
  };
}

/**
 * Props passed to the mini-game App component.
 */
export interface GameProps {
  /** Called when user wants to exit the game */
  onExit?: () => void;
  /** Called when game ends with a result */
  onGameOver?: (result: { score: number }) => void;
  /** Host bridge for native capabilities (undefined in standalone dev mode uses mock) */
  host?: HostBridge;
}

/**
 * Navigation screens in your mini-game.
 * Add more screens as your game grows.
 */
export type Screen = 'home' | 'game' | 'result';

/**
 * Game phase states.
 */
export type Phase = 'idle' | 'playing' | 'checking' | 'result' | 'error';

// ============================================================================
// SCORE & LEADERBOARD TYPES
// ============================================================================

export interface GameScoreDTO {
  game_id: number;
  best_score: number;
  last_score: number;
}

export interface RankingEntry {
  name: string;
  score: number;
  is_user: boolean;
}

export interface UserInfo {
  name: string;
  score: number;
  max_score: number;
}

export interface GameSummaryDTO {
  ranking: RankingEntry[];
  user_info: UserInfo;
}

export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}
