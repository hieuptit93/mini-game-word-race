/**
 * Word Racer v2 - Main Game Component
 * Integrates game state, rendering, sound, and voice recognition
 */

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions, Image } from 'react-native';
import GameCanvas from './GameCanvas';
import { useGameState } from './useGameState';
import { W, H, ALL_TIME, COLORS, MATCH_LOCK_MS } from './constants';
import { laneMatch, barrierMatch, detectNearMiss } from './speechMatch';
import sounds, { SoundName } from '../assets/sounds';
import * as SPRITES from '../assets/images';
import { HostBridge, GameSummaryDTO, RankingEntry } from '../types';
import { saveScore, getSummary } from '../services/scoreService';
import * as Tracking from '../services/trackingService';

// The complete set of images GameCanvas can mount at runtime — now just the
// pre-composed rig sprites (scripts/compose-sprites.py) plus the 3 obstacle
// variants and the title star. Everything else that used to be here is drawn
// as a solid-colour <View> instead; see the strategy note in GameCanvas.tsx.
const GAMEPLAY_SPRITES = [
  SPRITES.car, SPRITES.carShielded,
  SPRITES.coin,
  SPRITES.shieldItem, SPRITES.magnetItem,
  SPRITES.barrier,
  SPRITES.signActive, SPRITES.signIdle,
  SPRITES.obsCone, SPRITES.obsBlock, SPRITES.obsHazard,
  SPRITES.starShape,
];

function resolveImageUri(asset: unknown): string | null {
  if (typeof asset === 'string') return asset;
  if (asset && typeof asset === 'object' && 'uri' in asset) {
    return (asset as { uri: string }).uri;
  }
  return null;
}

// require()'d assets go through Re.Pack's remote asset loader (see
// rspack.config.mjs: getAssetTransformRules({ remote: {...} })), which
// resolves each one to { uri, width, height, scale } pointing at wherever
// this game bundle's own MF_PUBLIC_PATH is (CDN in prod, localhost:9000 in
// dev) — NOT a hardcoded localhost URL. Extracting .uri here is what makes
// sound playback work identically in both environments.
function resolveSoundUri(asset: unknown): string | null {
  if (typeof asset === 'string') return asset;
  if (asset && typeof asset === 'object' && 'uri' in asset) {
    return (asset as { uri: string }).uri;
  }
  return null;
}

interface WordRacerGameProps {
  host?: HostBridge;
  onExit?: () => void;
  onGameOver?: (score: number, coins: number) => void;
}

