// Songs: learning and playing along (session.ts, songs.ts).
//
// While a song runs it sets its own octave, tempo and beat (your choices come
// back when it ends), and the free beat waits.
//
//   Learn  waits for each note: the chip to show glows gold, your camera's tag
//          shows the sign, and the gold hand rests on its valves. Hold the
//          sign a moment and the trumpet plays the note; a wrong sign held a
//          while brings a hint.
//   Play   keeps time after a bar of count-in clicks, with a soft pad and bass
//          under it: on each note's time the trumpet plays the note your sign
//          shows. Notes in time give 1 to 3 stars.
// Esc, or the dock's stop button, ends the song and free play carries on.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";

import { sound } from "./audio";
import { makeBacking, type Backing } from "./backing";
import { START_DELAY } from "./beat";
import { noteMidi, type NoteId } from "./notes";
import { COUNT_IN_BARS, Session, type Mode } from "./session";
import { songById } from "./songs";
import { show, trumpet } from "./state";

/** Play's slower speed. */
export const SLOW = 0.75;
/** Notes, chords and clicks are handed to the audio clock this far ahead (s). */
const AHEAD = 0.1;
/** How hard the song's notes are tongued: the first of a bar, and the rest. */
const TONGUE = { downbeat: 0.85, other: 0.7 };
/** A note sounds this share of its length (a breath between notes). */
const LEGATO = 0.9;
/** Learn: a counted note sounds at most this long (s). */
const LEARN_NOTE = 1.0;

/** Each song's best stars this visit (Play only). */
const BEST_KEY = "trumpet.best";
export const bestStars = (): Record<string, number> => {
  try {
    return JSON.parse(
      window.sessionStorage.getItem(BEST_KEY) ?? "{}",
    ) as Record<string, number>;
  } catch {
    return {};
  }
};
const saveBest = (id: string, stars: number) => {
  try {
    const best = bestStars();
    if ((best[id] ?? 0) >= stars) return;
    best[id] = stars;
    window.sessionStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // private mode: not remembered
  }
};

/** Your octave, beat and tempo, kept while a song uses its own. */
let saved: Pick<typeof trumpet, "octave" | "pattern" | "bpm"> | null = null;

const restore = () => {
  if (!saved) return;
  trumpet.octave = saved.octave;
  trumpet.pattern = saved.pattern;
  trumpet.bpm = saved.bpm;
  saved = null;
};

/** Starts a song (from a tap: it also starts the sound). */
export const startSong = (id: string, mode: Mode) => {
  const song = songById(id);
  sound.unlock();
  const { now } = sound;
  if (!song || now === null) return;
  if (!saved)
    saved = {
      octave: trumpet.octave,
      pattern: trumpet.pattern,
      bpm: trumpet.bpm,
    };
  trumpet.octave = song.octave;
  trumpet.pattern = song.pattern;
  trumpet.bpm = song.bpm;
  trumpet.autoPlay = false;
  // The song's first bar (the count-in in Play) starts a moment from now.
  trumpet.session = new Session(
    song,
    mode,
    trumpet.slow ? SLOW : 1,
    now + START_DELAY,
  );
  trumpet.songCard = false;
  trumpet.beatCard = false;
  trumpet.howTo = false;
  trumpet.howToUntil = null;
  trumpet.finish = null;
  trumpet.changed();
};

/** Ends the song (free play carries on, with your own choices). */
export const stopSong = () => {
  trumpet.session = null;
  trumpet.target = null;
  restore();
  trumpet.changed();
};

/** The finish card goes (or a new song starts). */
export const closeFinish = () => {
  trumpet.finish = null;
  trumpet.changed();
};

type Shown = {
  due: number;
  note: NoteId;
  midi: number;
  strength: number;
  length: number;
  downbeat: boolean;
};

