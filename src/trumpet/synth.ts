// The trumpet's voice made in code (no recordings): a brassy tone that plays
// until recordings are added (sampler.ts), or if they can't load.
//
// Two sawtooths and a narrow pulse through a low-pass filter that opens on
// the attack (the "blat" of a tongued brass note) and settles a little darker,
// a small scoop up into the pitch, a puff of breath as the tongue releases,
// and a gentle vibrato that grows on a held note.
//
// `BrassVoice` is all the rest of the app knows of a voice.

/** One note at a time, like a trumpet. Times are the AudioContext's (s). */
export interface BrassVoice {
  /** Plays `midi` from `at` for `length` s, `velocity` 0..1 (a new note ends the last). */
  note(midi: number, velocity: number, at: number, length: number): void;
  /** The note stops at `at`. */
  stop(at: number): void;
}

export const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * The tone: loudness at full strength; the filter (× the note's frequency)
 * as it opens, where it settles, and how long that takes (s); the attack and
 * release (s); the scoop into the pitch (cents, s); the vibrato (Hz, cents,
 * when it starts and how long it takes to grow, s).
 */
export const BRASS = {
  loud: 0.2,
  open: 6,
  openLoud: 5,
  settle: 3.2,
  settleLoud: 2.2,
  openTime: 0.045,
  attack: 0.022,
  release: 0.05,
  scoop: { cents: -38, time: 0.025 },
  vibrato: { hz: 5.4, cents: 14, from: 0.28, grow: 0.5 },
  breath: 0.07,
};

let noise: AudioBuffer | null = null;
const noiseOf = (c: BaseAudioContext) => {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  const n = Math.round(c.sampleRate * 0.12);
  noise = c.createBuffer(1, n, c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < n; i += 1) d[i] = Math.random() * 2 - 1;
  return noise;
};

let pulse: PeriodicWave | null = null;
/** A pulse wave a quarter of the cycle wide (nasal, like a brass bell). */
const pulseOf = (c: BaseAudioContext) => {
  if (pulse) return pulse;
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  const duty = 0.25;
  for (let k = 1; k < n; k += 1)
    imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  pulse = c.createPeriodicWave(real, imag);
  return pulse;
};

let edge: Float32Array | null = null;
/** A soft clip: a little grit when played hard. */
const edgeCurve = () => {
  if (edge) return edge;
  const n = 1024;
  edge = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    edge[i] = Math.tanh(1.6 * x) / Math.tanh(1.6);
  }
  return edge;
};

type Sounding = { g: GainNode; stop: (at: number) => void };

/** Keeps a level as it will be at `at`, dropping what was planned after it. */
export const holdAt = (p: AudioParam, at: number) => {
  const q = p as AudioParam & { cancelAndHoldAtTime?: (t: number) => void };
  if (q.cancelAndHoldAtTime) q.cancelAndHoldAtTime(at);
  else {
    p.cancelScheduledValues(at);
    p.setValueAtTime(p.value, at);
  }
};

export const synthBrass = (c: BaseAudioContext, out: AudioNode): BrassVoice => {
  let last: Sounding | null = null;
  const end = (s: Sounding | null, at: number, tc: number) => {
    if (!s) return;
    holdAt(s.g.gain, at);
    s.g.gain.setTargetAtTime(0, at, tc);
    s.stop(at + tc * 8);
  };
  return {
    note(midi, velocity, at, length) {
      end(last, at, 0.008);
      const v = Math.min(1, Math.max(0, velocity));
      const f = frequency(midi);
      const len = Math.max(0.06, length);
      const stopAt = at + len + BRASS.release * 8;

      const g = c.createGain();
      g.connect(out);
      const shape = c.createWaveShaper();
      shape.curve = edgeCurve() as Float32Array<ArrayBuffer>;
      const bell = c.createBiquadFilter();
      bell.type = "peaking";
      bell.frequency.value = 1400;
      bell.Q.value = 0.9;
      bell.gain.value = 4;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 1.6;
      const top = Math.min(12000, f * (BRASS.open + BRASS.openLoud * v));
      const rest = Math.min(9000, f * (BRASS.settle + BRASS.settleLoud * v));
      lp.frequency.setValueAtTime(f * 1.3, at);
      lp.frequency.linearRampToValueAtTime(top, at + BRASS.openTime);
      lp.frequency.setTargetAtTime(rest, at + BRASS.openTime, 0.14);
      const drive = c.createGain();
      drive.gain.value = 0.6 + 0.9 * v;
      lp.connect(drive).connect(shape).connect(bell).connect(g);

      // The vibrato grows on a held note.
      const lfo = c.createOscillator();
      lfo.frequency.value = BRASS.vibrato.hz;
      const depth = c.createGain();
      depth.gain.setValueAtTime(0, at);
      if (len > BRASS.vibrato.from + 0.15) {
        depth.gain.setValueAtTime(0, at + BRASS.vibrato.from);
        depth.gain.linearRampToValueAtTime(
          BRASS.vibrato.cents,
          at + BRASS.vibrato.from + BRASS.vibrato.grow,
        );
      }
      lfo.connect(depth);
      lfo.start(at);
      lfo.stop(stopAt);

      const parts: Array<[OscillatorType | "pulse", number, number]> = [
        ["sawtooth", 0, 0.45],
        ["sawtooth", 7, 0.3],
        ["pulse", -4, 0.35],
      ];
      const oscs = parts.map(([type, detune, level]) => {
        const o = c.createOscillator();
        if (type === "pulse") o.setPeriodicWave(pulseOf(c));
        else o.type = type;
        o.frequency.value = f;
        o.detune.setValueAtTime(detune + BRASS.scoop.cents, at);
        o.detune.setTargetAtTime(detune, at, BRASS.scoop.time);
        depth.connect(o.detune);
        const og = c.createGain();
        og.gain.value = level;
        o.connect(og).connect(lp);
        o.start(at);
        o.stop(stopAt);
        return o;
      });

      // A puff of breath as the tongue lets the note go.
      const puff = c.createBufferSource();
      puff.buffer = noiseOf(c);
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = Math.min(6000, f * 4);
      bp.Q.value = 1.2;
      const pg = c.createGain();
      pg.gain.setValueAtTime(BRASS.breath * (0.4 + 0.6 * v), at);
      pg.gain.setTargetAtTime(0, at + 0.01, 0.025);
      puff.connect(bp).connect(pg).connect(g);
      puff.start(at);
      puff.stop(at + 0.12);

      const peak = BRASS.loud * (0.45 + 0.55 * v);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(peak, at + BRASS.attack);
      g.gain.setTargetAtTime(peak * 0.82, at + BRASS.attack, 0.2);
      g.gain.setTargetAtTime(0, at + len, BRASS.release);

      const s: Sounding = {
        g,
        stop: (t) =>
          [...oscs, lfo].forEach((o) => {
            try {
              o.stop(t);
            } catch {
              // already stopped
            }
          }),
      };
      last = s;
    },
    stop(at) {
      end(last, at, BRASS.release * 0.6);
      last = null;
    },
  };
};
