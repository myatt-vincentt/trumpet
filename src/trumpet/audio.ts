// The trumpet's sound engine (Web Audio): one voice (recordings, sampler.ts,
// when there are any; otherwise the voice made in code, synth.ts), a small
// room's echo and a gentle limiter, and a meter the studio's speakers and the
// bell's glow move with. Silent until Start (browsers only start audio on a tap).
//
//   voice → master → dry + room → limiter → speakers
import { synthBrass, type BrassVoice } from "./synth";
import { loadSamples, sampleVoice, type SampleBank } from "./sampler";

const MASTER = 0.6;
/** The room's echo: its length (s), how fast it dies, how much of it is heard. */
const ROOM = { length: 2.0, decay: 3, wet: 0.18 };
/** Speaker motion: rise fast, fall back over this long (s). */
const RELEASE = 0.16;
/** A note played at once starts this far ahead of the audio clock (s). */
const LEAD = 0.01;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let synth: BrassVoice | null = null;
let recorded: BrassVoice | null = null;
/** Which voice plays: the recordings (when loaded) or the one made in code. */
let useRecorded = true;
let unlocked = false;
/** The recordings, once loaded (also for the development checks). */
export const samples: { bank: SampleBank | null } = { bank: null };

let analyser: AnalyserNode | null = null;
let wave: Float32Array | null = null;
let bins: Uint8Array | null = null;
/** What the room's speakers show: overall level and the low end (0..1, eased). */
const out = { level: 0, low: 0 };

/** What has been played (read by the development debug object). */
export const meter = {
  unlocked: false,
  /** The loudest sample sent out so far (1 = full scale). */
  peak: 0,
  events: [] as Array<{ t: number; what: string }>,
  /** How many notes have been sent to the voice. */
  count: 0,
};

const log = (what: string) => {
  meter.events.push({ t: Math.round((ctx?.currentTime ?? 0) * 1000), what });
  if (meter.events.length > 40) meter.events.shift();
};

/** A small room's echo: noise dying away, a little darker as it fades. */
const roomImpulse = (c: AudioContext) => {
  const n = Math.round(c.sampleRate * ROOM.length);
  const ir = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i += 1) {
      const t = i / n;
      const k = 0.3 + 0.6 * (1 - t);
      lp += (Math.random() * 2 - 1 - lp) * k;
      d[i] = lp * (1 - t) ** ROOM.decay;
    }
  }
  return ir;
};

const makeContext = () => {
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  const c = new AC({ latencyHint: "interactive" });
  master = c.createGain();
  master.gain.value = MASTER;
  const sum = c.createGain();
  const room = c.createConvolver();
  room.buffer = roomImpulse(c);
  const wet = c.createGain();
  wet.gain.value = ROOM.wet;
  master.connect(sum);
  master.connect(room).connect(wet).connect(sum);
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  analyser = c.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0;
  wave = new Float32Array(analyser.fftSize);
  bins = new Uint8Array(analyser.frequencyBinCount);
  sum.connect(limiter).connect(analyser).connect(c.destination);
  synth = synthBrass(c, master);
  const out2 = master;
  void loadSamples(c).then((bank) => {
    if (!bank || !out2) return;
    samples.bank = bank;
    recorded = sampleVoice(c, out2, bank);
  });
  return c;
};

const voice = () => (useRecorded && recorded ? recorded : synth);

export const sound = {
  /**
   * The output's level and its low end right now, each 0..1: quick to rise,
   * easing back over about 0.16 s. Silent is 0.
   */
  levels(dt: number) {
    if (!analyser || !wave || !bins || !ctx || ctx.state !== "running") {
      out.level = 0;
      out.low = 0;
      return out;
    }
    analyser.getFloatTimeDomainData(wave as Float32Array<ArrayBuffer>);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < wave.length; i += 1) {
      sum += wave[i] * wave[i];
      peak = Math.max(peak, Math.abs(wave[i]));
    }
    meter.peak = Math.max(meter.peak, peak);
    const rms = Math.sqrt(sum / wave.length);
    analyser.getByteFrequencyData(bins as Uint8Array<ArrayBuffer>);
    // The bins below about 400 Hz (the trumpet's low notes).
    const top = Math.max(
      1,
      Math.round((400 / (ctx.sampleRate / 2)) * bins.length),
    );
    let low = 0;
    for (let i = 1; i <= top; i += 1) low = Math.max(low, bins[i] / 255);
    const level = Math.min(1, rms * 4);
    const lowNow = Math.max(0, (low - 0.55) / 0.45);
    const fall = Math.exp(-dt / (RELEASE / 3));
    out.level = level > out.level ? level : out.level * fall;
    out.low = lowNow > out.low ? lowNow : out.low * fall;
    return out;
  },

  /** The levels as last measured (by the studio, once a frame). */
  get last() {
    return out;
  },

  meter,

  /** Sets up the sound (no sound yet). */
  preload() {
    if (ctx) return;
    ctx = makeContext();
  },

  /** Start: the browser lets the sound play from here on. */
  unlock() {
    if (!ctx) this.preload();
    if (!ctx) return;
    // Play through the phone's silent switch, like a music app.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    try {
      if (nav.audioSession) nav.audioSession.type = "playback";
    } catch {
      // not supported
    }
    if (ctx.state !== "running") void ctx.resume();
    unlocked = true;
    meter.unlocked = true;
  },

  get unlocked() {
    return unlocked;
  },

  /** A note now, `length` s long. */
  note(midi: number, velocity: number, length: number) {
    if (!ctx) return;
    this.noteAt(midi, velocity, ctx.currentTime + LEAD, length);
  },

  /** A note at an exact time on the audio clock (s), for the beat. */
  noteAt(midi: number, velocity: number, at: number, length: number) {
    const v = voice();
    if (!ctx || !v || !unlocked) return;
    v.note(midi, velocity, Math.max(at, ctx.currentTime), length);
    meter.count += 1;
    log(`note ${midi} ${length.toFixed(2)}`);
  },

  /** The note stops at `at` (audio clock; now if left out). */
  stopAt(at?: number) {
    if (!ctx) return;
    const t = Math.max(at ?? ctx.currentTime, ctx.currentTime);
    synth?.stop(t);
    recorded?.stop(t);
    log("stop");
  },

  /** The audio clock now (s), or null before the sound is set up. */
  get now() {
    return ctx && unlocked ? ctx.currentTime : null;
  },

  /** Plays the recordings (true) or the voice made in code (false). */
  useRecordings(on: boolean) {
    useRecorded = on;
  },

  /** Which voice plays now. */
  get voiceKind() {
    return voice() === recorded && recorded ? "recorded" : "synth";
  },
};