const WordRacerGame: React.FC<WordRacerGameProps> = ({
  host,
  onExit,
  onGameOver,
}) => {
  // Refs for game loop
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const matchLockUntilRef = useRef(0);
  const lastPlayRef = useRef<Record<string, number>>({});

  // Leaderboard state
  const [serverLeaderboard, setServerLeaderboard] = useState<GameSummaryDTO | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Tracks how much of the continuous-speech transcript has already been
  // "consumed" by a match. Native continuous STT sessions return the FULL
  // accumulated hypothesis text, not just newly spoken words — without this,
  // a word said long ago (e.g. an earlier lane change) stays in the string
  // forever and can match again later, jumping the car to a stale lane even
  // though the player just said something else.
  const consumedLenRef = useRef(0);

  // Refs for voice - use refs to avoid dependency issues
  const shouldListenRef = useRef(false);
  const speechBusyRef = useRef(false); // guards against overlapping native start() calls
  const speechCallbackRef = useRef<((result: { text: string; confidence: number; isFinal: boolean }) => void) | null>(null);

  // State
  const [scale, setScale] = useState(1);
  const [rotated, setRotated] = useState(false);
  const [lastHeard, setLastHeard] = useState('');
  const [blink, setBlink] = useState(true);

  // Play sound effect with debounce
  const playSound = useCallback((name: string) => {
    const uri = resolveSoundUri(sounds[name as SoundName]);
    if (!uri) return;

    const now = Date.now();
    if (lastPlayRef.current[name] && now - lastPlayRef.current[name] < 70) return;
    lastPlayRef.current[name] = now;

    host?.sfx?.play(uri);
  }, [host?.sfx]);

  // Wrap onGameOver to save score, fetch leaderboard, and fire analytics
  const handleGameOver = useCallback(async (score: number, coins: number) => {
    host?.analytics?.logEvent('game_over', { final_score: Math.round(score), coins });

    // Save score and fetch leaderboard in parallel
    setLeaderboardLoading(true);
    try {
      await saveScore(host, Math.round(score));
      const summary = await getSummary(host);
      setServerLeaderboard(summary);
    } catch (error) {
      console.error('[WordRacer] Leaderboard error:', error);
    } finally {
      setLeaderboardLoading(false);
    }

    onGameOver?.(score, coins);
  }, [host, onGameOver]);

  // Game state hook
  const {
    state,
    stats,
    items,
    barrier,
    laneWords,
    message,
    floats,
    flashes,
    getSpeed,
    comboMult,
    actions,
  } = useGameState(handleGameOver, playSound);

  // ---- TEMP PERF DIAGNOSTIC ----------------------------------------------
  // Reported "each replay is laggier than the last". Everything in
  // startGame()/doSetupRound() does get reset, so rather than guessing at
  // which pool leaks, count them. Logs once per run at game over:
  //   run       — how many times this session has been played
  //   items/floats/flashes — live object counts (should NOT trend upward
  //                          run over run; if they do, that pool leaks)
  //   renders   — total GameCanvas renders for the run (~60/s × duration;
  //               a big jump at equal duration means extra re-renders)
  // Remove this block once the cause is confirmed.
  const runCountRef = useRef(0);
  const renderCountRef = useRef(0);
  renderCountRef.current++;
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    const playing = state === 'drive' || state === 'barrier';
    if (playing && !wasPlayingRef.current) {
      runCountRef.current++;
      renderCountRef.current = 0;
    }
    if (!playing && wasPlayingRef.current && state === 'over') {
      console.log(
        `[WordRacer/perf] run=${runCountRef.current} ` +
          `items=${items.length} floats=${floats.length} flashes=${flashes.length} ` +
          `renders=${renderCountRef.current} round=${stats.round}`,
      );
    }
    wasPlayingRef.current = playing;
  }, [state, items.length, floats.length, flashes.length, stats.round]);
  // ------------------------------------------------------------------------

  // Initialize tracking service
  useEffect(() => {
    Tracking.initTracking(host);
  }, [host]);

  // Track round start when game enters 'drive' state
  const prevStateRef = useRef(state);
  const topicRef = useRef('');
  useEffect(() => {
    // When transitioning to drive state (new round started)
    if (state === 'drive' && prevStateRef.current !== 'drive' && prevStateRef.current !== 'barrier') {
      // Get topic from first lane word
      const topic = laneWords[0]?.word?.split(' ')[0] || 'unknown';
      topicRef.current = topic;

      Tracking.trackRoundStart({
        roundIndex: stats.round,
        topicName: topic,
        numItem: 3,
      });

      // Track lane words shown (T1 targets)
      laneWords.forEach((lw, i) => {
        Tracking.trackTargetShown({
          wordId: `${topic}.${lw.core}`,
          indexItem: i + 1,
          word: lw.word,
          tier: 'T1',
        });
      });
    }

    // Track round end when state changes from playing to over/title
    if ((prevStateRef.current === 'drive' || prevStateRef.current === 'barrier') &&
        (state === 'over' || state === 'title')) {
      const gameStatus = state === 'over' ?
        (stats.lives <= 0 ? 'lose' : 'fail') : 'quit';
      Tracking.trackRoundEnd({ gameStatus });
    }

    prevStateRef.current = state;
  }, [state, stats.round, stats.lives, laneWords]);

  // Track barrier shown when it appears
  const prevBarrierRef = useRef<typeof barrier>(null);
  useEffect(() => {
    if (barrier && !prevBarrierRef.current) {
      Tracking.trackBarrierShown({
        wordId: `${topicRef.current}.${barrier.core}`,
        sentence: barrier.sentence,
      });
    }
    prevBarrierRef.current = barrier;
  }, [barrier]);

  // 'level_completed' — fires whenever the round counter advances (i.e. a
  // mini-boss barrier was successfully smashed). Skips the initial mount.
  // Score is read via a ref (updated every render) rather than being a
  // dependency, since stats.score changes every frame and would otherwise
  // re-run this effect 60x/sec for no reason.
  const scoreRef = useRef(stats.score);
  scoreRef.current = stats.score;
  const prevRoundRef = useRef(stats.round);
  useEffect(() => {
    if (stats.round > prevRoundRef.current) {
      // Track previous round completion as 'win'
      Tracking.trackRoundEnd({ gameStatus: 'win' });

      host?.analytics?.logEvent('level_completed', {
        level: prevRoundRef.current,
        score: Math.round(scoreRef.current),
      });
    }
    prevRoundRef.current = stats.round;
  }, [stats.round, host?.analytics]);

  // Speech result handler - stored in ref to avoid recreating
  useEffect(() => {
    speechCallbackRef.current = (result: { text: string; confidence: number; isFinal: boolean }) => {
      const transcript = result.text;
      const heard = transcript.toLowerCase().trim();
      setLastHeard(heard);

      const now = Date.now();
      if (now < matchLockUntilRef.current) return;

      // If the transcript got shorter than what we've already consumed, the
      // native session must have reset (new recognition segment) — start
      // scanning from the beginning again.
      if (transcript.length < consumedLenRef.current) {
        consumedLenRef.current = 0;
      }

      // Only match against the NEW portion of the transcript — text already
      // consumed by an earlier match must not be able to match again.
      const newPortion = transcript.slice(consumedLenRef.current);

      // Check barrier match first
      if (state === 'barrier' && barrier && barrierMatch(newPortion, barrier)) {
        // Track barrier speak (matched)
        Tracking.trackBarrierSpeak({
          wordId: `${topicRef.current}.${barrier.core}`,
          transcript: newPortion,
          isMatched: true,
        });
        // Track barrier result (hit)
        Tracking.trackBarrierResult({
          wordId: `${topicRef.current}.${barrier.core}`,
          result: 'hit',
        });

        matchLockUntilRef.current = now + MATCH_LOCK_MS;
        consumedLenRef.current = transcript.length;
        setLastHeard('');
        actions.smashBarrier();
        return;
      }

      // Check lane match
      if (state === 'drive' || state === 'barrier') {
        const matchedLane = laneMatch(newPortion, laneWords, stats.lane);
        if (matchedLane >= 0) {
          const matchedWord = laneWords[matchedLane];
          // Track lane hit
          Tracking.trackLaneHit({
            wordId: `${topicRef.current}.${matchedWord.core}`,
            laneIndex: matchedLane,
            word: matchedWord.word,
            transcript: newPortion,
          });

          matchLockUntilRef.current = now + MATCH_LOCK_MS;
          consumedLenRef.current = transcript.length;
          setLastHeard('');
          actions.changeLane(matchedLane);
          return;
        }
      }

      // Check near miss on final result
      if (result.isFinal && (state === 'drive' || state === 'barrier')) {
        const nearMiss = detectNearMiss(newPortion, laneWords, stats.lane, barrier);
        if (nearMiss) {
          playSound('miss');
          setLastHeard(`ALMOST! ${nearMiss}`);
        }
      }
    };
  }, [state, barrier, laneWords, stats.lane, actions, playSound]);

  // Build leaderboard - use server data if available, otherwise fallback to mock
  const leaderboard = useMemo(() => {
    if (serverLeaderboard?.ranking) {
      // Use server leaderboard
      return serverLeaderboard.ranking.slice(0, 5).map(entry => ({
        name: entry.name,
        score: entry.score,
        you: entry.is_user,
      }));
    }
    // Fallback to mock leaderboard
    const all = ALL_TIME.map(([name, score]) => ({ name, score, you: false }));
    all.push({ name: 'BAN (YOU)', score: Math.round(stats.hiscore), you: true });
    all.sort((a, b) => b.score - a.score);
    return all.slice(0, 5);
  }, [serverLeaderboard, stats.hiscore]);

  const lbRank = useMemo(() => {
    if (serverLeaderboard?.user_info) {
      // Find user rank from server data
      const idx = serverLeaderboard.ranking.findIndex(r => r.is_user);
      return idx >= 0 ? idx + 1 : serverLeaderboard.ranking.length + 1;
    }
    const idx = leaderboard.findIndex(r => r.you);
    return idx >= 0 ? idx + 1 : leaderboard.length + 1;
  }, [serverLeaderboard, leaderboard]);

  // Screen fitting — runs on mount and on any dimension change.
  //
  // The play area is 480x320 (3:2 landscape). The host app is locked to
  // PORTRAIT natively (UISupportedInterfaceOrientations = Portrait,
  // android:screenOrientation="portrait"), and this game ships as a JS-only
  // Module Federation remote, so it cannot change that. Fitting a 3:2 canvas
  // into a portrait screen is width-bound and wastes most of the height.
  //
  // So when the screen is taller than it is wide, present the canvas rotated
  // 90°: the 480 axis then runs down the long side of the screen and the game
  // gets substantially bigger (on a 393x852pt screen the scale goes 0.82 ->
  // 1.23, i.e. ~2.2x the area). Turn the phone sideways to play. If the host
  // ever allows real landscape, `rotated` becomes false and it lays out
  // normally with no code change.
  useEffect(() => {
    const updateScale = () => {
      const { width, height } = Dimensions.get('window');
      const isPortrait = height > width;
      // Rotated: the stage's on-screen footprint is H wide by W tall.
      const fit = isPortrait
        ? Math.min(width / H, height / W)
        : Math.min(width / W, height / H);
      setRotated(isPortrait);
      setScale(fit);
    };

    updateScale();
    const subscription = Dimensions.addEventListener('change', updateScale);
    return () => subscription.remove();
  }, []);

  // Game loop. Runs ONCE for the component's lifetime — `state` and
  // `actions.tick` are read via refs each frame instead of being effect
  // dependencies, so the RAF chain is never torn down and rebuilt mid-game.
  const gameStateRef = useRef(state);
  gameStateRef.current = state;
  const tickRef = useRef(actions.tick);
  tickRef.current = actions.tick;

  useEffect(() => {
    const gameLoop = (time: number) => {
      const dt = lastTimeRef.current ? Math.min(time - lastTimeRef.current, 100) : 16;
      lastTimeRef.current = time;

      const s = gameStateRef.current;
      if (s === 'drive' || s === 'barrier') {
        tickRef.current(dt);
      }

      rafRef.current = requestAnimationFrame(gameLoop);
    };

    rafRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Blink toggle for "PRESS THE STAR BUTTON" / "PRESS * TO PLAY AGAIN" text.
  // word_racer.html re-evaluates this every requestAnimationFrame (its
  // render() runs unconditionally every frame). Here, the game loop above
  // only calls tick() — which only setState's — while state is 'drive' or
  // 'barrier', so on the title/over screens nothing ever re-renders
  // GameCanvas and a Date.now()-based blink calculated at render time would
  // freeze at whatever value it had on the first render. Drive it from an
  // explicit interval instead, only while it's actually needed.
  useEffect(() => {
    if (state !== 'title' && state !== 'over') return;
    const id = setInterval(() => setBlink(b => !b), 500);
    return () => clearInterval(id);
  }, [state]);

  // Voice recognition management.
  // IMPORTANT: keyed off `isPlaying` (drive OR barrier), not raw `state` —
  // the game flips between 'drive' and 'barrier' every mini-boss round.
  // Keying off `state` directly would stop+start the native speech
  // recognizer on every such flip; @react-native-voice/voice (and similar
  // native speech modules) can crash the app natively when start()/stop()
  // calls overlap. `speechBusyRef` additionally guards against the poll
  // and the initial call ever issuing two concurrent start() calls.
  const isPlaying = state === 'drive' || state === 'barrier';

  useEffect(() => {
    if (!host?.continuousSpeech) return;

    if (!isPlaying) {
      shouldListenRef.current = false;
      host.continuousSpeech.stop().catch(() => {});
      return;
    }

    shouldListenRef.current = true;

    const startSpeech = async () => {
      if (!shouldListenRef.current || speechBusyRef.current) return;
      if (host.continuousSpeech.isListening()) return;

      speechBusyRef.current = true;
      try {
        await host.continuousSpeech.start((result) => {
          speechCallbackRef.current?.(result);
        });
      } catch (err) {
        // "No speech detected" and similar timeouts land here — normal,
        // the poll below will restart listening.
      } finally {
        speechBusyRef.current = false;
      }
    };

    startSpeech();

    // Poll occasionally to restart if the native recognizer stopped itself
    // (e.g. after a "no speech detected" timeout). Guarded by
    // speechBusyRef so this never overlaps with an in-flight start().
    const pollInterval = setInterval(() => {
      if (shouldListenRef.current && !speechBusyRef.current && !host.continuousSpeech.isListening()) {
        startSpeech();
      }
    }, 3000);

    return () => {
      shouldListenRef.current = false;
      clearInterval(pollInterval);
      host.continuousSpeech.stop().catch(() => {});
    };
  }, [isPlaying, host?.continuousSpeech]);

  // Preload sounds on mount
  useEffect(() => {
    if (!host?.sfx?.preload) return;
    Object.values(sounds).forEach(asset => {
      const uri = resolveSoundUri(asset);
      if (uri) host.sfx.preload(uri);
    });
  }, [host?.sfx]);

  // Prefetch every gameplay sprite on mount so they're already in RN's
  // native image cache (memory/disk) before the player presses ★. Without
  // this, the FIRST time each sprite is used mid-gameplay it has to go
  // through the full network fetch + decode pipeline right as it's needed
  // (e.g. the first obstacle of a new variant, the first mini-boss barrier)
  // — exactly the kind of one-off hitch that reads as "jank", and is far
  // more noticeable over a real CDN than over localhost. The title screen
  // (shown before the player can even start) gives this a natural window
  // to finish before it matters.
  useEffect(() => {
    GAMEPLAY_SPRITES.forEach(asset => {
      const uri = resolveImageUri(asset);
      if (uri) Image.prefetch(uri).catch(() => {});
    });
  }, []);

  // Track game over screen view
  useEffect(() => {
    if (state === 'over') {
      Tracking.trackGameOverView(stats.round);
    }
  }, [state, stats.round]);

  // Start button handler
  const handleStart = useCallback(() => {
    if (state === 'title' || state === 'over') {
      // Track replay if coming from game over
      if (state === 'over') {
        Tracking.trackReplay();
      }

      host?.analytics?.logEvent('game_started', { level: 1 });
      setLastHeard('');
      consumedLenRef.current = 0;
      matchLockUntilRef.current = 0;
      setServerLeaderboard(null);
      actions.startGame();
    }
  }, [state, actions, host?.analytics]);

  // Exit button handler with tracking
  const handleExit = useCallback(() => {
    // Track exit based on current state
    if (state === 'drive' || state === 'barrier') {
      Tracking.trackExitGame();
      Tracking.trackRoundEnd({ gameStatus: 'quit' });
    } else if (state === 'over') {
      Tracking.trackBackToHome();
    }
    onExit?.();
  }, [state, onExit]);

  return (
    <View style={styles.container}>
      {/* The whole stage — canvas AND its controls — is one rotated+scaled box,
          so the buttons stay anchored to the play area rather than the physical
          screen (a control positioned in screen space would end up on the wrong
          edge once the canvas is rotated). */}
      <View
        style={[
          styles.stage,
          { transform: rotated ? [{ rotate: '90deg' }, { scale }] : [{ scale }] },
        ]}>
        <GameCanvas
          state={state}
          stats={stats}
          items={items}
          barrier={barrier}
          laneWords={laneWords}
          message={message}
          floats={floats}
          flashes={flashes}
          comboMult={comboMult}
          leaderboard={leaderboard}
          lbRank={lbRank}
          serverBestScore={serverLeaderboard?.user_info?.max_score}
          blink={blink}
        />

        {/* Control overlay, in the canvas's own 480x320 coordinate space */}
        <View style={styles.controlOverlay} pointerEvents="box-none">
          {/* Voice transcript - only show in dev mode for debugging */}
          {__DEV__ && (state === 'drive' || state === 'barrier') && lastHeard && (
            <View style={styles.heardContainer}>
              <Text style={styles.heardText} numberOfLines={2}>🎤 {lastHeard}</Text>
            </View>
          )}

          {/* Start button */}
          {(state === 'title' || state === 'over') && (
            <TouchableOpacity style={styles.starButton} onPress={handleStart} activeOpacity={0.8}>
              <Text style={styles.starButtonText}>★</Text>
            </TouchableOpacity>
          )}

          {/* Exit button */}
          {onExit && (
            <TouchableOpacity style={styles.exitButton} onPress={handleExit}>
              <Text style={styles.exitButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The rotated/scaled play area. Everything inside it uses the canvas's own
  // 480x320 coordinates.
  stage: {
    width: W,
    height: H,
  },
  controlOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  // Controls sit on the black margins OUTSIDE the road (the road spans
  // x=82..388 of 480), vertically centred — so they never cover the HUD, the
  // lane signs, the mini-boss banner or the leaderboard, in any game state.
  exitButton: {
    position: 'absolute',
    left: 6,
    top: (H - 28) / 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starButton: {
    position: 'absolute',
    right: 10,
    top: (H - 56) / 2,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.star,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#c98a00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  starButtonText: {
    fontSize: 28,
    color: '#8a5c00',
  },
  // Sits above the mini-boss countdown bar (y=282) and banner (y=292) so the
  // transcript never overlaps them.
  heardContainer: {
    position: 'absolute',
    bottom: 46,
    left: 40,
    right: 40,
    alignItems: 'center',
  },
  heardText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 8,
    color: COLORS.shield,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    textAlign: 'center',
  },
  exitButtonText: {
    fontSize: 16,
    color: '#fff',
  },
});

export default WordRacerGame;
