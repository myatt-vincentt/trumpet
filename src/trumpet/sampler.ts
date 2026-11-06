// The trumpet's recorded voice, behind the same `BrassVoice` as the voice made
// in code (synth.ts). The app ships without recordings: set SAMPLES_MANIFEST
// to a list of recorded notes to use them.
//
// The list (JSON): { "notes": [ { "midi": 60, "file": "/sounds/trumpet-c4.m4a",
// "loopStart": 0.4, "loopEnd": 1.6 }, … ] }. Each note plays the nearest
// recording, retuned by at most a few semitones; a note held longer than its
// recording loops between loopStart and loopEnd (seconds) when they are given.
import { holdAt, type BrassVoice } from "./synth";

/** A recorded note. */
export type SampleNote = {
  midi: number;
  buffer: AudioBuffer;
  loop: { start: number; end: number } | null;
};
export type SampleBank = { notes: SampleNote[] };

type Manifest = {
  notes: Array<{
    midi: number;
    file: string;
    loopStart?: number;
    loopEnd?: number;
  }>;
};

/** Where the recordings' list is (null: no recordings, the voice made in code plays). */
export const SAMPLES_MANIFEST: string | null = null;

/** Loads the recordings (null when there are none, or they can't be loaded). */
export const loadSamples = async (
  ctx: BaseAudioContext,
): Promise<SampleBank | null> => {
  if (!SAMPLES_MANIFEST) return null;
  try {
    const res = await fetch(SAMPLES_MANIFEST);
    if (!res.ok) return null;
    const m = (await res.json()) as Manifest;
    const notes = await Promise.all(
      m.notes.map(async (n) => {
        const r = await fetch(n.file);
        if (!r.ok) throw new Error(n.file);
        const buffer = await ctx.decodeAudioData(await r.arrayBuffer());
        const loop =
          n.loopStart !== undefined && n.loopEnd !== undefined
            ? { start: n.loopStart, end: n.loopEnd }
            : null;
        return { midi: n.midi, buffer, loop };
      }),
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

/** Loudness: a gentle note and the hardest; fades in and out (time constants, s). */
const LOUD = { soft: 0.35, full: 1.0, scale: 0.9 };
const TIME = { attack: 0.006, release: 0.05, cut: 0.008 };

type Sounding = { g: GainNode; src: AudioBufferSourceNode };

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
    try {
      s.src.stop(at + tc * 8);
    } catch {
      // already stopped
    }
  };
  return {
    note(midi, velocity, at, length) {
      end(last, at, TIME.cut);
      const v = Math.min(1, Math.max(0, velocity));
      const { sample, shift } = nearestSample(bank.notes, midi);
      const g = c.createGain();
      g.connect(out);
      const src = c.createBufferSource();
      src.buffer = sample.buffer;
      src.playbackRate.value = 2 ** (shift / 12);
      if (sample.loop) {
        src.loop = true;
        src.loopStart = sample.loop.start;
        src.loopEnd = sample.loop.end;
      }
      src.connect(g);
      const peak = LOUD.scale * (LOUD.soft + (LOUD.full - LOUD.soft) * v);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(peak, at + TIME.attack);
      g.gain.setTargetAtTime(0, at + length, TIME.release);
      src.start(at);
      src.stop(at + length + TIME.release * 8);
      last = { g, src };
    },
    stop(at) {
      end(last, at, TIME.release * 0.6);
      last = null;
    },
  };
};
