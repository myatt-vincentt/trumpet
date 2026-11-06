// Development only: window.__trumpet, a look inside for testing without a
// camera — the state, the sound meter, and controls:
//
//   __trumpet.choose(4)            choose a note (0 Do … 6 Ti, "rest" rests)
//   __trumpet.play(true)           start (or stop) the beat
//   __trumpet.note(4, 0.8, 0.5)    one note now: Do … Ti, how hard, how long (s)
//   __trumpet.pattern("swing"), __trumpet.bpm(120), __trumpet.octave("high")
//   __trumpet.view("player"), __trumpet.night(true)
//   __trumpet.look([x, y, z], [tx, ty, tz], fov)   a fixed camera (null: back)
//   __trumpet.useRecordings(false)  the voice made in code
//
// With ?debug in the address, a small readout in the top-left corner shows
// the note, the beat and the sound.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";

import { meter, samples, sound } from "./audio";
import { TEMPO, type PatternId } from "./beat";
import { cameraOverride } from "./CameraRig";
import type { View } from "./layout";
import { noteMidi, type Choice, type NoteId, type Octave } from "./notes";
import {
  choose,
  setNight,
  setOctave,
  setPattern,
  setView,
  show,
  trumpet,
} from "./state";
import { rig } from "./Trumpet";

/** The ?debug readout: a plain text box, refreshed a few times a second. */
const useReadout = () => {
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug"))
      return undefined;
    const box = document.createElement("pre");
    Object.assign(box.style, {
      position: "fixed",
      left: "8px",
      top: "8px",
      zIndex: "60",
      margin: "0",
      padding: "8px 10px",
      borderRadius: "10px",
      background: "rgb(0 0 0 / .7)",
      color: "#fff",
      font: "11px/1.4 ui-monospace, monospace",
      pointerEvents: "none",
    });
    document.body.appendChild(box);
    const yes = (b: boolean) => (b ? "yes" : "no");
    const t = window.setInterval(() => {
      const ago = performance.now() / 1000 - trumpet.beatAt;
      box.textContent = [
        `note ${trumpet.choice}  octave ${trumpet.octave}  sounding ${trumpet.sounding ?? "-"}`,
        `beat ${trumpet.beating ? "running" : "stopped"} ${trumpet.pattern} ${trumpet.bpm} BPM  play ${yes(trumpet.autoPlay)}  last beat ${ago < 60 ? `${ago.toFixed(1)} s ago` : "-"}`,
        `valves ${rig.press.map((p) => p.toFixed(2)).join(" ")}`,
        `sound ${sound.unlocked ? "on" : "off"} ${sound.voiceKind}  notes ${meter.count}  peak ${meter.peak.toFixed(2)}`,
      ].join("\n");
    }, 200);
    return () => {
      window.clearInterval(t);
      box.remove();
    };
  }, []);
};

const DevDebug = () => {
  useReadout();
  const camera = useThree((st) => st.camera);
  const scene = useThree((st) => st.scene);
  useEffect(() => {
    const api = {
      trumpet,
      rig,
      camera,
      scene,
      meter,
      sound,
      samples,
      /** The output's level and low end right now. */
      levels: () => ({ ...sound.last }),
      choose: (c: Choice) => choose(c, "pointer"),
      play: (on = true) => {
        sound.unlock();
        trumpet.autoPlay = on;
        trumpet.changed();
      },
      note: (n: NoteId, strength = 0.7, length = 0.5) => {
        sound.unlock();
        const midi = noteMidi(n, trumpet.octave);
        sound.note(midi, strength, length);
        show(n, midi, strength, length, false, "pointer");
      },
      pattern: (p: PatternId) => setPattern(p),
      bpm: (b: number) => {
        trumpet.bpm = Math.min(TEMPO.most, Math.max(TEMPO.least, b));
        trumpet.changed();
      },
      octave: (o: Octave) => setOctave(o),
      useRecordings: (on: boolean) => sound.useRecordings(on),
      view: (v: View) => setView(v),
      night: (on: boolean) => setNight(on),
      look(pos: number[] | null, target: number[] = [0, 1.3, 0], fov = 40) {
        cameraOverride.pose = pos
          ? { pos: new Vector3(...pos), target: new Vector3(...target), fov }
          : null;
      },
    };
    (window as unknown as { __trumpet?: typeof api }).__trumpet = api;
    return () => {
      delete (window as unknown as { __trumpet?: typeof api }).__trumpet;
    };
  }, [camera, scene]);
  return null;
};

export default DevDebug;
