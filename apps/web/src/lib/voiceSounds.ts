/**
 * voiceSounds.ts — Web Audio API synthesized voice state sounds
 * No audio files needed. All sounds generated in real-time.
 *
 * Join    → two ascending tones (pleasant entry chime)
 * Leave   → two descending tones (soft exit)
 * Mute    → short low blip
 * Unmute  → short higher blip
 * Deafen  → descending frequency sweep
 * Undeafen→ ascending frequency sweep
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Play a simple tone with fade-in and exponential fade-out */
function tone(
  freq:     number,
  duration: number,
  vol       = 0.22,
  type: OscillatorType = 'sine',
  startDelay = 0,
) {
  try {
    const ac   = getCtx();
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + startDelay);
    gain.gain.setValueAtTime(0, ac.currentTime + startDelay);
    gain.gain.linearRampToValueAtTime(vol, ac.currentTime + startDelay + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + startDelay + duration);
    osc.start(ac.currentTime + startDelay);
    osc.stop(ac.currentTime + startDelay + duration + 0.05);
  } catch { /* AudioContext blocked — ignore */ }
}

/** Play a frequency sweep (for deafen/undeafen) */
function sweep(fromHz: number, toHz: number, duration: number, vol = 0.2) {
  try {
    const ac   = getCtx();
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fromHz, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(toHz, ac.currentTime + duration);
    gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration + 0.04);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration + 0.08);
  } catch { /* ignore */ }
}

export const voiceSounds = {
  /** User joins a voice channel — ascending two-tone chime */
  join() {
    tone(587, 0.14, 0.22, 'sine', 0);     // D5
    tone(880, 0.20, 0.18, 'sine', 0.14);  // A5
  },

  /** User leaves a voice channel — descending two-tone */
  leave() {
    tone(660, 0.14, 0.22, 'sine', 0);     // E5
    tone(440, 0.20, 0.18, 'sine', 0.14);  // A4
  },

  /** Microphone muted */
  mute() {
    tone(280, 0.10, 0.20, 'sine');
  },

  /** Microphone unmuted */
  unmute() {
    tone(520, 0.10, 0.20, 'sine');
  },

  /** Headphones deafened (can no longer hear) */
  deafen() {
    sweep(540, 200, 0.22, 0.20);
  },

  /** Headphones undeafened */
  undeafen() {
    sweep(200, 540, 0.22, 0.20);
  },
};
