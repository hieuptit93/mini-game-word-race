/**
 * Word Racer v2 - Speech Recognition Matching
 * Voice input normalization and matching logic
 */

import { LaneWord, Barrier } from './constants';

/**
 * Normalize transcript for matching
 */
export function norm(s: string): string {
  let result = ' ' + s.toLowerCase()
    .replace(/it's/g, 'it is')
    .replace(/that's/g, 'that is')
    .replace(/what's/g, 'what is')
    .replace(/let's/g, 'lets')
    .replace(/i'm/g, 'i am')
    .replace(/[^a-z' ]/g, ' ')
    .replace(/'/g, ' ')
    .replace(/\s+/g, ' ') + ' ';
  return result;
}

/**
 * Extract core word (remove articles)
 */
export function core(word: string): string {
  return norm(word).trim().replace(/^(a|an|the) /, '');
}

/**
 * Extract pattern tokens from sentence pattern
 */
export function patternTokens(p: string): string {
  return norm(p.replace(/\.{2,}/g, ' ').replace(/_{2,}/g, ' ')).trim();
}

/**
 * Check if transcript matches a lane word (returns lane index or -1)
 */
export function laneMatch(tr: string, laneWords: LaneWord[], currentLane: number): number {
  const t = norm(tr);
  for (let i = 0; i < laneWords.length; i++) {
    if (i !== currentLane && t.includes(' ' + laneWords[i].core + ' ')) {
      return i;
    }
  }
  return -1;
}

/**
 * Check if transcript matches barrier sentence
 */
export function barrierMatch(tr: string, barrier: Barrier | null): boolean {
  if (!barrier || barrier.pending) return false;
  const t = norm(tr);
  const pi = t.indexOf(' ' + barrier.pat + ' ');
  if (pi < 0) return false;
  return t.indexOf(' ' + barrier.core + ' ', pi) >= 0;
}

/**
 * Calculate Levenshtein edit distance
 */
export function editDist(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;

  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return d[m][n];
}

/**
 * Detect near-miss (edit distance <= 2)
 */
export function detectNearMiss(
  tr: string,
  laneWords: LaneWord[],
  currentLane: number,
  barrier: Barrier | null
): string {
  const t = norm(tr).trim();
  if (t.length < 2) return '';

  const words = t.split(' ');
  const targets = laneWords
    .filter((_, i) => i !== currentLane)
    .map(w => w.core);

  if (barrier && !barrier.pending) {
    targets.push(barrier.core);
  }

  let best = 99;
  let bestTarget = '';

  for (const w of words) {
    for (const tg of targets) {
      const d = editDist(w, tg);
      if (d < best) {
        best = d;
        bestTarget = tg;
      }
    }
  }

  return (best > 0 && best <= 2 && bestTarget) ? bestTarget : '';
}
