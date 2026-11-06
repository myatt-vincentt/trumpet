// The trumpet's recorded voice: real trumpet notes (held, with a gentle
// vibrato), each recorded soft and loud, behind the same `BrassVoice` as the
// voice made in code (synth.ts), which only plays if the recordings can't load.
//
// Each note plays the nearest recording, retuned (at most two semitones). How
// hard it is tongued blends the soft and the loud recording (an accented beat
// is mostly the loud one, a light off-beat mostly the soft) and sets the
// loudness. A note held longer than its recording loops a stretch of its
// sustain (the recordings carry a seamless loop). A trumpet plays one note at
// a time: a new note ends the last within a few thousandths of a second.
import { holdAt, type BrassVoice } from "./synth";

/** A recorded note, soft and loud, and its loop (s). */
export type SampleNote = {
  midi: number;
  soft: AudioBuffer;
  loud: AudioBuffer;
  loop: { start: number; end: number } | null;
};
export type SampleBank = { notes: SampleNote[] };

type Manifest = {
  notes: Array<{
    midi: number;
    soft: string;
    loud: string;
    loopStart?: number;
    loopEnd?: number;
  }>;
};

/** Where the recordings' list is (null: no recordings, the voice made in code plays). */
export const SAMPLES_MANIFEST: string | null = "/sounds/trumpet.json";

/** Loads the recordings (null when there are none, or they can't be loaded). */
export const loadSamples = async (
  ctx: BaseAudioContext,
): Promise<SampleBank | null> => {
  if (!SAMPLES_MANIFEST) return null;
  try {
    const res = await fetch(SAMPLES_MANIFEST);
    if (!res.ok) return null;
    const m = (await res.json()) as Manifest;
    const load = async (file: string) => {
      const r = await fetch(file);
      if (!r.ok) throw new Error(file);
      return ctx.decodeAudioData(await r.arrayBuffer());
    };
    const notes = await Promise.all(
      m.notes.map(async (n) => ({
        midi: n.midi,
        soft: await load(n.soft),
        loud: await load(n.loud),
        loop:
          n.loopStart !== undefined && n.loopEnd !== undefined
            ? { start: n.loopStart, end: n.loopEnd }
            : null,
      })),
    );
    return notes.length ? { notes } : null;
  } catch {
    return null;
  }
};

/** The recording nearest a note (and how far to retune it, semitones). */
export const nearestSample = <T extends { midi: number }>(
  bank: readonly T[],
  midi: number,
) => {
  let best = bank[0];
  bank.forEach((s) => {
    if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
  });
  return { sample: best, shift: midi - best.midi };
};

/**
 * How much of the loud recording is heard (equal-power blend): all soft up
 * to `soft`, all loud from `loud` (how hard the note is tongued, 0..1).
 */
export const LAYER = { soft: 0.45, loud: 0.9 };
export const layerBlend = (velocity: number) => {
  const k = Math.min(
    1,
    Math.max(0, (velocity - LAYER.soft) / (LAYER.loud - LAYER.soft)),
  );
  return {
    soft: Math.cos((k * Math.PI) / 2),
    loud: Math.sin((k * Math.PI) / 2),
  };
};

/** Loudness: a gentle note and the hardest; fades (s): in, out at the note's end, cut by the next. */
const LOUD = { soft: 0.4, full: 1.0, scale: 0.9 };
const TIME = { attack: 0.004, release: 0.06, cut: 0.008 };

type Sounding = { g: GainNode; srcs: AudioBufferSourceNode[] };

export const sampleVoice = (
  c: BaseAudioContext,
  out: AudioNode,
  bank: SampleBank,
): BrassVoice => {
  let last: Sounding | null = null;
  const end = (s: Sounding | null, at: number, tc: number) => {
    if (!s) return;
    holdAt(s.g.gain, at);
    s.g.gain.setTargetAtTime(0, at, tc);
    s.srcs.forEach((src) => {
      try {
        src.stop(at + tc * 8);
      } catch {
        // already stopped
      }
    });
  };
  return {
    note(midi, velocity, at, length) {
      end(last, at, TIME.cut);
      const v = Math.min(1, Math.max(0, velocity));
      const { sample, shift } = nearestSample(bank.notes, midi);
      const rate = 2 ** (shift / 12);
      const blend = layerBlend(v);
      const g = c.createGain();
      g.connect(out);
      const srcs = (["soft", "loud"] as const).map((layer) => {
        const src = c.createBufferSource();
        src.buffer = sample[layer];
        src.playbackRate.value = rate;
        if (sample.loop) {
          src.loop = true;
          src.loopStart = sample.loop.start;
          src.loopEnd = sample.loop.end;
        }
        const lg = c.createGain();
        lg.gain.value = blend[layer];
        src.connect(lg).connect(g);
        src.start(at);
        src.stop(at + length + TIME.release * 8);
        return src;
      });
      const peak = LOUD.scale * (LOUD.soft + (LOUD.full - LOUD.soft) * v);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(peak, at + TIME.attack);
      g.gain.setTargetAtTime(0, at + length, TIME.release);
      last = { g, srcs };
    },
    stop(at) {
      end(last, at, TIME.release * 0.6);
      last = null;
    },
  };
};
