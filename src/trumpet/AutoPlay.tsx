// The trumpet plays by itself: while your hand is in view (or Play is on), it
// plays the chosen note in the chosen pattern, in time (beat.ts). A new sign
// (or chip, or key) changes the note on the next beat, even under a held note
// (it is tongued again on the new note); the rest silences it on the next
// beat while the beat goes on. Taking the hand away for half a second stops
// the beat after the current beat, and the last note finishes (a held Long
// note ends with the beat); bringing it back starts a new bar.
//
// Each note is handed to the audio clock about 0.1 s ahead, so the time stays
// steady whatever the frame rate; the valves, the bell, the rings and the
// lights show it when it sounds.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

import { sound } from "./audio";
import { BeatScheduler } from "./beat";
import { hands } from "./Hands";
import { noteMidi, type Choice, type NoteId } from "./notes";
import { show, silence, trumpet, type PlaySource } from "./state";

/** Notes are handed to the audio clock this far ahead (s). */
const AHEAD = 0.1;
/** The hand out of view this long (s) stops the beat. */
const LOST = 0.5;
/** A change of note under a held note is tongued this hard. */
const CHANGE_STRENGTH = 0.6;
/** A held note must last at least this long past a beat (s) to change on it. */
const MIN_LEFT = 0.06;

type Shown =
  | {
      kind: "note";
      due: number;
      note: NoteId;
      midi: number;
      strength: number;
      length: number;
      downbeat: boolean;
      by: PlaySource;
    }
  | { kind: "silence"; due: number };

export const AutoPlay = () => {
  const beat = useMemo(() => new BeatScheduler<Choice>(), []);
  const st = useRef({
    pending: [] as Shown[],
    beats: [] as Array<{ due: number; downbeat: boolean }>,
    pattern: trumpet.pattern,
    bpm: trumpet.bpm,
    /** The note sounding (audio clock): what, and until when. */
    sounding: null as { value: NoteId; until: number } | null,
  });

  useFrame(() => {
    const s = st.current;
    const perf = performance.now() / 1000;
    const { now } = sound;
    const want =
      trumpet.entered && (trumpet.autoPlay || perf - hands.seenAt <= LOST);

    if (now !== null) {
      if (s.pattern !== trumpet.pattern || s.bpm !== trumpet.bpm) {
        s.pattern = trumpet.pattern;
        s.bpm = trumpet.bpm;
        beat.pattern = trumpet.pattern;
        beat.bpm = trumpet.bpm;
        beat.retime(now);
      }
      if (want) beat.start(now);
      else beat.stop(now);
      const due = beat.next(now, AHEAD, trumpet.choice);
      const len = beat.beatLength;
      // (played by your hand closes the how-to card)
      const by: PlaySource = trumpet.autoPlay ? "pointer" : "hands";
      const toPerf = (t: number) => perf + (t - now);
      // Notes and beats in time order; a note on a beat is that beat's.
      const onBeat = new Set(due.hits.map((h) => h.time.toFixed(4)));
      const steps = [
        ...due.hits.map((h) => ({ time: h.time, hit: h })),
        ...due.beats
          .filter((b) => !onBeat.has(b.time.toFixed(4)))
          .map((b) => ({ time: b.time, change: b })),
      ].sort((a, b) => a.time - b.time);
      steps.forEach((step) => {
        if ("hit" in step && step.hit) {
          const h = step.hit;
          if (h.value === "rest") {
            if (s.sounding && s.sounding.until > h.time) {
              sound.stopAt(h.time);
              s.pending.push({ kind: "silence", due: toPerf(h.time) });
            }
            s.sounding = null;
            return;
          }
          const length = h.hit.length * len;
          const midi = noteMidi(h.value, trumpet.octave);
          sound.noteAt(midi, h.hit.strength, h.time, length);
          s.sounding = { value: h.value, until: h.time + length };
          s.pending.push({
            kind: "note",
            due: toPerf(h.time),
            note: h.value,
            midi,
            strength: h.hit.strength,
            length,
            downbeat: h.downbeat,
            by,
          });
          return;
        }
        if (!("change" in step) || !step.change) return;
        // A beat under a held note: a new note is tongued, the rest silences it.
        const b = step.change;
        const held = s.sounding;
        if (!held || held.until - b.time < MIN_LEFT || b.value === held.value)
          return;
        if (b.value === "rest") {
          sound.stopAt(b.time);
          s.pending.push({ kind: "silence", due: toPerf(b.time) });
          s.sounding = null;
          return;
        }
        const length = held.until - b.time;
        const midi = noteMidi(b.value, trumpet.octave);
        sound.noteAt(midi, CHANGE_STRENGTH, b.time, length);
        s.sounding = { value: b.value, until: held.until };
        s.pending.push({
          kind: "note",
          due: toPerf(b.time),
          note: b.value,
          midi,
          strength: CHANGE_STRENGTH,
          length,
          downbeat: false,
          by,
        });
      });
      due.beats.forEach((b) =>
        s.beats.push({ due: toPerf(b.time), downbeat: b.downbeat }),
      );
      // The beat has stopped: the last note finishes, but a note held past
      // the next beat (Long) stops with the beat.
      if (
        !beat.running &&
        s.sounding &&
        s.sounding.until > now + beat.beatLength
      ) {
        sound.stopAt(now);
        s.pending.push({ kind: "silence", due: perf });
        s.sounding = null;
      }
    }

    // Each note shows (and each beat lights) when it sounds.
    while (s.pending.length && s.pending[0].due <= perf) {
      const p = s.pending.shift()!;
      if (p.kind === "silence") silence();
      else show(p.note, p.midi, p.strength, p.length, p.downbeat, p.by);
    }
    while (s.beats.length && s.beats[0].due <= perf) {
      const b = s.beats.shift()!;
      trumpet.beatAt = b.due;
      trumpet.beatDownbeat = b.downbeat;
      if (b.downbeat) trumpet.downbeats += 1;
    }
    const beating = beat.running;
    if (beating !== trumpet.beating) {
      trumpet.beating = beating;
      trumpet.changed();
    }
  });

  return null;
};
