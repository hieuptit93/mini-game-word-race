/**
 * Word Racer v2 - Image Asset Registry
 * All part images exported for React Native require()
 */

// ---------------------------------------------------------------------------
// COMPOSED sprites (generated — do not hand-edit)
//
// Built by `python3 scripts/compose-sprites.py` from the individual parts
// below. Each one flattens a whole rig into a single PNG so the game mounts
// ONE <Image> per object instead of stacking 2-7 of them: a coin was 3 images
// (12 coins on screen = 36), the car 7, the barrier 14. Re-run the script if
// any part PNG or palette colour changes.
// ---------------------------------------------------------------------------
export const coin = require('./composed/coin.png');
export const car = require('./composed/car.png');
export const carShielded = require('./composed/car_shielded.png');
export const shieldItem = require('./composed/shield_item.png');
export const magnetItem = require('./composed/magnet_item.png');
export const barrier = require('./composed/barrier.png');
export const signActive = require('./composed/sign_active.png');
export const signIdle = require('./composed/sign_idle.png');

// Road parts
export const roadShoulder = require('./parts/road_shoulder.png');
export const roadSurface = require('./parts/road_surface.png');
export const roadEdgeL = require('./parts/road_edge_l.png');
export const roadEdgeR = require('./parts/road_edge_r.png');
export const roadDash = require('./parts/road_dash.png');

// Car parts
export const carNose = require('./parts/car_nose.png');
export const carWingFront = require('./parts/car_wing_front.png');
export const carCockpit = require('./parts/car_cockpit.png');
export const carWingRear = require('./parts/car_wing_rear.png');
export const carWheels = require('./parts/car_wheels.png');
export const carWindow = require('./parts/car_window.png');
export const carShieldRing = require('./parts/car_shield_ring.png');

// Obstacle parts
export const obsCone = require('./parts/obs_cone.png');
export const obsBlock = require('./parts/obs_block.png');
export const obsHazard = require('./parts/obs_hazard.png');

// Coin parts
export const coinDisc = require('./parts/coin_disc.png');
export const coinCore = require('./parts/coin_core.png');
export const coinShine = require('./parts/coin_shine.png');

// Shield parts
export const shieldHex = require('./parts/shield_hex.png');
export const shieldCross = require('./parts/shield_cross.png');

// Magnet parts
export const magnetLegs = require('./parts/magnet_legs.png');
export const magnetArc = require('./parts/magnet_arc.png');
export const magnetTips = require('./parts/magnet_tips.png');
export const magnetHole = require('./parts/magnet_hole.png');

// Barrier parts
export const barrierRail = require('./parts/barrier_rail.png');
export const barrierBlock = require('./parts/barrier_block.png');
export const barrierBase = require('./parts/barrier_base.png');

// Sign parts
export const signPlate = require('./parts/sign_plate.png');
export const signBorder = require('./parts/sign_border.png');
export const signLabel = require('./parts/sign_label.png');

// Boss UI parts
export const bossBarBg = require('./parts/boss_bar_bg.png');
export const bossBarFill = require('./parts/boss_bar_fill.png');
export const bossBanner = require('./parts/boss_banner.png');
export const bossSayLabel = require('./parts/boss_say_label.png');
export const bossSentence = require('./parts/boss_sentence.png');

// HUD parts
export const hudCoinText = require('./parts/hud_coin_text.png');
export const hudRoundText = require('./parts/hud_round_text.png');
export const hudLifePip = require('./parts/hud_life_pip.png');
export const hudShieldLabel = require('./parts/hud_shield_label.png');
export const hudMagnetLabel = require('./parts/hud_magnet_label.png');

// Star
export const starShape = require('./parts/star_shape.png');

// Screen sprites (reference only)
export const screenDrive = require('./sprites/screen_drive.png');
export const screenBarrier = require('./sprites/screen_barrier.png');
export const screenTitle = require('./sprites/screen_title.png');
export const screenOver = require('./sprites/screen_over.png');
export const sheetItems = require('./sprites/sheet_items.png');
export const sheetCarStates = require('./sprites/sheet_car_states.png');
