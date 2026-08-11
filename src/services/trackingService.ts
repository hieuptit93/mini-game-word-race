/**
 * Word Racer - Analytics Tracking Service
 * Based on tracking_events_common.md and tracking_events_racer.md
 */

import { HostBridge } from '../types';

// Constants
const SCREEN_NAME = '/voice_games/racer';
const GAME_NAME = 'word_racer';

// Types
export type Tier = 'T1' | 'T3';
export type GameStatus = 'win' | 'fail' | 'lose' | 'quit';
export type TargetResult = 'hit' | 'escaped';

interface TrackingContext {
  host?: HostBridge;
  roundIndex: number;
  topicName: string;
  roundStartTime: number;
}

let context: TrackingContext = {
  host: undefined,
  roundIndex: 0,
  topicName: '',
  roundStartTime: 0,
};

// Attempt tracking per target
const attemptCounters: Map<string, number> = new Map();
const targetShownTimes: Map<string, number> = new Map();

/**
 * Initialize tracking context
 */
export function initTracking(host?: HostBridge) {
  context.host = host;
  attemptCounters.clear();
  targetShownTimes.clear();
}

/**
 * Helper to log event
 */
function logEvent(name: string, params: Record<string, any>) {
  if (context.host?.analytics?.logEvent) {
    context.host.analytics.logEvent(name, {
      screen_name: SCREEN_NAME,
      ...params,
    });
  } else {
    console.log('[Tracking]', name, params);
  }
}

// ============================================================================
// S1 - In Game Events
// ============================================================================

/**
 * screen_view: When a new round starts
 */
export function trackRoundStart(params: {
  roundIndex: number;
  topicName: string;
  numItem?: number;
}) {
  context.roundIndex = params.roundIndex;
  context.topicName = params.topicName;
  context.roundStartTime = Date.now();
  attemptCounters.clear();
  targetShownTimes.clear();

  logEvent('screen_view', {
    game_name: GAME_NAME,
    topic_name: params.topicName,
    round_index: params.roundIndex,
    num_item: params.numItem ?? 3,
  });
}

/**
 * gesture (target_shown): When a voice target appears
 * For lanes: call once per lane at round start
 * For barrier: call when barrier appears
 */
export function trackTargetShown(params: {
  wordId: string;
  indexItem: number;
  word: string;
  tier: Tier;
  isReview?: boolean;
}) {
  const key = `${params.wordId}_${params.indexItem}`;
  attemptCounters.set(key, 0);
  targetShownTimes.set(key, Date.now());

  logEvent('gesture', {
    gesture: 'view',
    widget_type: 'voice_target',
    widget_name: 'target_shown',
    word_id: params.wordId,
    index_item: params.indexItem,
    word: params.word,
    tier: params.tier,
    is_review: params.isReview ?? false,
    topic_name: context.topicName,
  });
}

/**
 * gesture (speak): When user speaks (every attempt, matched or not)
 */
export function trackSpeak(params: {
  wordId: string;
  indexItem: number;
  sentence: string;
  isMatched: boolean;
  tier: Tier;
}) {
  const key = `${params.wordId}_${params.indexItem}`;
  const attemptIndex = (attemptCounters.get(key) ?? 0) + 1;
  attemptCounters.set(key, attemptIndex);

  const shownTime = targetShownTimes.get(key) ?? Date.now();
  const rtMs = Date.now() - shownTime;

  logEvent('gesture', {
    gesture: 'speak',
    widget_type: 'voice_target',
    word_id: params.wordId,
    index_item: params.indexItem,
    sentence: params.sentence,
    is_matched: params.isMatched,
    attempt_index: attemptIndex,
    rt_ms: rtMs,
    tier: params.tier,
  });
}

/**
 * gesture (target_result): When a target is completed (hit or escaped)
 */
