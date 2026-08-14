/**
 * Word Racer v2 - Game Canvas Component
 * Renders using the real exported part PNGs (src/assets/images/parts),
 * positioned to match word_racer.html's canvas drawing math exactly.
 * Dynamic text (HUD numbers, lane words, boss sentence) stays as RN <Text>
 * with the pixel font — the equivalent PNGs in assets/images/sprites are
 * static reference renders only, not usable for live-changing content.
 */

import React, { memo, useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import {
  W, H, ROAD_L, ROAD_R, LANE_X, LANE_W, CAR_Y, CAR_W, CAR_H, OB_H,
  COLORS, GameState, GameItem, Barrier, LaneWord,
} from './constants';
import * as SPRITES from '../assets/images';

// Enough dash slots to always cover the visible road, regardless of scroll
// offset. Fixed/constant so slot keys stay stable across frames.
const DASH_SLOTS = Math.ceil((H + 40) / 56) + 1;

interface GameCanvasProps {
  state: GameState;
  stats: {
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
  };
  items: GameItem[];
  barrier: Barrier | null;
  laneWords: LaneWord[];
  message: { text: string; until: number };
  floats: { x: number; y: number; txt: string; col: string; life: number }[];
  flashes: { x: number; y: number; w: number; h: number; until: number }[];
  comboMult: (streak: number) => number;
  leaderboard?: { name: string; score: number; you: boolean }[];
  lbRank?: number;
  serverBestScore?: number;
  // Drives the title/game-over blink text. Passed in explicitly (rather
  // than computed from Date.now() at render time) because this component
  // doesn't re-render on its own cadence while on those screens — see
  // WordRacerGame's blink effect for why.
  blink?: boolean;
}

// ============================================================================
// RENDERING STRATEGY
//
// Two deliberate choices keep the number of native views per frame low — this
// game used to mount ~80 <Image> nodes simultaneously and janked badly once
// served from a real CDN instead of localhost:
//
// 1. Multi-part rigs use a PRE-COMPOSED sprite (scripts/compose-sprites.py):
//    one <Image> for the whole car / coin / barrier / power-up instead of
//    stacking its 2-7 parts at runtime. A coin was 3 images, so 12 coins on
//    screen meant 36; the barrier alone was 14.
//
// 2. Parts that are just a solid-colour rectangle are plain <View>s. Decoding
//    a PNG to fill a rect is pure waste — and the road ones were egregious:
//    road_surface.png is 1152x1280 of a single colour (~6MB once decoded to
//    RGBA), road_shoulder.png another 1264x1280, for two flat rectangles.
//    Colours come from the same palette (COLORS / assets.json), so these are
//    pixel-identical to the images they replace.
// ============================================================================

// ---- Car — one composed sprite; the shielded state is its own sprite (the
// ring sits 3px outside the body on every side, hence the larger box).
//
// The invincibility blink toggles OPACITY rather than returning null. Returning
// null unmounts the Image, and every time it came back React had to mount a
// fresh native image view and re-resolve the source — over the 1200ms of
// post-crash blinking (a toggle every 120ms) that's ~5 remounts, each showing a
// blank/white frame before the sprite appeared. Keeping it mounted makes the
// blink instant. Visually identical to the original's hide-the-frame approach.
const Car = memo<{ x: number; visible: boolean; hasShield: boolean }>(({ x, visible, hasShield }) => (
  <Image
    source={hasShield ? SPRITES.carShielded : SPRITES.car}
    resizeMode="stretch"
    style={{
      position: 'absolute',
      left: hasShield ? x - CAR_W / 2 - 3 : x - CAR_W / 2,
      top: hasShield ? CAR_Y - 3 : CAR_Y,
      width: hasShield ? CAR_W + 6 : CAR_W,
      height: hasShield ? CAR_H + 6 : CAR_H,
      opacity: visible ? 1 : 0,
    }}
  />
));

// ---- Obstacle — 3 variants; each source PNG already carries its own colour
// (verified against the palette), so no tintColor pass is needed. ----
const OBS_HEIGHT = [28, 24, 24]; // cone(vk0) 7 rows, block/hazard 6 rows, ×4px
const Obstacle = memo<{ x: number; y: number; vk: number }>(({ x, y, vk }) => {
  const source = vk === 0 ? SPRITES.obsCone : vk === 1 ? SPRITES.obsBlock : SPRITES.obsHazard;
  const h = OBS_HEIGHT[vk] ?? 28;
  return (
    <Image source={source} resizeMode="stretch" style={{ position: 'absolute', left: x - 16, top: y, width: 32, height: h }} />
  );
});

// ---- Coin — composed disc+core (they pulse together) + the shine as a View.
// The shine is deliberately NOT part of the sprite: assets.json specifies it
// must stay pixel-crisp and NOT scale with the pulse, matching the original. ----
const Coin = memo<{ x: number; y: number; pulse: number }>(({ x, y, pulse }) => {
  const cy = y + OB_H / 2;
  return (
    <>
      <Image
        source={SPRITES.coin}
        resizeMode="stretch"
        style={{ position: 'absolute', left: x - 8, top: cy - 8, width: 16, height: 16, transform: [{ scale: pulse }] }}
      />
      <View style={{ position: 'absolute', left: x - 2, top: cy - 3, width: 2, height: 4, backgroundColor: COLORS.coinShine }} />
    </>
  );
});

// ---- Shield power-up — composed hex + cross ----
const ShieldItem = memo<{ x: number; y: number }>(({ x, y }) => (
  <Image
    source={SPRITES.shieldItem}
    resizeMode="stretch"
    style={{ position: 'absolute', left: x - 9, top: y + OB_H / 2 - 10, width: 18, height: 21 }}
  />
));

// ---- Magnet power-up — composed arc + legs + tips, with the inner hole
// punched out to transparent so the black canvas shows through. ----
const MagnetItem = memo<{ x: number; y: number }>(({ x, y }) => (
  <Image
    source={SPRITES.magnetItem}
    resizeMode="stretch"
    style={{ position: 'absolute', left: x - 9, top: y + OB_H / 2 - 18, width: 18, height: 26 }}
  />
));

// ---- Static road structure — 4 solid rects (see note 2 above). ----
const RoadStructure = memo(() => (
  <>
    <View style={{ position: 'absolute', left: ROAD_L - 14, top: 0, width: ROAD_R - ROAD_L + 28, height: H, backgroundColor: COLORS.roadShoulder }} />
    <View style={{ position: 'absolute', left: ROAD_L, top: 0, width: ROAD_R - ROAD_L, height: H, backgroundColor: COLORS.road }} />
    <View style={{ position: 'absolute', left: ROAD_L - 4, top: 0, width: 4, height: H, backgroundColor: COLORS.roadEdge }} />
    <View style={{ position: 'absolute', left: ROAD_R, top: 0, width: 4, height: H, backgroundColor: COLORS.roadEdge }} />
  </>
));

// ---- HUD life pips — solid 16x8 rects, only change when `lives` changes. ----
const LifePips = memo<{ lives: number }>(({ lives }) => (
  <View style={styles.hudLives}>
    {[0, 1, 2].map(i => (
      <View key={i} style={{ width: 16, height: 8, backgroundColor: i < lives ? COLORS.life : COLORS.lifeOff }} />
    ))}
  </View>
));

// ---- One lane sign — composed plate+border sprite per state, word as Text.
// Memoized individually so a lane change only re-renders the 2 signs whose
// active state actually flipped. ----
const LaneSign = memo<{ word: string; active: boolean; left: number }>(({ word, active, left }) => (
  <View style={{ position: 'absolute', left, top: 30, width: 90, height: 24 }}>
    <Image
      source={active ? SPRITES.signActive : SPRITES.signIdle}
      resizeMode="stretch"
      style={{ position: 'absolute', left: 2, top: 2, width: 86, height: 20 }}
    />
    <Text style={[styles.pxText, styles.signLabel, { color: active ? COLORS.obs3 : '#fff' }]}>{word}</Text>
  </View>
));

const GameCanvas: React.FC<GameCanvasProps> = ({
  state,
  stats,
  items,
  barrier,
  laneWords,
  message,
  floats,
  flashes,
  comboMult,
  leaderboard = [],
  lbRank = 0,
  serverBestScore,
  blink = true,
}) => {
  const now = Date.now();

  // Road dashes — 2 inner lane-divider columns, scrolling per roadScroll.
  // Recomputed every render (every tick) so the scroll is pixel-smooth —
  // throttling this to every 10px of scroll used to make it visibly
  // stutter/step instead of glide.
  //
  // IMPORTANT: each dash slot uses a STABLE key (column + slot index, not
  // its Y position). A key embedding Math.round(y) changes every single
  // frame while scrolling, which makes React unmount/remount every dash
  // instead of just updating its `top` style in place.
  //
  // These are 4x26 solid rects, so they're Views — no decode, no image cache.
  const roadDashes = useMemo(() => {
    const dashes: JSX.Element[] = [];
    const dashOffset = stats.roadScroll % 56;
    for (let k = 1; k < 3; k++) {
      const x = ROAD_L + LANE_W * k - 2;
      for (let i = 0; i < DASH_SLOTS; i++) {
        const y = -40 + dashOffset + i * 56;
        if (y >= H) continue;
        dashes.push(
          <View
            key={`d${k}-${i}`}
            style={{ position: 'absolute', left: x, top: y, width: 4, height: 26, backgroundColor: COLORS.roadDash }}
          />
        );
      }
    }
    return dashes;
  }, [stats.roadScroll]);

  // Title screen
  if (state === 'title') {
    return (
      <View style={styles.canvas}>
        <Text style={[styles.pxText, styles.titleMain]}>WORD  RACER</Text>
        <Text style={[styles.pxText, styles.titleSub]}>COIN  RUSH</Text>
        <Text style={[styles.pxText, styles.titleLevel]}>PRE-A1</Text>
        {blink && (
          <>
            <Text style={[styles.pxText, styles.titlePress]}>PRESS THE STAR BUTTON</Text>
            <Text style={[styles.pxText, styles.titleStart]}>TO START PLAYING</Text>
          </>
        )}
        <Image source={SPRITES.starShape} resizeMode="contain" style={{ position: 'absolute', left: W / 2 - 14, top: 238, width: 28, height: 28, tintColor: COLORS.star }} />
      </View>
    );
  }

  // Game over screen
  if (state === 'over') {
    const bestScore = serverBestScore ?? stats.hiscore;
    return (
      <View style={styles.canvas}>
        <Text style={[styles.pxText, styles.overTitle]}>GAME OVER</Text>
        <Text style={[styles.pxText, styles.overScore]}>SCORE {Math.round(stats.score)}   BEST {Math.round(bestScore)}</Text>
        <Text style={[styles.pxText, styles.overCoins]}>XU {stats.coins}   RANK #{lbRank}</Text>
        <Text style={[styles.pxText, styles.overLeaderboard]}>--- TOP 5 ALL TIME ---</Text>
        {leaderboard.slice(0, 5).map((row, i) => (
          <View key={i} style={[styles.lbRow, { top: 136 + i * 22 }]}>
            <Text style={[styles.lbText, styles.lbRankText, row.you && styles.lbYou]}>{i + 1}.</Text>
            <Text style={[styles.lbText, styles.lbName, row.you && styles.lbYou]}>{row.name}</Text>
            <Text style={[styles.lbText, styles.lbScoreText, row.you && styles.lbYou]}>{row.score}</Text>
          </View>
        ))}
        {blink && <Text style={[styles.pxText, styles.overReplay]}>PRESS * TO PLAY AGAIN</Text>}
      </View>
    );
  }

  // Drive / Barrier state
  const mult = comboMult(stats.streak);
  const carVisible = !(now < stats.invUntil && Math.floor(now / 120) % 2 === 0);

  return (
    <View style={styles.canvas}>
      {/* Road */}
      <RoadStructure />
      {roadDashes}

      {/* HUD (dynamic text stays as RN Text) */}
      <Text style={[styles.pxText, styles.hudCoins]}>XU {stats.coins}{mult > 1 ? ` x${mult}` : ''}</Text>
      <Text style={[styles.pxText, styles.hudRound]}>C{stats.round}</Text>
      <LifePips lives={stats.lives} />
      {stats.shield > 0 && <Text style={[styles.pxText, styles.hudShield]}>SHIELD</Text>}
      {now < stats.magnetUntil && <Text style={[styles.pxText, styles.hudMagnet]}>MAGNET</Text>}

      {/* Lane Signs — each memoized separately so a lane change only
          re-renders the 2 affected signs (old active + new active), not
          all 3 every tick. */}
      {laneWords.map((lw, i) => (
        <LaneSign key={i} word={lw.word} active={i === stats.lane} left={LANE_X[i] - 45} />
      ))}

      {/* Items — keyed by the item's stable id (NOT array index). Items get
          removed from the middle of the array (collected/passed/off-screen),
          which shifts indices; an index-based key would let a later item
          (possibly a different obstacle variant, or a coin where an
          obstacle used to be) inherit an earlier item's rendered Image
          view and swap its `source` in place — forcing a fresh network
          fetch for the new image, which is where the CDN-only jank came
          from (near-free on localhost, visible over a real network). */}
      {items.map((item) => {
        const x = LANE_X[item.lane];
        const y = item.y;

        if (item.kind === 'obs') return <Obstacle key={item.id} x={x} y={y} vk={item.vk ?? 0} />;
        if (item.kind === 'coin') {
          const pulse = 1 + 0.12 * Math.sin(now / 160 + x);
          return <Coin key={item.id} x={x} y={y} pulse={pulse} />;
        }
        if (item.kind === 'shield') return <ShieldItem key={item.id} x={x} y={y} />;
        if (item.kind === 'magnet') return <MagnetItem key={item.id} x={x} y={y} />;
        return null;
      })}

      {/* Barrier (mini-boss) — rail + 12 alternating stripe tiles + steel base
          are baked into ONE composed sprite (was 14 separate images). Its top
          edge is 6px above barrier.y, matching the rail's original offset. */}
      {barrier && (
        <>
          <Image
            source={SPRITES.barrier}
            resizeMode="stretch"
            style={{ position: 'absolute', left: ROAD_L, top: barrier.y - 6, width: ROAD_R - ROAD_L, height: 28 }}
          />

          {/* Countdown bar — flat rects, and the fill's colour changes with
              time remaining, so Views (no tint pass, no 3 colour variants). */}
          <View style={{ position: 'absolute', left: (W - 344) / 2, top: 282, width: 344, height: 8, backgroundColor: 'rgba(0,0,0,0.5)' }} />
          <View
            style={{
              position: 'absolute',
              left: (W - 344) / 2,
              top: 282,
              width: 344 * Math.max(0, (barrier.deadline - now) / barrier.duration),
              height: 8,
              backgroundColor:
                (barrier.deadline - now) / barrier.duration > 0.5 ? COLORS.timerOk :
                (barrier.deadline - now) / barrier.duration > 0.25 ? COLORS.timerWarn : COLORS.timerCrit,
            }}
          />

          {/* Say banner — single line centered with blink animation */}
          <View style={styles.sayBannerContainer}>
            <View style={styles.sayBannerBg}>
              <Text style={[styles.sayBannerText, { opacity: blink ? 1 : 0.5 }]}>
                {barrier.sentence.toUpperCase()}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Car */}
      <Car x={stats.carX} visible={carVisible} hasShield={stats.shield > 0} />

      {/* Flashes */}
      {flashes.map((f, i) => (
        <View key={i} style={[styles.flash, { left: f.x, top: f.y, width: f.w, height: f.h, opacity: (f.until - now) / 160 }]} />
      ))}

      {/* Float texts */}
      {floats.map((f, i) => (
        <Text key={i} style={[styles.floatText, { left: f.x - 30, top: f.y, color: f.col, opacity: f.life }]}>{f.txt}</Text>
      ))}

      {/* Message */}
      {message.text && (message.until === 0 || now < message.until) && (
        <Text style={[styles.pxText, styles.message]}>{message.text}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  canvas: { width: W, height: H, backgroundColor: COLORS.bg, overflow: 'hidden' },
  // NOTE: word_racer.html uses the "Press Start 2P" pixel font for all
  // canvas text. That font file isn't bundled/linked in this RN project yet
  // (no .ttf found, no UIAppFonts entry) — using 'monospace' as a safe
  // fallback so text doesn't silently fall back to the OS default. Add the
  // real font file + link it (react-native.config.js assets + relink) for
  // pixel-perfect fidelity.
  pxText: { fontFamily: 'monospace', fontWeight: 'bold', position: 'absolute' },
  lbText: { fontFamily: 'monospace', fontWeight: 'bold' }, // no position:absolute — sits in flex row

  hudCoins: { left: 6, top: 8, fontSize: 8, color: COLORS.coin },
  hudRound: { left: W / 2 - 16, top: 8, fontSize: 8, color: COLORS.hudRound },
  hudLives: { position: 'absolute', right: 8, top: 8, flexDirection: 'row-reverse', gap: 8 },
  hudShield: { left: 6, top: 20, fontSize: 7, color: COLORS.shield },
  hudMagnet: { left: 70, top: 20, fontSize: 7, color: COLORS.magnet },

  signLabel: { position: 'absolute', left: 2, top: 9, width: 86, fontSize: 7, textAlign: 'center' },

  bossBannerRow: { position: 'absolute', left: 0, top: 292, width: W, height: 28, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  sayBannerContainer: { position: 'absolute', left: 0, right: 0, top: 130, flexDirection: 'row', justifyContent: 'center', zIndex: 100 },
  sayBannerBg: { backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  sayBannerText: { fontFamily: 'monospace', fontWeight: 'bold', fontSize: 14, color: '#FFD700' },

  flash: { position: 'absolute', backgroundColor: COLORS.flash },
  floatText: { position: 'absolute', fontSize: 8, textAlign: 'center', width: 60, fontFamily: 'monospace', fontWeight: 'bold' },
  message: { left: 0, top: H / 2 - 40, width: W, fontSize: 12, color: '#fff', textAlign: 'center' },

  titleMain: { left: 0, top: 80, width: W, fontSize: 18, color: COLORS.hudRound, textAlign: 'center' },
  titleSub: { left: 0, top: 112, width: W, fontSize: 10, color: COLORS.coin, textAlign: 'center' },
  titleLevel: { left: 0, top: 136, width: W, fontSize: 8, color: COLORS.shield, textAlign: 'center' },
  titlePress: { left: 0, top: 188, width: W, fontSize: 10, color: COLORS.obs3, textAlign: 'center' },
  titleStart: { left: 0, top: 208, width: W, fontSize: 10, color: COLORS.obs3, textAlign: 'center' },

  overTitle: { left: 0, top: 30, width: W, fontSize: 16, color: COLORS.crash, textAlign: 'center' },
  overCoins: { left: 0, top: 62, width: W, fontSize: 9, color: COLORS.coin, textAlign: 'center' },
  overScore: { left: 0, top: 82, width: W, fontSize: 9, color: '#fff', textAlign: 'center' },
  overLeaderboard: { left: 0, top: 112, width: W, fontSize: 8, color: COLORS.shield, textAlign: 'center' },
  lbRow: { position: 'absolute', left: 120, flexDirection: 'row', alignItems: 'center' },
  lbRankText: { fontSize: 9, color: '#fff', width: 30 },
  lbName: { fontSize: 9, color: '#fff', width: 150 },
  lbScoreText: { fontSize: 9, color: '#fff', width: 72, textAlign: 'right' },
  lbYou: { color: COLORS.obs3 },
  overReplay: { left: 0, top: 272, width: W, fontSize: 9, color: COLORS.obs3, textAlign: 'center' },
});

export default memo(GameCanvas);