export const SongPlayer = () => {
  // Esc ends the song, or closes the songs card or the finish card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (trumpet.session) stopSong();
      else if (trumpet.songCard || trumpet.finish) {
        trumpet.songCard = false;
        trumpet.finish = null;
        trumpet.changed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => () => stopSong(), []);

  const st = useRef({
    session: null as Session | null,
    backing: null as Backing | null,
    /** Play: the next note, chord and count-in click to hand to the audio clock. */
    note: 0,
    chord: 0,
    chordBeat: 0,
    click: 0,
    pending: [] as Shown[],
  });

  useFrame(() => {
    const p = st.current;
    const s = trumpet.session;
    const { now } = sound;
    const perf = performance.now() / 1000;
    if (s !== p.session) {
      if (p.backing && now !== null) p.backing.cut(now);
      p.session = s;
      p.note = 0;
      p.chord = 0;
      p.chordBeat = 0;
      p.click = 0;
      p.pending = [];
    }
    if (!p.backing) {
      const a = sound.audio();
      if (a) p.backing = makeBacking(a.ctx, a.master);
    }
    // Notes show (valves, bell, rings) when they sound.
    while (p.pending.length && p.pending[0].due <= perf) {
      const x = p.pending.shift()!;
      show(x.note, x.midi, x.strength, x.length, x.downbeat, "keys");
    }
    if (!s || now === null) return;
    s.update(now, trumpet.choice);
    const { song } = s;
    const spb = s.secondsPerBeat;
    const bpb = song.beatsPerBar;

    if (s.mode === "play") {
      // A bar of count-in clicks.
      const count = COUNT_IN_BARS * bpb;
      while (p.click < count) {
        const at = s.timeOf(p.click - count);
        if (at > now + AHEAD) break;
        p.backing?.click(Math.max(now, at), p.click === 0);
        p.click += 1;
      }
      // The backing's chords.
      while (p.chord < song.chords.length) {
        const [chord, beats] = song.chords[p.chord];
        const at = s.timeOf(p.chordBeat);
        if (at > now + AHEAD) break;
        if (chord) p.backing?.chord(chord, Math.max(now, at), beats * spb);
        p.chordBeat += beats;
        p.chord += 1;
      }
      // Each note on its time: the note your sign shows (a rest: silence).
      while (p.note < s.starts.length) {
        const at = s.timeOf(s.starts[p.note]);
        if (at > now + AHEAD) break;
        const step = song.steps[p.note];
        const downbeat = s.starts[p.note] % bpb === 0;
        const { choice } = trumpet;
        if (choice !== "rest") {
          const midi = noteMidi(choice, trumpet.octave);
          const strength = downbeat ? TONGUE.downbeat : TONGUE.other;
          const length = step.beats * spb * LEGATO;
          sound.noteAt(midi, strength, Math.max(now, at), length);
          p.pending.push({
            due: perf + (at - now),
            note: choice,
            midi,
            strength,
            length,
            downbeat,
          });
        }
        p.note += 1;
      }
    }

    // Right notes sparkle (Learn: the trumpet plays it); wrong signs hint.
    const t = performance.now();
    s.events.forEach((e) => {
      if (e.kind === "good" || e.kind === "perfect") {
        trumpet.fx.goodAt = t;
        trumpet.fx.goodSeq += 1;
        trumpet.fx.perfect = e.kind === "perfect";
        if (s.mode === "learn") {
          const step = song.steps[e.index];
          const midi = noteMidi(step.note, trumpet.octave);
          const length = Math.min(LEARN_NOTE, step.beats * spb * LEGATO);
          sound.note(midi, TONGUE.other, length);
          show(step.note, midi, TONGUE.other, length, false, "keys");
        }
      } else if (e.kind === "hint") {
        trumpet.fx.hintAt = t;
        trumpet.fx.hintSeq += 1;
      }
    });
    let dirty = s.events.length > 0;
    s.events = [];

    // The note to show next.
    const i = s.mode === "learn" ? s.next : s.current(now);
    const target = song.steps[i]?.note ?? null;
    if (target !== trumpet.target) {
      trumpet.target = target;
      dirty = true;
    }

    if (s.done) {
      const stars = s.mode === "play" ? s.stars : 3;
      if (s.mode === "play") saveBest(song.id, stars);
      p.backing?.chime(now + 0.05);
      trumpet.finish = { id: song.id, mode: s.mode, stars, at: t };
      trumpet.session = null;
      trumpet.target = null;
      restore();
      dirty = true;
    }
    if (dirty) trumpet.changed();
  });

  return null;
};
