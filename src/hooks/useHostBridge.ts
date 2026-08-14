/**
 * Utilities to access host bridge capabilities.
 * Provides easy access to auth, config, sfx, pronunciation, etc.
 */

import { useCallback, useMemo } from 'react';
import { HostBridge, GameProps, GameMeta } from '../types';

// ============================================================================
// MOCK VALUES (for standalone development)
// ============================================================================

const MOCK_CONFIG = {
  accessToken: '__DEV_TOKEN__',
  userId: 'dev-user-123',
  apiUrl: 'https://api.example.com',
  wsUrl: 'wss://ws.example.com',
  env: 'development',
};

// ============================================================================
// HELPER FUNCTIONS (use these in components)
// ============================================================================

/**
 * Get access token from host bridge
 */
export function getAccessToken(host?: HostBridge): string {
  if (host?.auth?.getAccessToken) {
    return host.auth.getAccessToken();
  }
  console.warn('[HostBridge] No host, using mock token');
  return MOCK_CONFIG.accessToken;
}

/**
 * Get user ID from host bridge
 */
export function getUserId(host?: HostBridge): string | null {
  if (host?.auth?.getUserId) {
    return host.auth.getUserId();
  }
  return MOCK_CONFIG.userId;
}

/**
 * Get API base URL from host bridge
 */
export function getApiUrl(host?: HostBridge): string {
  if (host?.config?.getApiUrl) {
    return host.config.getApiUrl();
  }
  console.warn('[HostBridge] No host, using mock API URL');
  return MOCK_CONFIG.apiUrl;
}

/**
 * Get WebSocket URL from host bridge
 */
export function getWsUrl(host?: HostBridge): string {
  if (host?.config?.getWsUrl) {
    return host.config.getWsUrl();
  }
  return MOCK_CONFIG.wsUrl;
}

/**
 * Get environment (development/staging/production)
 */
export function getEnv(host?: HostBridge): string {
  if (host?.config?.getEnv) {
    return host.config.getEnv();
  }
  return MOCK_CONFIG.env;
}

/**
 * Get any config value by key
 */
export function getConfig(host?: HostBridge, key?: string): string | undefined {
  if (host?.config?.get && key) {
    return host.config.get(key);
  }
  return undefined;
}

// ============================================================================
// HOOK (provides all utilities in one place)
// ============================================================================

/**
 * Hook that provides easy access to all host bridge capabilities.
 *
 * @example
 * ```tsx
 * const App: React.FC<GameProps> = ({ host, onExit }) => {
 *   const {
 *     accessToken,
 *     userId,
 *     apiUrl,
 *     sfx,
 *     pronunciation,
 *     fetchWithAuth,
 *   } = useHostBridge(host);
 *
 *   // Play sound
 *   sfx.play('https://cdn.example.com/ding.mp3');
 *
 *   // Fetch with auth header
 *   const data = await fetchWithAuth('/games/leaderboard');
 * };
 * ```
 */
export function useHostBridge(host?: HostBridge) {
  // Game Info
  const gameInfo: GameMeta | undefined = host?.gameInfo;

  // Auth
  const accessToken = useMemo(() => getAccessToken(host), [host]);
  const userId = useMemo(() => getUserId(host), [host]);

  // Config
  const apiUrl = useMemo(() => getApiUrl(host), [host]);
  const wsUrl = useMemo(() => getWsUrl(host), [host]);
  const env = useMemo(() => getEnv(host), [host]);
  const isDev = env === 'development';
  const isProd = env === 'production';

  // SFX (with fallback no-op)
  const sfx = useMemo(
    () => ({
      play: (source: string, volume?: number) => {
        if (host?.sfx?.play) {
          host.sfx.play(source, volume);
        } else {
          console.log('[MockSFX] play:', source, volume);
        }
      },
      preload: async (source: string) => {
        if (host?.sfx?.preload) {
          await host.sfx.preload(source);
        } else {
          console.log('[MockSFX] preload:', source);
        }
      },
      playMusic: (source: string, volume?: number) => {
        if (host?.sfx?.playMusic) {
          host.sfx.playMusic(source, volume);
        } else {
          console.log('[MockSFX] playMusic:', source, volume);
        }
      },
      stopMusic: () => {
        if (host?.sfx?.stopMusic) {
          host.sfx.stopMusic();
        } else {
          console.log('[MockSFX] stopMusic');
        }
      },
      setMusicVolume: (volume: number) => {
        if (host?.sfx?.setMusicVolume) {
          host.sfx.setMusicVolume(volume);
        } else {
          console.log('[MockSFX] setMusicVolume:', volume);
        }
      },
    }),
    [host],
  );

  // Pronunciation
  const pronunciation = useMemo(
    () => ({
      startRecording: async () => {
        if (host?.pronunciation?.startRecording) {
          await host.pronunciation.startRecording();
        } else {
          console.log('[MockPronunciation] startRecording');
        }
      },
      stopAndCheck: async (target: string) => {
        if (host?.pronunciation?.stopAndCheck) {
          return host.pronunciation.stopAndCheck(target);
        }
        console.log('[MockPronunciation] stopAndCheck:', target);
        return { totalScore: 85, words: [{ word: target, score: 85, letters: [] }] };
      },
      cancel: async () => {
        if (host?.pronunciation?.cancel) {
          await host.pronunciation.cancel();
        } else {
          console.log('[MockPronunciation] cancel');
        }
      },
    }),
    [host],
  );

  // Continuous Speech
  const continuousSpeech = useMemo(
    () => ({
      start: async (onResult: (result: { text: string; confidence: number; isFinal: boolean }) => void) => {
        if (host?.continuousSpeech?.start) {
          await host.continuousSpeech.start(onResult);
        } else {
          console.log('[MockSpeech] start');
        }
      },
      stop: async () => {
        if (host?.continuousSpeech?.stop) {
          await host.continuousSpeech.stop();
        } else {
          console.log('[MockSpeech] stop');
        }
      },
      isListening: () => {
        if (host?.continuousSpeech?.isListening) {
          return host.continuousSpeech.isListening();
        }
        return false;
      },
    }),
    [host],
  );

  // Analytics
  const analytics = useMemo(
    () => ({
      logEvent: (name: string, params?: Record<string, any>) => {
        if (host?.analytics?.logEvent) {
          host.analytics.logEvent(name, params);
        } else {
          console.log('[MockAnalytics] logEvent:', name, params);
        }
      },
      logScreenView: (screenName: string, screenClass?: string) => {
        if (host?.analytics?.logScreenView) {
          host.analytics.logScreenView(screenName, screenClass);
        } else {
          console.log('[MockAnalytics] logScreenView:', screenName, screenClass);
        }
      },
      setUserProperty: (name: string, value: string) => {
        if (host?.analytics?.setUserProperty) {
          host.analytics.setUserProperty(name, value);
        } else {
          console.log('[MockAnalytics] setUserProperty:', name, value);
        }
      },
    }),
    [host],
  );

  // Fetch with auth header
  const fetchWithAuth = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const url = path.startsWith('http') ? path : `${apiUrl}${path}`;
      const headers = {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    [apiUrl, accessToken],
  );

  return {
    // Game Info
    gameInfo,

    // Auth
    accessToken,
    userId,
    hasAuth: !!accessToken,

    // Config
    apiUrl,
    wsUrl,
    env,
    isDev,
    isProd,
    getConfig: (key: string) => getConfig(host, key),

    // Capabilities
    sfx,
    pronunciation,
    continuousSpeech,
    analytics,

    // Utilities
    fetchWithAuth,
  };
}

export default useHostBridge;
