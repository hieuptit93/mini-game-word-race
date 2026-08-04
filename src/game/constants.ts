/**
 * Word Racer v2 - Game Constants
 * Ported from word_racer.html
 */

// Canvas dimensions (480x320 pixel art)
export const W = 480;
export const H = 320;

// Road geometry
export const ROAD_L = 96;
export const ROAD_R = 384;
export const LANE_X = [144, 240, 336] as const;
export const LANE_W = (ROAD_R - ROAD_L) / 3; // 96

// Car dimensions and position
export const CAR_W = 32;
export const CAR_H = 44;
export const CAR_Y = 246;

// Obstacle dimensions
export const OB_W = 34;
export const OB_H = 30;

// Speed tuning for A1 learners (slow start, gentle ramp)
// Toned down ~18% from the original word_racer.html values (58/4/0.5) —
// felt too fast to react to on a phone screen with voice control.
export const BASE_SPEED = 48;          // px/s initial
export const SPEED_PER_ROUND = 3;      // px/s per round
export const SPEED_RAMP_MAX = 0.4;     // max +40% over time
export const SPEED_RAMP_SEC = 450;     // seconds to reach max ramp

// Barrier (mini-boss)
export const BARRIER_SPEED_K = 0.5;    // barrier scrolls at half speed
export const BARRIER_TIME_MS = 6500;   // time to speak sentence

// Wave spawning
export const WAVE_MIN = 1100;          // minimum ms between waves
export const WAVE_MAX = 2100;          // maximum ms between waves

// Mini-boss timing
export const MINIBOSS_EVERY_MIN = 9;   // minimum waves before boss
export const MINIBOSS_EVERY_RAND = 3;  // random addition (0-2)

// Gameplay rules
export const MAX_LIVES = 3;
export const INVINCIBLE_MS = 1200;     // invincibility after hit
export const MAGNET_MS = 5000;         // magnet duration
export const MATCH_LOCK_MS = 420;      // prevent double-match

// Leaderboard mock data
export const ALL_TIME: [string, number][] = [
  ['MINH AN', 4210],
  ['BAO NGOC', 3650],
  ['GIA HAN', 2980],
  ['TUAN KIET', 2410],
  ['KHANH VY', 1875],
];

// Storage keys
export const BEST_KEY = 'pika_wordracer_best';
export const COIN_KEY = 'pika_wordracer_bestcoins';
export const LEARNER_KEY = 'pika_learner_word_racer';

// Colors from assets.json palette
export const COLORS = {
  car: '#00e000',
  carGlass: '#aff7ff',
  obs1: '#ff8c1a',
  obs2: '#ff2a2a',
  obs3: '#ffe600',
  coin: '#ffd24a',
  coinCore: '#e0a800',
  coinShine: '#fff3c0',
  coinFloat: '#ffe08a',
  shield: '#7fd0ff',
  shieldHi: '#eaf7ff',
  magnet: '#e05555',
  steel: '#c8ccd0',
  barrierRed: '#ff3355',
  roadShoulder: '#20262c',
  road: '#31383f',
  roadEdge: '#e8e8e8',
  roadDash: '#aab4bd',
  signIdle: '#14181c',
  signActive: '#2a2a00',
  signBorder: '#5b6b7e',
  life: '#ff5b7a',
  lifeOff: '#3a1420',
  hudRound: '#00fc00',
  timerOk: '#3dff7a',
  timerWarn: '#ffd60a',
  timerCrit: '#ff4040',
  crash: '#ff5544',
  star: '#ffca28',
  bg: '#000000',
  panel: '#101418',
  flash: '#ffffff',
  ledDrive: '#7cc7ef',
  ledBoss: '#c07bff',
  ledNearMiss: '#ffb020',
} as const;

// Game states
export type GameState = 'title' | 'drive' | 'barrier' | 'over';

// Item types
export type ItemKind = 'obs' | 'coin' | 'shield' | 'magnet';

// Item interface
export interface GameItem {
  // Stable identity for React's reconciliation key. Items get removed from
  // the MIDDLE of the array (collected/passed/off-screen), which shifts
  // array indices — using index as key lets a later item's Image "inherit"
  // an earlier item's rendered view, swapping its `source` in place (e.g. a
  // coin's slot reused by an obstacle). That forces a fresh network fetch
  // for the new source, which is nearly free on localhost but visibly
  // janky over a real CDN. `id` must stay assigned to the same logical item
  // for its whole lifetime.
  id: number;
  kind: ItemKind;
  lane: number;
  y: number;
  passed: boolean;
  vk?: number; // obstacle variant (0-2)
}

// Barrier (mini-boss) interface
export interface Barrier {
  y: number;
  pat: string;       // pattern tokens
  core: string;      // core word to match
  sentence: string;  // full sentence to speak
  shownAt: number;   // timestamp when shown
  deadline: number;  // timestamp when expires
  duration: number;  // total duration
  pending: boolean;  // true when being destroyed
}

// Lane word interface
export interface LaneWord {
  word: string;
  core: string;
}

// Log entry for tracking
export interface LogEntry {
  n: number;
  round: number;
  target: string;
  type: 'từ' | 'câu';
  rt: number;
  result: 'hit' | 'crash' | 'shield';
  heard: string;
}
