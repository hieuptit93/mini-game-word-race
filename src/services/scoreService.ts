/**
 * Score & Leaderboard Service
 * API integration for saving scores and fetching leaderboard
 */

import { HostBridge, GameScoreDTO, GameSummaryDTO, ApiResponse } from '../types';

const GAME_ID = 39; // Word Racer game ID - thay bằng game_id thực tế

/**
 * Save player score to server
 * Backend auto-updates best_score if new score is higher
 */
export async function saveScore(
  host: HostBridge | undefined,
  score: number,
): Promise<GameScoreDTO | null> {
  if (!host?.config?.getApiUrl || !host?.auth?.getAccessToken) {
    console.warn('[ScoreService] No host bridge, cannot save score');
    return null;
  }

  const token = host.auth.getAccessToken();
  if (!token) {
    console.warn('[ScoreService] No auth token');
    return null;
  }

  const apiUrl = host.config.getApiUrl();
  const url = `${apiUrl}/robot-user/api/v1/app-game/score`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ game_id: GAME_ID, score: Math.round(score) }),
    });

    const json: ApiResponse<GameScoreDTO> = await response.json();
    if (json.status === 200) {
      console.log('[ScoreService] Score saved:', json.data);
      return json.data;
    }
    console.warn('[ScoreService] Save failed:', json.message);
    return null;
  } catch (error) {
    console.error('[ScoreService] Error saving score:', error);
    return null;
  }
}

/**
 * Get current user's score (best_score and last_score)
 */
export async function getScore(
  host: HostBridge | undefined,
): Promise<GameScoreDTO | null> {
  if (!host?.config?.getApiUrl || !host?.auth?.getAccessToken) {
    return null;
  }

  const token = host.auth.getAccessToken();
  if (!token) return null;

  const apiUrl = host.config.getApiUrl();
  const url = `${apiUrl}/robot-user/api/v1/app-game/score?game_id=${GAME_ID}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    const json: ApiResponse<GameScoreDTO | null> = await response.json();
    return json.status === 200 ? json.data : null;
  } catch (error) {
    console.error('[ScoreService] Error getting score:', error);
    return null;
  }
}

/**
 * Get leaderboard summary (TOP 10 + current user info)
 */
export async function getSummary(
  host: HostBridge | undefined,
): Promise<GameSummaryDTO | null> {
  if (!host?.config?.getApiUrl || !host?.auth?.getAccessToken) {
    return null;
  }

  const token = host.auth.getAccessToken();
  if (!token) return null;

  const apiUrl = host.config.getApiUrl();
  const url = `${apiUrl}/robot-user/api/v1/app-game/summary?game_id=${GAME_ID}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    const json: ApiResponse<GameSummaryDTO> = await response.json();
    return json.status === 200 ? json.data : null;
  } catch (error) {
    console.error('[ScoreService] Error getting summary:', error);
    return null;
  }
}
