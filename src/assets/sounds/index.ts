/**
 * Word Racer v2 - Sound Asset Registry
 * All sound files for React Native require()
 */

export const sounds = {
  // SFX
  start: require('./start.wav'),
  swoosh: require('./swoosh.wav'),
  coin: require('./coin.wav'),
  pass: require('./pass.wav'),
  powerup: require('./powerup.wav'),
  shieldpop: require('./shieldpop.wav'),
  warn: require('./warn.wav'),
  smash: require('./smash.wav'),
  crash: require('./crash.wav'),
  miss: require('./miss.wav'),
  over: require('./over.wav'),
  record: require('./record.wav'),

  // Music loops
  musicDriveLoop: require('./music_drive_loop.wav'),
  musicBarrierLoop: require('./music_barrier_loop.wav'),
};

export type SoundName = keyof typeof sounds;

export default sounds;
