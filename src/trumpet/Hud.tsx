// The page UI, minimal, on Night glass:
//   - your camera, top right (CameraFrame.tsx): tap it to tuck it away; a
//     small camera button then sits in the corner to bring it back
//   - one floating dock, bottom centre, icons only: play / stop the beat, the
//     beat (pattern and tempo), the octave, the view (front, player, close),
//     day / night, and how to play. A small label shows over a button on
//     hover, or for a moment after a tap.
//   - the sign strip just above the dock (SignStrip.tsx)
//   - the how-to-play steps: your right hand and the eight signs (after
//     Start, or from the dock)
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useXRReady } from "@vincentt-xr/sdk/low-level";

import { PATTERN, PATTERNS, TEMPO, type PatternId } from "./beat";
import { GHOST_COLOR } from "./GhostHand";
import {
  DOCK_BOTTOM,
  DOCK_HEIGHT,
  frameRect,
  GUTTER,
  pinToScreen,
  STRIP_GAP,
  type View,
} from "./layout";
import { CHOICES, label, signOf } from "./notes";
import { SignIcon, SignStrip, STRIP_CSS } from "./SignStrip";
import {
  closeHowTo,
  INTRO_CARD_MS,
  nextView,
  nudgeTempo,
  setNight,
  setOctave,
  setPattern,
  toggleAutoPlay,
  toggleCam,
  trumpet,
  useTrumpetVersion,
} from "./state";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const ACCENT = "#f4d968";
/** After a tap the label stays this long (ms). */
const TAP_LABEL = 1000;

