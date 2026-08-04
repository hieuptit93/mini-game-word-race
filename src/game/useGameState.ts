/**
 * Word Racer v2 - Game State Management
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { unstable_batchedUpdates } from 'react-native';
import {
  GameState, GameItem, Barrier, LaneWord, LogEntry,
  MAX_LIVES, LANE_X, MINIBOSS_EVERY_MIN, MINIBOSS_EVERY_RAND,
  BASE_SPEED, SPEED_PER_ROUND, SPEED_RAMP_MAX, SPEED_RAMP_SEC,
  INVINCIBLE_MS, MAGNET_MS, BARRIER_TIME_MS, CAR_Y, CAR_H,
  OB_H, WAVE_MIN, WAVE_MAX, BARRIER_SPEED_K,
} from './constants';
import { getTopic, shuffled } from './curriculum';
import { core, patternTokens } from './speechMatch';

export interface GameStats {
  score: number;
  coins: number;
  round: number;
  lives: number;
  streak: number;
  hiscore: number;
  bestCoins: number;
  lane: number;
  carX: number;
  shield: number;
  magnetUntil: number;
  invUntil: number;
  runMs: number;
  roadScroll: number;
  laneSays: number;
  sentHits: number;
  crashes: number;
  maxRound: number;
}

export interface GameActions {
  startGame: () => void;
  setupRound: () => void;
  changeLane: (newLane: number) => void;
  hitObstacle: () => void;
  smashBarrier: () => void;
  tick: (dt: number) => void;
}

export function useGameState(
  onGameOver?: (score: number, coins: number) => void,
  playSound?: (name: string) => void
) {
  // Core state
  const [state, setState] = useState<GameState>('title');
  const [stats, setStats] = useState<GameStats>({
    score: 0, coins: 0, round: 1, lives: MAX_LIVES, streak: 0,
    hiscore: 0, bestCoins: 0, lane: 1, carX: LANE_X[1],
    shield: 0, magnetUntil: 0, invUntil: 0, runMs: 0, roadScroll: 0,
    laneSays: 0, sentHits: 0, crashes: 0, maxRound: 0,
  });

  const [items, setItems] = useState<GameItem[]>([]);
  const [barrier, setBarrier] = useState<Barrier | null>(null);
  const [laneWords, setLaneWords] = useState<LaneWord[]>([]);
  const [message, setMessage] = useState({ text: '', until: 0 });
  const [floats, setFloats] = useState<{ x: number; y: number; txt: string; col: string; life: number }[]>([]);
  const [flashes, setFlashes] = useState<{ x: number; y: number; w: number; h: number; until: number }[]>([]);
  const [killLog, setKillLog] = useState<LogEntry[]>([]);

  // Use refs for callbacks to avoid dependency issues
  const playSoundRef = useRef(playSound);
  playSoundRef.current = playSound;
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  // Refs for timing
  const waveCountRef = useRef(0);
  const nextBarrierAtRef = useRef(6);
  const nextSpawnRef = useRef(0);

  // Mirror latest state/stats/barrier into refs so `tick` can read fresh
  // values without needing them in its dependency array. Without this, tick
  // is recreated every frame (since it updates stats), which cascades into
  // effects that depend on it (game loop, voice recognition) tearing down
  // and restarting dozens of times per second.
  const stateRef = useRef(state);
  stateRef.current = state;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const barrierRef = useRef(barrier);
  barrierRef.current = barrier;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Stable id counter for GameItem.id — see the comment on GameItem in
  // constants.ts for why this matters (React key stability for Image reuse).
  const nextItemIdRef = useRef(0);

  // Helper to play sound via ref
  const sfx = useCallback((name: string) => {
    playSoundRef.current?.(name);
  }, []);

  // Calculate current speed
  const getSpeed = useCallback((runMs: number, round: number) => {
    const base = BASE_SPEED + SPEED_PER_ROUND * (round - 1);
    const mult = 1 + Math.min(SPEED_RAMP_MAX, (runMs / 1000) / SPEED_RAMP_SEC * SPEED_RAMP_MAX);
    return base * mult;
  }, []);

  // Combo multiplier
  const comboMult = useCallback((streak: number) => {
    return Math.min(3, 1 + Math.floor(streak / 4));
  }, []);

  // Show message
  const showMsg = useCallback((text: string, dur: number) => {
    setMessage({ text, until: dur > 0 ? Date.now() + dur : 0 });
  }, []);

  // Add float text
  const floatText = useCallback((x: number, y: number, txt: string, col: string) => {
    setFloats(prev => [...prev, { x, y, txt, col, life: 1 }]);
  }, []);

  // Setup round helper (shared logic)
  const doSetupRound = useCallback((roundNum: number) => {
    const topic = getTopic(roundNum);
    const w3 = shuffled(topic.words.slice(0, 3));
    setLaneWords(w3.map(w => ({ word: w, core: core(w) })));
    setItems([]);
    setBarrier(null);
    waveCountRef.current = 0;
    nextBarrierAtRef.current = MINIBOSS_EVERY_MIN + Math.floor(Math.random() * MINIBOSS_EVERY_RAND);
    nextSpawnRef.current = Date.now() + 800;
    setState('drive');
    showMsg(`CHANG ${roundNum}: ${topic.topic.toUpperCase()}`, 1500);
  }, [showMsg]);

  // Start game
  const startGame = useCallback(() => {
    setStats(prev => ({
      score: 0, coins: 0, round: 1, lives: MAX_LIVES, streak: 0,
      hiscore: prev.hiscore, bestCoins: prev.bestCoins,
      lane: 1, carX: LANE_X[1],
      shield: 0, magnetUntil: 0, invUntil: 0, runMs: 0, roadScroll: 0,
      laneSays: 0, sentHits: 0, crashes: 0, maxRound: 0,
    }));
    setKillLog([]);
    setFloats([]);
    setFlashes([]);
    sfx('start');
    setTimeout(() => doSetupRound(1), 0);
  }, [sfx, doSetupRound]);

  // Setup round (public)
  const setupRound = useCallback(() => {
    setStats(prev => ({ ...prev, maxRound: Math.max(prev.maxRound, prev.round) }));
    doSetupRound(statsRef.current.round);
  }, [doSetupRound]);

  // Change lane
  const changeLane = useCallback((newLane: number) => {
    setStats(prev => {
      if (newLane === prev.lane) return prev;
      return {
        ...prev,
        lane: newLane,
        laneSays: prev.laneSays + 1,
        streak: prev.streak + 1,
      };
    });
    sfx('swoosh');
  }, [sfx]);

  // Hit obstacle
  //
  // NOTE: this reads the "current" stats from statsRef (not from a setState
  // updater callback) on purpose. An earlier version computed the game-over
  // condition inside setStats's updater and leaked it out via a `let`
  // variable read right after — that relies on React invoking the updater
  // SYNCHRONOUSLY, which only happens as an internal bail-out optimization
  // when there's no other update already pending on the fiber. Once this
  // function started being called from inside tick()'s unstable_batchedUpdates
  // block (which already has earlier setState calls pending in the same
  // batch), that synchronous-invocation assumption silently broke — the
  // closure variable never got populated, so "game over" and "-1 life"
  // stopped firing at all. Reading refs directly has no such dependency on
  // React's internal scheduling.
  const hitObstacle = useCallback(() => {
    const cur = statsRef.current;

    if (cur.shield > 0) {
      sfx('shieldpop');
      showMsg('SHIELD!', 700);
      setStats(prev => ({ ...prev, shield: 0, invUntil: Date.now() + INVINCIBLE_MS }));
      return;
    }

    sfx('crash');
    const newLives = cur.lives - 1;

    if (newLives <= 0) {
      const finalScore = cur.score;
      const finalCoins = cur.coins;
      sfx(cur.coins >= cur.bestCoins ? 'record' : 'over');
      setStats(prev => ({
        ...prev,
        lives: 0,
        hiscore: Math.max(prev.hiscore, prev.score),
        bestCoins: Math.max(prev.bestCoins, prev.coins),
      }));
      setState('over');
      onGameOverRef.current?.(finalScore, finalCoins);
      return;
    }

    showMsg('-1 MANG!', 900);
    setFlashes(f => [...f, { x: cur.carX - 22, y: CAR_Y - 6, w: 44, h: 56, until: Date.now() + 160 }]);
    setStats(prev => ({ ...prev, lives: newLives, crashes: prev.crashes + 1, streak: 0, invUntil: Date.now() + INVINCIBLE_MS }));
  }, [sfx, showMsg]);

  // Smash barrier
  //
  // All side effects live OUTSIDE the state updaters. They used to sit inside
  // setBarrier()/setStats() updaters, which is unsafe: React treats updaters
  // as pure and may invoke them more than once for a single logical update
  // (concurrent re-base, StrictMode double-invoke). Every extra invocation
  // duplicated the sfx, the float text, the flash rect AND the
  // setTimeout(doSetupRound) — appending junk to floats/flashes and
  // advancing the round more than once per smash.
  const smashBarrier = useCallback(() => {
    const cur = barrierRef.current;
    if (!cur) return;

    // Guard against a second smash landing before the round actually swaps
    // (the barrier is cleared below, but tick/speech can fire again first).
    barrierRef.current = null;

    const s = statsRef.current;
    const newRound = s.round + 1;

    sfx('smash');
    floatText(240, CAR_Y - 40, '+15 XU', '#ffe08a');
    setFlashes(f => [...f, { x: 96, y: cur.y - 6, w: 288, h: 44, until: Date.now() + 160 }]);
    setBarrier(null);
    setStats(prev => ({
      ...prev,
      score: prev.score + 100 * prev.round * comboMult(prev.streak),
      coins: prev.coins + 15,
      sentHits: prev.sentHits + 1,
      streak: prev.streak + 1,
      round: newRound,
    }));
    setTimeout(() => doSetupRound(newRound), 0);
  }, [sfx, floatText, comboMult, doSetupRound]);

  // Barrier timeout — reads statsRef.current directly, same reasoning as
  // hitObstacle above (don't rely on React's eager-updater-invocation
  // optimization, which silently stops applying once this is called from
  // inside tick()'s unstable_batchedUpdates block).
  const barrierTimeout = useCallback(() => {
    setBarrier(null);
    sfx('crash');

    const cur = statsRef.current;
    const newLives = cur.lives - 1;

    if (newLives <= 0) {
      const finalScore = cur.score;
      const finalCoins = cur.coins;
      sfx(cur.coins >= cur.bestCoins ? 'record' : 'over');
      setStats(prev => ({
        ...prev,
        lives: 0,
        hiscore: Math.max(prev.hiscore, prev.score),
        bestCoins: Math.max(prev.bestCoins, prev.coins),
      }));
      setState('over');
      onGameOverRef.current?.(finalScore, finalCoins);
      return;
    }

    const newRound = cur.round + 1;
    setStats(prev => ({ ...prev, lives: newLives, crashes: prev.crashes + 1, streak: 0, round: newRound }));
    setTimeout(() => doSetupRound(newRound), 0);
  }, [sfx, doSetupRound]);

  // Spawn wave
  const spawnWave = useCallback(() => {
    waveCountRef.current++;

    setStats(prev => {
      if (waveCountRef.current >= nextBarrierAtRef.current) {
        const topic = getTopic(prev.round);
        const unusedWord = shuffled(topic.words.slice(3))[0];
        const sentence = (topic.pattern.replace(/\.{2,}|_{2,}\.?|\.$/g, '').trim() + ' ' + unusedWord).replace(/\s+/g, ' ');

        setBarrier({
          y: -46,
          pat: patternTokens(topic.pattern),
          core: core(unusedWord),
          sentence,
          shownAt: Date.now(),
          deadline: Date.now() + BARRIER_TIME_MS,
          duration: BARRIER_TIME_MS,
          pending: false,
        });
        setState('barrier');
        showMsg('!!! MINI-BOSS !!!', 1100);
        sfx('warn');

        // Clear leftover obstacles from the wave right before the barrier.
        // Without this they keep drifting toward the car and can still hit
        // it (and cost a life) while the barrier is on screen — the player
        // sees the giant "unavoidable" barrier and reasonably assumes
        // nothing can hit them yet, so it reads as a bogus life loss.
        // Coins/power-ups are left alone since collecting them is harmless.
        setItems(items => items.filter(i => i.kind !== 'obs'));

        return prev;
      }

      // Normal wave spawn
      const lanes = [0, 1, 2];
      const pDouble = Math.min(0.4, (prev.runMs / 1000) / 300 * 0.4);
      const nObs = Math.random() < pDouble ? 2 : 1;
      const obsLanes: number[] = [];

      for (let i = 0; i < nObs; i++) {
        const idx = Math.floor(Math.random() * lanes.length);
        obsLanes.push(lanes[idx]);
        lanes.splice(idx, 1);
      }

      const newItems: GameItem[] = [];
      for (const ln of obsLanes) {
        newItems.push({ id: nextItemIdRef.current++, kind: 'obs', lane: ln, y: -OB_H, passed: false, vk: Math.floor(Math.random() * 3) });
      }

      const notCar = lanes.filter(l => l !== prev.lane);
      const coinLane = notCar.length ? notCar[Math.floor(Math.random() * notCar.length)] : lanes[Math.floor(Math.random() * lanes.length)];

      const r = Math.random();
      const bonus = r < 0.05 ? 'shield' : (r < 0.12 ? 'magnet' : null);

      for (let i = 0; i < 3; i++) {
        if (i === 0 && bonus) {
          newItems.push({ id: nextItemIdRef.current++, kind: bonus as 'shield' | 'magnet', lane: coinLane, y: -OB_H - i * 40, passed: false });
        } else {
          newItems.push({ id: nextItemIdRef.current++, kind: 'coin', lane: coinLane, y: -OB_H - i * 40, passed: false });
        }
      }

      setItems(items => [...items, ...newItems]);
      return prev;
    });
  }, [sfx, showMsg]);

  // Game tick — reads current values via refs so this callback's identity
  // stays stable across frames (see refs set up above). A stable `tick`
  // means the game-loop / voice-recognition effects that depend on it don't
  // tear down and restart every frame.
  const tick = useCallback((dt: number) => {
    const curState = stateRef.current;
    if (curState !== 'drive' && curState !== 'barrier') return;

    // Every setState call below (and any triggered inside hitObstacle(),
    // spawnWave(), barrierTimeout()) is wrapped in one batch so this tick
    // produces exactly ONE re-render. Without this, a rAF-driven tick that
    // fires setItems/setStats/setBarrier/setFloats/setFlashes/setMessage as
    // separate calls can trigger a separate render per call on some RN
    // versions/architectures, painting several inconsistent in-between
    // frames per tick — which reads as stutter/flicker, especially visible
    // on the scrolling road dashes and moving items.
    unstable_batchedUpdates(() => {
    const curStats = statsRef.current;
    const curBarrier = barrierRef.current;
    const now = Date.now();

    const sp = getSpeed(curStats.runMs, curStats.round);
    const tx = LANE_X[curStats.lane];
    const newCarX = curStats.carX + (tx - curStats.carX) * Math.min(1, dt / 120);

    // Accumulate all stat deltas from item collisions in one pass, then
    // apply a single setStats call instead of nesting setState calls inside
    // the setItems updater.
    let coinsDelta = 0;
    let scoreDelta = 0;
    let shieldGained = false;
    let magnetUntilNew: number | null = null;
    let obstacleHit = false;

    const magnetOn = now < curStats.magnetUntil;
    const updatedItems: GameItem[] = [];

    for (const o of itemsRef.current) {
      const newY = o.y + sp * dt / 1000;

      // Magnet collects coins
      if (o.kind === 'coin' && magnetOn && newY >= CAR_Y - 30 && newY <= CAR_Y + 60) {
        coinsDelta += 1;
        scoreDelta += 1;
        floatText(LANE_X[o.lane], newY - 8, '+1', '#ffe08a');
        sfx('coin');
        continue;
      }

      const atCar = newY + OB_H > CAR_Y + 4 && newY < CAR_Y + CAR_H - 4;
      const sameLane = o.lane === curStats.lane && Math.abs(LANE_X[o.lane] - curStats.carX) < 48;

      if (atCar && sameLane) {
        if (o.kind === 'obs') {
          if (now < curStats.invUntil) {
            updatedItems.push({ ...o, y: newY });
            continue;
          }
          obstacleHit = true;
          continue;
        }
        if (o.kind === 'coin') {
          coinsDelta += 1;
          scoreDelta += 1;
          floatText(LANE_X[o.lane], newY - 8, '+1', '#ffe08a');
          sfx('coin');
          continue;
        }
        if (o.kind === 'shield') {
          shieldGained = true;
          floatText(LANE_X[o.lane], newY, 'SHIELD', '#7fd0ff');
          sfx('powerup');
          continue;
        }
        if (o.kind === 'magnet') {
          magnetUntilNew = now + MAGNET_MS;
          floatText(LANE_X[o.lane], newY, 'MAGNET', '#e05555');
          sfx('powerup');
          continue;
        }
      }

      // Pass obstacles
      if (!o.passed && newY > CAR_Y + CAR_H && o.kind === 'obs') {
        scoreDelta += 6 * curStats.round * comboMult(curStats.streak);
        sfx('pass');
        updatedItems.push({ ...o, y: newY, passed: true });
        continue;
      }

      if (newY > 360) continue;
      updatedItems.push({ ...o, y: newY });
    }

    setItems(updatedItems);

    setStats(prev => ({
      ...prev,
      runMs: prev.runMs + dt,
      roadScroll: prev.roadScroll + sp * dt / 1000,
      carX: newCarX,
      score: prev.score + sp * dt / 1000 * 0.02 + scoreDelta,
      coins: prev.coins + coinsDelta,
      shield: shieldGained ? 1 : prev.shield,
      magnetUntil: magnetUntilNew ?? prev.magnetUntil,
    }));

    // Obstacle hit is handled after the stats/items batch above so it reads
    // the post-tick state via refs on the next call.
    if (obstacleHit) {
      hitObstacle();
    }

    // Wave spawning (only in drive state)
    if (curState === 'drive' && now >= nextSpawnRef.current) {
      spawnWave();
      nextSpawnRef.current = now + Math.max(WAVE_MIN, WAVE_MAX - (curStats.runMs / 1000) * 4);
    }

    // Update barrier
    if (curState === 'barrier' && curBarrier) {
      if (now >= curBarrier.deadline) {
        // Clear the ref SYNCHRONOUSLY, before calling barrierTimeout().
        // barrierRef only refreshes when React commits a render, so without
        // this the next few rAF frames still see the same expired barrier and
        // call barrierTimeout() again — each repeat costing another life and
        // scheduling another doSetupRound(), which stacks up rounds and
        // duplicate state churn.
        barrierRef.current = null;
        setBarrier(null);
        barrierTimeout();
      } else {
        setBarrier(prev => (prev ? { ...prev, y: prev.y + sp * BARRIER_SPEED_K * dt / 1000 } : null));
      }
    }

    // Update floats
    setFloats(prev => prev
      .map(f => ({ ...f, life: f.life - dt / 900, y: f.y - 18 * dt / 1000 }))
      .filter(f => f.life > 0)
    );

    // Update flashes
    setFlashes(prev => prev.filter(f => now < f.until));

    // Update message
    setMessage(prev => (prev.until && now >= prev.until) ? { text: '', until: 0 } : prev);
    });
  }, [getSpeed, comboMult, spawnWave, hitObstacle, barrierTimeout, floatText, sfx]);

  // Stable actions object — the identity only changes when one of the
  // underlying callbacks changes (which, per the fix above, is now rare).
  const actions = useMemo<GameActions>(() => ({
    startGame,
    setupRound,
    changeLane,
    hitObstacle,
    smashBarrier,
    tick,
  }), [startGame, setupRound, changeLane, hitObstacle, smashBarrier, tick]);

  return {
    state,
    stats,
    items,
    barrier,
    laneWords,
    message,
    floats,
    flashes,
    killLog,
    getSpeed,
    comboMult,
    actions,
  };
}