export function trackTargetResult(params: {
  wordId: string;
  indexItem: number;
  result: TargetResult;
  tier: Tier;
}) {
  const key = `${params.wordId}_${params.indexItem}`;
  const attemptIndex = attemptCounters.get(key) ?? 1;
  const shownTime = targetShownTimes.get(key) ?? Date.now();
  const rtMs = Date.now() - shownTime;

  logEvent('gesture', {
    gesture: 'view',
    widget_type: 'voice_target',
    widget_name: 'target_result',
    word_id: params.wordId,
    index_item: params.indexItem,
    result: params.result,
    attempt_index: attemptIndex,
    rt_ms: rtMs,
    tier: params.tier,
  });
}

/**
 * gesture (exit_game): When user taps exit button mid-game
 */
export function trackExitGame() {
  logEvent('gesture', {
    gesture: 'tap',
    widget_type: 'button',
    widget_name: 'exit_game',
    round_index: context.roundIndex,
  });
}

/**
 * screen_time: When a round ends (by any means)
 */
export function trackRoundEnd(params: {
  gameStatus: GameStatus;
}) {
  const durationSec = Math.round((Date.now() - context.roundStartTime) / 1000);
  const isProceeded = params.gameStatus === 'win' || params.gameStatus === 'fail';

  logEvent('screen_time', {
    duration_sec: durationSec,
    game_name: GAME_NAME,
    round_index: context.roundIndex,
    is_proceeded: isProceeded,
    game_status: params.gameStatus,
  });
}

// ============================================================================
// S2 - Game Over Events
// ============================================================================

/**
 * screen_view: Game over screen loaded
 */
export function trackGameOverView(roundIndex: number) {
  if (context.host?.analytics?.logEvent) {
    context.host.analytics.logEvent('screen_view', {
      screen_name: '/voice_games/game_over',
      game_name: GAME_NAME,
      round_index: roundIndex,
    });
  }
}

/**
 * gesture (replay): User taps replay
 */
export function trackReplay() {
  if (context.host?.analytics?.logEvent) {
    context.host.analytics.logEvent('gesture', {
      screen_name: '/voice_games/game_over',
      gesture: 'tap',
      widget_type: 'button',
      widget_name: 'replay',
      game_name: GAME_NAME,
    });
  }
}

/**
 * gesture (back_to_home): User taps back
 */
export function trackBackToHome() {
  if (context.host?.analytics?.logEvent) {
    context.host.analytics.logEvent('gesture', {
      screen_name: '/voice_games/game_over',
      gesture: 'tap',
      widget_type: 'button',
      widget_name: 'back_to_home',
    });
  }
}

// ============================================================================
// Lane change tracking (T1 targets)
// ============================================================================

/**
 * Track lane change - user said a lane word correctly
 */
export function trackLaneHit(params: {
  wordId: string;
  laneIndex: number;
  word: string;
  transcript: string;
}) {
  // Track speak event
  trackSpeak({
    wordId: params.wordId,
    indexItem: params.laneIndex + 1, // 1-indexed
    sentence: params.transcript,
    isMatched: true,
    tier: 'T1',
  });

  // Track result
  trackTargetResult({
    wordId: params.wordId,
    indexItem: params.laneIndex + 1,
    result: 'hit',
    tier: 'T1',
  });
}

// ============================================================================
// Barrier tracking (T3 targets)
// ============================================================================

/**
 * Track barrier shown
 */
export function trackBarrierShown(params: {
  wordId: string;
  sentence: string;
}) {
  trackTargetShown({
    wordId: params.wordId,
    indexItem: 0, // Barrier has no lane index
    word: params.sentence,
    tier: 'T3',
  });
}

/**
 * Track barrier speak attempt
 */
export function trackBarrierSpeak(params: {
  wordId: string;
  transcript: string;
  isMatched: boolean;
}) {
  trackSpeak({
    wordId: params.wordId,
    indexItem: 0,
    sentence: params.transcript,
    isMatched: params.isMatched,
    tier: 'T3',
  });
}

/**
 * Track barrier result
 */
export function trackBarrierResult(params: {
  wordId: string;
  result: TargetResult;
}) {
  trackTargetResult({
    wordId: params.wordId,
    indexItem: 0,
    result: params.result,
    tier: 'T3',
  });
}