const CSS = `
.vl-root { --vl-strip-bottom: ${DOCK_BOTTOM + DOCK_HEIGHT + STRIP_GAP}px; position: absolute; inset: 0; pointer-events: none; color: #fff;
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.vl-glass { background: rgb(35 37 40 / .64);
  backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border: 1px solid rgb(235 246 253 / .18);
  box-shadow: inset 0 1px 1px rgb(255 255 255 / .22), 0 8px 24px rgb(0 0 0 / .22); }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .vl-glass { background: rgb(35 37 40 / .82); } }
.vl-dock { position: absolute; left: 50%; transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 0px) + ${DOCK_BOTTOM}px);
  display: flex; gap: 6px; padding: 6px; border-radius: 999px; pointer-events: auto; }
.vl-btn { pointer-events: auto; border: 0; padding: 0; margin: 0; color: inherit; position: relative;
  display: grid; place-items: center; cursor: pointer; outline: none; touch-action: manipulation;
  width: 44px; height: 44px; border-radius: 50%; background: transparent;
  transition: transform 160ms ease-out, background 200ms ${EASE}; }
.vl-btn:hover { background: rgb(255 255 255 / .08); }
.vl-btn:active { transform: scale(0.94); }
.vl-btn:focus-visible { box-shadow: 0 0 0 2px ${ACCENT}; }
.vl-btn.on { color: ${ACCENT}; background: rgb(244 217 104 / .14); }
.vl-btn .vl-mark { position: absolute; bottom: 3px; right: 3px; width: 15px; height: 15px;
  border-radius: 50%; background: ${ACCENT}; color: #232528; display: grid; place-items: center;
  font: 700 9px/1 system-ui, -apple-system, sans-serif; }
.vl-tip { position: absolute; bottom: calc(100% + 12px); left: 50%; transform: translate(-50%, 4px);
  padding: 6px 10px; border-radius: 10px; white-space: nowrap; opacity: 0; pointer-events: none;
  font: 600 12px/1 system-ui, -apple-system, sans-serif;
  transition: opacity 220ms ${EASE}, transform 220ms ${EASE}; }
.vl-tip.show { opacity: 1; transform: translate(-50%, 0); }
@media (hover: hover) { .vl-btn:hover .vl-tip { opacity: 1; transform: translate(-50%, 0); } }
.vl-cam { position: absolute; pointer-events: auto; border: 0; padding: 0; margin: 0;
  background: transparent; cursor: pointer; border-radius: 16px; outline: none; }
.vl-cam:focus-visible { box-shadow: 0 0 0 2px ${ACCENT}; }
.vl-show { position: absolute; right: ${GUTTER}px; top: ${GUTTER}px; }
.vl-nocam { position: absolute; display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  border-radius: 16px; font: 600 12px/1.35 system-ui, -apple-system, sans-serif; color: rgb(255 255 255 / .9);
  animation: vl-fade 260ms ${EASE} both; }
.vl-nocam svg { flex: none; color: rgb(255 255 255 / .7); }
.vl-gone { opacity: 0; pointer-events: none; }
.vl-howto-back { position: absolute; inset: 0; pointer-events: auto; background: rgb(10 10 14 / .25);
  animation: vl-fade 260ms ${EASE} both; }
@keyframes vl-fade { from { opacity: 0; } to { opacity: 1; } }
.vl-howto { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  padding: 16px 18px; border-radius: 22px; display: flex; flex-direction: column; gap: 12px;
  width: min(360px, calc(100% - 32px)); animation: vl-pop2 360ms ${EASE} both; }
@keyframes vl-pop2 { from { opacity: 0; transform: translate(-50%, -46%) scale(.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
.vl-step { display: flex; align-items: center; gap: 14px; font: 600 15px/1.25 system-ui, -apple-system, sans-serif; }
.vl-step .vl-pic { flex: none; width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center;
  background: rgb(255 255 255 / .08); color: #fff; }
.vl-signs { display: flex; justify-content: space-between; margin: 8px 0 0 66px; color: ${GHOST_COLOR}; }
.vl-sign { display: flex; flex-direction: column; align-items: center; gap: 2px;
  font: 600 9px/1 system-ui, -apple-system, sans-serif; color: rgb(255 255 255 / .7); }
.vl-sign svg { color: ${GHOST_COLOR}; }
.vl-step .vl-num { color: ${ACCENT}; font-weight: 700; margin-right: 2px; }
.vl-count { position: absolute; left: 22px; right: 22px; bottom: -1px; height: 2px; border-radius: 2px;
  background: rgb(255 255 255 / .12); overflow: hidden; }
.vl-count > div { height: 100%; background: ${ACCENT}; transform-origin: 0 50%;
  animation: vl-count var(--vl-count) linear both; }
@keyframes vl-count { from { transform: scaleX(1); } to { transform: scaleX(0); } }
.vl-leave, .vl-leave .vl-howto { animation: vl-out 320ms ${EASE} both; pointer-events: none; }
@keyframes vl-out { to { opacity: 0; } }
.vl-dock.pulse::after { content: ""; position: absolute; inset: -1px; border-radius: inherit; pointer-events: none;
  animation: vl-pulse 1500ms ${EASE} both; }
@keyframes vl-pulse { from { box-shadow: 0 0 0 0 rgb(244 217 104 / .6); }
  to { box-shadow: 0 0 0 22px rgb(244 217 104 / 0); } }
.gt-beat { position: absolute; left: 50%; transform: translateX(-50%); pointer-events: auto;
  bottom: calc(env(safe-area-inset-bottom, 0px) + var(--vl-strip-bottom) + 84px);
  padding: 10px; border-radius: 18px; display: flex; flex-direction: column; gap: 8px; align-items: center;
  animation: vl-fade 220ms ${EASE} both; }
.gt-beat-row { display: flex; gap: 6px; }
.gt-chip { pointer-events: auto; border: 0; margin: 0; cursor: pointer; color: #fff; min-width: 40px; height: 34px;
  padding: 0 10px; border-radius: 999px; background: rgb(255 255 255 / .08); outline: none;
  font: 650 13px/1 system-ui, -apple-system, sans-serif; transition: background 200ms ${EASE}; }
.gt-chip:hover { background: rgb(255 255 255 / .14); }
.gt-chip.on { background: rgb(244 217 104 / .22); color: ${ACCENT}; }
.gt-chip:disabled { opacity: .35; cursor: default; }
.gt-chip:focus-visible { box-shadow: 0 0 0 2px ${ACCENT}; }
.gt-tempo { align-items: center; }
.gt-bpm { min-width: 70px; text-align: center; font: 650 15px/1 system-ui, -apple-system, sans-serif; }
.gt-bpm small { font-size: 10px; opacity: .6; }
@media (prefers-reduced-motion: reduce) { .vl-howto, .vl-howto-back, .vl-dock.pulse::after { animation: none; } }
`;
const Icon = ({
  children,
  size = 20,
}: {
  children: ReactNode;
  size?: number;
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const CameraIcon = () => (
  <Icon>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);
/** A camera, crossed out. */
const NoCameraIcon = () => (
  <Icon size={18}>
    <path d="M2.5 2.5l19 19" />
    <path d="M9 6h6.5L17 8h3a1 1 0 0 1 1 1v8.5M18 19H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h3" />
    <path d="M10 10.6a3.5 3.5 0 0 0 4.4 4.4" />
  </Icon>
);
const HelpIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6" />
    <circle cx="12" cy="17" r=".6" fill="currentColor" />
  </Icon>
);
const ViewIcon = () => (
  <Icon>
    <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Icon>
);
const MoonIcon = () => (
  <Icon>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </Icon>
);

// ---------------------------------------------------------------- how to play

/** A step picture: a 24 grid drawn large, with a lighter line. */
const Pic = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width={40}
    height={40}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

/** Two open hands up inside the camera frame. */
const PicHands = () => (
  <Pic>
    <rect x="1.5" y="3.5" width="21" height="17" rx="3" opacity=".5" />
    {[false, true].map((flip) => (
      <path
        key={String(flip)}
        transform={flip ? "translate(24 0) scale(-1 1)" : undefined}
        d="M10.5 17.5H8.2a2.2 2.2 0 0 1-2-1.3L4.6 13a.9.9 0 0 1 1.5-.9l1.2 1.3V8.3a.8.8 0 0 1 1.6 0v3V7a.8.8 0 0 1 1.6 0v4.3"
      />
    ))}
    <path
      d="M10.5 17.5v-6.2a.8.8 0 0 1 1.5 0M13.5 17.5v-6.2a.8.8 0 0 0-1.5 0"
      opacity=".9"
    />
  </Pic>
);
/** A hand leaving the camera frame: stop. */
const PicAway = () => (
  <Pic>
    <rect x="1.5" y="3.5" width="14" height="17" rx="3" opacity=".5" />
    <path d="M13 17.5v-6.2a1 1 0 0 1 2 0V6a1 1 0 0 1 2 0v4.5V5a1 1 0 0 1 2 0v6" />
    <path d="M21 12.5l1.5-1.5M21 12.5l1.5 1.5" opacity=".7" />
  </Pic>
);
/** Beats in a bar, the first one larger: the pattern. */
const PicPattern = () => (
  <Pic>
    <circle cx="4.5" cy="12" r="2.2" fill="currentColor" />
    <circle cx="10" cy="12" r="1.4" />
    <circle cx="15" cy="12" r="1.4" />
    <circle cx="20" cy="12" r="1.4" />
  </Pic>
);
const PlayIcon = () => (
  <Icon>
    <path d="M8 5.5v13l10.5-6.5Z" />
  </Icon>
);
const PauseIcon = () => (
  <Icon>
    <path d="M8.5 5.5v13M15.5 5.5v13" />
  </Icon>
);
/** A fist: the strings stop. */
const PicFist = () => (
  <Pic>
    <path d="M7 10.5V9a1.5 1.5 0 0 1 3 0v-.5a1.5 1.5 0 0 1 3 0V9a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a5 5 0 0 1-5-5v-4.5Z" />
    <path d="M7 13.5c1.6 0 3.2-.6 4.3-1.7" />
    <path d="M3 4l3 2M21 4l-3 2" opacity=".6" />
  </Pic>
);
/** A finger tapping a chip on the screen, or a computer key. */
const PicTouch = () => (
  <Pic>
    <rect x="7" y="13" width="10" height="8" rx="2.5" opacity=".6" />
    <path d="M12 3v7.5M10 8.5l2 2 2-2" />
    <path d="M4 17h1.5M18.5 17H20" opacity=".5" />
  </Pic>
);

type Step = {
  key: string;
  pic: ReactNode;
  text: ReactNode;
  tint?: string;
  signs?: boolean;
};

/** A music note with an arrow up: the octave. */
const OctaveIcon = () => (
  <Icon>
    <path d="M9 18.5V6l8-1.5" />
    <circle cx="6.8" cy="18.5" r="2.3" />
    <path d="M18 19.5v-7M15.5 15l2.5-2.5 2.5 2.5" />
  </Icon>
);

/** The steps (one hand: the trumpet plays the beat). */
const STEPS: Step[] = [
  {
    key: "hand",
    pic: <PicHands />,
    text: "Hold your right hand up to the camera",
  },
  {
    key: "signs",
    pic: <SignIcon sign="two" size={40} />,
    text: "Show a sign for the note; the trumpet plays it on the beat",
    tint: GHOST_COLOR,
    signs: true,
  },
  {
    key: "fist",
    pic: <PicFist />,
    text: "Make a fist to rest",
    tint: GHOST_COLOR,
  },
  { key: "away", pic: <PicAway />, text: "Take your hand away to stop" },
  {
    key: "pattern",
    pic: <PicPattern />,
    text: "Choose the beat, the tempo and the octave in the dock",
  },
  {
    key: "touch",
    pic: <PicTouch />,
    text: "Or tap a note (keys 1–7, 0 rests) and press Play (P)",
  },
];

/** The corner's words when there is no camera. */
const NO_CAMERA = "No camera: tap a note, press Play";
const PATTERN_MARK: Record<PatternId, string> = {
  long: "L",
  "4": "4",
  "8": "8",
  swing: "S",
  fanfare: "F",
};

/** The beat light fades over this long (s). */
const BEAT_FLASH = 0.25;
/** The beat button: a ring that pulses on every beat, brighter on the first. */
const BeatIcon = () => {
  const ring = useRef<SVGCircleElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ring.current;
      if (el) {
        const t = performance.now() / 1000 - trumpet.beatAt;
        const k = trumpet.beating ? Math.max(0, 1 - t / BEAT_FLASH) : 0;
        const on = k * (trumpet.beatDownbeat ? 1 : 0.6);
        el.style.opacity = (0.25 + 0.75 * on).toFixed(3);
        el.setAttribute("r", (3 + 2.5 * on).toFixed(2));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <Icon>
      <circle cx="12" cy="12" r="8.5" opacity=".45" />
      <circle
        ref={ring}
        cx="12"
        cy="12"
        r="3"
        fill="currentColor"
        stroke="none"
      />
    </Icon>
  );
};

// ---------------------------------------------------------------- the dock

const VIEW_MARK: Record<View, string> = { front: "1", player: "2", close: "3" };
const VIEW_LABEL: Record<View, string> = {
  front: "View: Front",
  player: "View: Player",
  close: "View: Close",
};

type DockButton = {
  id: string;
  label: string;
  icon: ReactNode;
  on?: boolean;
  mark?: string;
  act: () => void;
};

export const Hud = () => {
  useTrumpetVersion();
  const [tapped, setTapped] = useState<string | null>(null);
  const tapTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(tapTimer.current), []);
  // The first steps card closes by itself; a closing card fades out.
  const until = trumpet.howToUntil;
  useEffect(() => {
    if (until === null) return undefined;
    const t = window.setTimeout(
      () => closeHowTo(),
      Math.max(0, until - performance.now()),
    );
    return () => window.clearTimeout(t);
  }, [until]);
  const open = trumpet.howTo;
  const [leaving, setLeaving] = useState(false);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current === open) return undefined;
    wasOpen.current = open;
    setLeaving(!open);
    if (open) return undefined;
    const t = window.setTimeout(() => setLeaving(false), 320);
    return () => window.clearTimeout(t);
  }, [open]);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const frame = frameRect(width, height);
  const hidden = trumpet.camHidden;
  // No camera picture (none, or refused): the corner says how to play instead.
  const camera = useXRReady();
  const noCamera = trumpet.entered && !camera;

  const buttons: DockButton[] = [
    {
      id: "play",
      label: trumpet.autoPlay ? "Stop the beat (P)" : "Play the beat (P)",
      icon: trumpet.autoPlay ? <PauseIcon /> : <PlayIcon />,
      on: trumpet.autoPlay,
      act: toggleAutoPlay,
    },
    {
      id: "beat",
      label: `Beat: ${PATTERN[trumpet.pattern].label}, ${trumpet.bpm} BPM`,
      icon: <BeatIcon />,
      mark: PATTERN_MARK[trumpet.pattern],
      on: trumpet.beatCard,
      act: () => {
        trumpet.beatCard = !trumpet.beatCard;
        if (trumpet.beatCard) closeHowTo();
        trumpet.changed();
      },
    },
    {
      id: "octave",
      label:
        trumpet.octave === "low"
          ? "Octave: Low (C4–B4)"
          : "Octave: High (C5–B5)",
      icon: <OctaveIcon />,
      mark: trumpet.octave === "low" ? "L" : "H",
      on: trumpet.octave === "high",
      act: () => setOctave(trumpet.octave === "low" ? "high" : "low"),
    },
    {
      id: "view",
      label: VIEW_LABEL[trumpet.view],
      icon: <ViewIcon />,
      mark: VIEW_MARK[trumpet.view],
      act: nextView,
    },
    {
      id: "light",
      label: trumpet.night ? "Night" : "Day",
      icon: trumpet.night ? <MoonIcon /> : <SunIcon />,
      act: () => setNight(!trumpet.night),
    },
    {
      id: "howto",
      label: "How to play",
      icon: <HelpIcon />,
      on: trumpet.howTo,
      act: () => {
        if (trumpet.howTo) {
          closeHowTo();
          return;
        }
        trumpet.howTo = true;
        trumpet.beatCard = false;
        trumpet.changed();
      },
    },
  ];

  return (
    <Html
      fullscreen
      calculatePosition={pinToScreen}
      zIndexRange={[30, 0]}
      style={{ pointerEvents: "none" }}
    >
      <style>{CSS}</style>
      <style>{STRIP_CSS}</style>
      <div className="vl-root">
        {noCamera ? (
          <div
            className="vl-nocam vl-glass"
            data-hud="no-camera"
            role="status"
            style={{
              right: GUTTER,
              top: GUTTER,
              width: Math.min(frame.width, 220),
            }}
          >
            <NoCameraIcon />
            <span>{NO_CAMERA}</span>
          </div>
        ) : null}
        <button
          type="button"
          data-hud="camera"
          className={`vl-cam ${hidden || noCamera ? "vl-gone" : ""}`}
          aria-label="Hide your camera"
          style={{
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,
          }}
          onClick={toggleCam}
        />
        <button
          type="button"
          data-hud="camera-show"
          className={`vl-btn vl-glass vl-show ${hidden && !noCamera ? "" : "vl-gone"}`}
          aria-label="Show your camera"
          onClick={toggleCam}
        >
          <CameraIcon />
        </button>

        {trumpet.howTo || leaving ? (
          <div
            className={`vl-howto-back ${trumpet.howTo ? "" : "vl-leave"}`}
            data-hud="howto"
            role="presentation"
            onPointerDown={() => closeHowTo()}
          >
            <div
              className="vl-howto vl-glass"
              role="dialog"
              aria-label="How to play"
            >
              {trumpet.howTo && until !== null ? (
                <div
                  className="vl-count"
                  aria-hidden="true"
                  style={
                    {
                      "--vl-count": `${INTRO_CARD_MS}ms`,
                    } as CSSProperties
                  }
                >
                  <div />
                </div>
              ) : null}
              {STEPS.map((st, i) => (
                <div className="vl-step-wrap" key={st.key}>
                  <div className="vl-step">
                    <span
                      className="vl-pic"
                      style={st.tint ? { color: st.tint } : undefined}
                    >
                      {st.pic}
                    </span>
                    <span>
                      <span className="vl-num">{i + 1}</span> {st.text}
                    </span>
                  </div>
                  {st.signs ? (
                    <div className="vl-signs" aria-hidden="true">
                      {CHOICES.map((c) => (
                        <span key={String(c)} className="vl-sign">
                          <SignIcon sign={signOf(c)} size={22} />
                          <span>{label(c)}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {trumpet.entered ? <SignStrip /> : null}

        {trumpet.beatCard ? (
          <div
            className="gt-beat vl-glass"
            data-hud="beat-card"
            role="dialog"
            aria-label="Beat"
          >
            <div className="gt-beat-row">
              {PATTERNS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`gt-chip ${trumpet.pattern === p ? "on" : ""}`}
                  aria-pressed={trumpet.pattern === p}
                  onClick={() => setPattern(p)}
                >
                  {PATTERN[p].label}
                </button>
              ))}
            </div>
            <div className="gt-beat-row gt-tempo">
              <button
                type="button"
                className="gt-chip"
                aria-label="Slower"
                disabled={trumpet.bpm <= TEMPO.least}
                onClick={() => nudgeTempo(-1)}
              >
                −
              </button>
              <span className="gt-bpm">
                {trumpet.bpm} <small>BPM</small>
              </span>
              <button
                type="button"
                className="gt-chip"
                aria-label="Faster"
                disabled={trumpet.bpm >= TEMPO.most}
                onClick={() => nudgeTempo(1)}
              >
                +
              </button>
            </div>
          </div>
        ) : null}

        <div
          className={`vl-dock vl-glass ${trumpet.dockPulseAt !== null ? "pulse" : ""}`}
          data-hud="dock"
        >
          {buttons.map((b) => {
            const showTip = tapped === b.id;
            return (
              <button
                key={b.id}
                type="button"
                data-hud={b.id}
                className={`vl-btn ${b.on ? "on" : ""}`}
                aria-label={b.label}
                aria-pressed={b.on}
                onPointerUp={(e) => {
                  // On touch the label shows for a moment after the tap.
                  if (e.pointerType === "mouse") return;
                  setTapped(b.id);
                  window.clearTimeout(tapTimer.current);
                  tapTimer.current = window.setTimeout(
                    () => setTapped(null),
                    TAP_LABEL,
                  );
                }}
                onClick={b.act}
              >
                {b.icon}
                {b.mark ? <span className="vl-mark">{b.mark}</span> : null}
                <span className={`vl-tip vl-glass ${showTip ? "show" : ""}`}>
                  {b.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Html>
  );
};
