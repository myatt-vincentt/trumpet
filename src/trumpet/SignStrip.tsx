// The sign strip: eight small glass chips in a row above the dock, one per
// sign, as you see your right hand held up to the camera: one to four
// fingers for Do, Re, Mi and Fa, an open hand for Sol, the rock sign (index
// and pinky up) for La, thumb and pinky out for Ti, and a fist to rest. The
// chosen chip lights gold; it flashes on every note. In a song, the chip of
// the note to play next glows gold. Tap a chip to choose it.
import { useEffect, useRef } from "react";

import {
  CHOICES,
  label,
  LETTER,
  signOf,
  type Choice,
  type Sign,
} from "./notes";
import { GHOST_COLOR } from "./GhostHand";
import { choose, trumpet, useTrumpetVersion } from "./state";

/** A note's flash on the chip fades away at this rate (1/s). */
const GLOW_RATE = 5;

export const STRIP_CSS = `
.vl-strip { position: absolute; left: 50%; transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 0px) + var(--vl-strip-bottom));
  display: flex; gap: 4px; pointer-events: auto;
  --chip: min(46px, calc((100vw - 32px - 28px) / 8));
  animation: vl-fade 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.vl-chip { position: relative; width: var(--chip); height: calc(var(--chip) + 12px); border-radius: 12px;
  padding: 0; margin: 0; color: #fff; cursor: pointer; overflow: hidden; outline: none; touch-action: none;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
  background: rgb(35 37 40 / .64); border: 1px solid rgb(235 246 253 / .18);
  backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5);
  box-shadow: inset 0 1px 1px rgb(255 255 255 / .22), 0 8px 24px rgb(0 0 0 / .22);
  -webkit-touch-callout: none;
  transition: background 220ms cubic-bezier(0.22, 1, 0.36, 1), border-color 220ms cubic-bezier(0.22, 1, 0.36, 1); }
.vl-chip:focus-visible { box-shadow: 0 0 0 2px ${GHOST_COLOR}; }
.vl-chip.on { background: rgb(242 178 28 / .42); border-color: rgb(255 214 120 / .75); }
.vl-chip.target::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  box-shadow: inset 0 0 0 2px ${GHOST_COLOR}, 0 0 14px rgb(242 178 28 / .6); animation: vl-target 1100ms ease-out infinite; }
@keyframes vl-target { from { opacity: 1; } to { opacity: .3; } }
@media (prefers-reduced-motion: reduce) { .vl-chip.target::after { animation: none; } }
.vl-chip-glow { position: absolute; inset: 0; opacity: 0; pointer-events: none; background: #fff6dc; }
.vl-chip svg { position: relative; }
.vl-chip-num { position: relative; font: 650 10px/1 system-ui, -apple-system, sans-serif; color: rgb(255 255 255 / .7); }
.vl-chip.on .vl-chip-num { color: #fff; }
.vl-chip-sub { position: relative; font: 600 8px/1 system-ui, -apple-system, sans-serif; color: rgb(255 255 255 / .5); }
`;

/** Which fingers are up in each sign: thumb, index, middle, ring, pinky. */
const UP: Record<Sign, boolean[]> = {
  fist: [false, false, false, false, false],
  one: [false, true, false, false, false],
  two: [false, true, true, false, false],
  three: [false, true, true, true, false],
  four: [false, true, true, true, true],
  open: [true, true, true, true, true],
  rock: [false, true, false, false, true],
  call: [true, false, false, false, true],
};
/** The fingers' bases and how tall each stands (24 grid). */
const FINGER = [
  { x: 9, top: 4.5 },
  { x: 12, top: 3 },
  { x: 15, top: 4 },
  { x: 17.6, top: 6.5 },
];

/** A sign drawn as a hand held up, palm to you (thumb on the left, as in a mirror). */
export const SignIcon = ({
  sign,
  size = 24,
}: {
  sign: Sign;
  size?: number;
}) => {
  const up = UP[sign];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* the palm */}
      <path d="M7.5 12v4.2a5 5 0 0 0 5 5h.6a5 5 0 0 0 5-5V12" />
      <path
        d="M7.5 12.5c0-1 .4-1.8 1.2-1.8h8.2c.8 0 1.2.8 1.2 1.8"
        opacity=".55"
      />
      {/* the fingers: up, or folded down over the palm */}
      {FINGER.map((f, i) =>
        up[i + 1] ? (
          <path key={f.x} d={`M${f.x} 11.5V${f.top}`} />
        ) : (
          <path key={f.x} d={`M${f.x} 11.2v1.6`} opacity=".9" />
        ),
      )}
      {/* the thumb: out to the side, or across the palm */}
      {up[0] ? (
        <path d="M7.5 15.5L4.2 11.6" />
      ) : (
        <path d="M7.6 15.4c1.3-.4 2.8-.9 4-1.9" opacity=".9" />
      )}
    </svg>
  );
};

type ChipRef = { id: string; glow: HTMLSpanElement | null; k: number };

type Chip = {
  id: string;
  choice: Choice;
  sign: Sign;
  label: string;
  sub?: string;
};

/** The chips: the seven notes (with their letters), then the rest. */
const CHIPS: Chip[] = CHOICES.map((c) => ({
  id: String(c),
  choice: c,
  sign: signOf(c),
  label: label(c),
  sub: c === "rest" ? undefined : LETTER[c],
}));

export const SignStrip = () => {
  useTrumpetVersion();
  const chips = useRef<ChipRef[]>([]);

  // Each note flashes the chosen chip, fading away.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let seen = trumpet.seq;
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      const fresh = trumpet.seq !== seen;
      seen = trumpet.seq;
      const chosen = String(trumpet.choice);
      chips.current.forEach((c) => {
        /* eslint-disable no-param-reassign */
        if (fresh && chosen === c.id) c.k = 0.7;
        else c.k *= Math.exp(-GLOW_RATE * dt);
        if (c.glow) c.glow.style.opacity = c.k.toFixed(3);
        /* eslint-enable no-param-reassign */
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const chosen = String(trumpet.choice);
  const list = CHIPS;
  chips.current.length = list.length;
  return (
    <div className="vl-strip" data-hud="strip" aria-label="Note signs">
      {list.map((chip, i) => {
        const prev = chips.current[i];
        const ref: ChipRef =
          prev && prev.id === chip.id
            ? prev
            : { id: chip.id, glow: null, k: 0 };
        chips.current[i] = ref;
        const on = chosen === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            className={`vl-chip ${on ? "on" : ""} ${trumpet.target !== null && trumpet.target === chip.choice ? "target" : ""}`}
            data-hud={`sign-${chip.sign}`}
            aria-label={`${chip.label}${chip.sub ? ` (${chip.sub})` : ""}: ${chip.sign} sign`}
            aria-pressed={on}
            onClick={() => choose(chip.choice, "pointer")}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span
              className="vl-chip-glow"
              ref={(el) => {
                ref.glow = el;
              }}
            />
            <SignIcon sign={chip.sign} />
            <span className="vl-chip-num">{chip.label}</span>
            {chip.sub ? <span className="vl-chip-sub">{chip.sub}</span> : null}
          </button>
        );
      })}
    </div>
  );
};
