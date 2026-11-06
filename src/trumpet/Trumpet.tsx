// The trumpet:
//   - its three valves press down for the note that sounds (C and G open,
//     D 1+3, E 1+2, F 1, A 1+2, B 2) and come back up when it stops or rests;
//     learning a song, the next note's valves wait pressed part way
//   - each note lights the bell from inside and sends a gold sound ring out of
//     it; the ring widens and fades to warm white as it travels
//   - in Front it floats side-on at chest height; in Player and Close it is
//     held at your lips. Switching views moves it with the camera (strict
//     ease-out).
//   - at night three warm lights (a rim from behind, a broad top light and a
//     side fill) keep the lacquered brass bright; they follow the camera
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  RectAreaLight,
  ShaderMaterial,
  SphereGeometry,
  SpotLight,
  TorusGeometry,
  Vector3,
  type Object3D,
} from "three";

import { sound } from "./audio";
import { ease, GLIDE } from "./CameraRig";
import { PLACE, sideOn, TRUMPET } from "./layout";
import { dressModel } from "./look";
import { MODELS, useOptionalModel } from "./models";
import { valvesDown } from "./notes";
import { notesSince, trumpet } from "./state";
import { studioLight } from "./Studio";

/** Everything the ghost hand follows. */
export const rig = {
  /** The trumpet (placed per view); its children are in the trumpet's own frame. */
  trumpet: new Group(),
  /** How far each valve is pressed, 0 up … 1 down (valve 1 nearest the mouthpiece). */
  press: [0, 0, 0],
};

/**
 * A valve goes down and comes back up with these time constants (s); a
 * preview (Learn, the next note) presses it this far.
 */
const VALVE = { down: 0.025, up: 0.045, preview: 0.4 };

/**
 * The bell's inner glow: where (the trumpet's frame), its size (m), colour,
 * how bright a note lights it (by how hard it was tongued), how much of it
 * stays while the note sounds, and how fast a flash fades (s).
 */
const BELL_GLOW = {
  centre: new Vector3(0.485, 0, -0.0175),
  radii: new Vector3(0.03, 0.058, 0.058),
  colour: new Color("#FFCE6F"),
  flash: 2.4,
  hold: 1.1,
  fade: 0.22,
};

/**
 * The sound rings: how many can be in the air, how long one lives (s), how
 * far it travels from the bell (m), its radius at the bell and at the end
 * (m), its thickness, and its colour and brightness from gold to warm white.
 */
const RINGS = {
  count: 10,
  life: 1.2,
  travel: 0.22,
  radius: { from: 0.066, to: 0.13 },
  /** The ring's thickness, as a share of its radius. */
  tube: 0.07,
  colour: { from: new Color("#FFC445"), to: new Color("#FFF1DA") },
  strength: { from: 3.2, to: 1.4 },
  /** How see-through: at the start (× the note's strength) and at the end. */
  alpha: 0.85,
};

/**
 * The night lights on the brass (renderer units): a warm rim spot from behind
 * and above, a broad warm top light and a side fill, placed round the trumpet
 * from where the camera looks.
 */
const NIGHT_BRASS = {
  rim: { colour: "#FFD9AE", power: 140 / (4 * Math.PI ** 2) },
  top: { colour: "#FFE6C4", power: 22 / (Math.PI ** 2 * 0.9 * 0.9), size: 0.9 },
  side: {
    colour: "#FFE6C8",
    power: 18 / (Math.PI ** 2 * 0.6 * 0.6),
    size: 0.6,
  },
};

/** A soft glow: bright where the surface faces you, fading to its edge. */
const glowMaterial = () =>
  new ShaderMaterial({
    uniforms: {
      uColour: { value: new Color() },
      uAlpha: { value: 0 },
      uPower: { value: 2.2 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uAlpha;
      uniform float uPower;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float a = pow(facing, uPower) * uAlpha;
        gl_FragColor = vec4(uColour * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });

/** A ring of light: brightest on its edge as seen side-on (like the mockup's halo rings). */
const ringMaterial = () =>
  new ShaderMaterial({
    uniforms: { uColour: { value: new Color() }, uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uAlpha;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float a = (0.35 + 0.65 * pow(facing, 1.6)) * uAlpha;
        gl_FragColor = vec4(uColour * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });

type Ring = {
  mesh: Mesh;
  mat: ShaderMaterial;
  /** performance.now() / 1000 when it left the bell (or -1e9: unused). */
  at: number;
  strength: number;
};

const place = (k: number, o: Object3D) => {
  const a = PLACE.player;
  const b = PLACE.front;
  o.position.lerpVectors(a.pos, b.pos, k);
  o.quaternion.slerpQuaternions(a.quat, b.quat, k);
};

export const Trumpet = () => {
  const model = useOptionalModel(MODELS.trumpet);
  const camera = useThree((s) => s.camera);

  const parts = useMemo(() => {
    const src = model?.getObjectByName("Trumpet") ?? null;
    if (!src) return null;
    const body = src.clone(true);
    body.position.set(0, 0, 0);
    body.quaternion.identity();
    body.scale.set(1, 1, 1);
    dressModel(body);
    const valves = [1, 2, 3].map(
      (i) => body.getObjectByName(`Valve_${i}`) ?? null,
    );
    const restY = valves.map((v) => v?.position.y ?? 0);

    // The bell's glow.
    const glowMat = glowMaterial();
    const glow = new Mesh(new SphereGeometry(1, 32, 16), glowMat);
    glow.position.copy(BELL_GLOW.centre);
    glow.scale.copy(BELL_GLOW.radii);
    glow.renderOrder = 6;
    body.add(glow);

    // The sound rings (one shape, turned to face along the bell's axis).
    const torus = new TorusGeometry(1, RINGS.tube, 10, 72);
    torus.rotateY(Math.PI / 2);
    const rings: Ring[] = Array.from({ length: RINGS.count }, () => {
      const mat = ringMaterial();
      const mesh = new Mesh(torus, mat);
      mesh.visible = false;
      mesh.renderOrder = 7;
      mesh.frustumCulled = false;
      body.add(mesh);
      return { mesh, mat, at: -1e9, strength: 0 };
    });

    rig.trumpet.add(body);
    return { body, valves, restY, glow, glowMat, rings };
  }, [model]);

  // The night lights on the brass.
  const night = useMemo(() => {
    const rim = new SpotLight(
      NIGHT_BRASS.rim.colour,
      0,
      4,
      (40 * Math.PI) / 180,
      0.8,
      2,
    );
    const top = new RectAreaLight(
      NIGHT_BRASS.top.colour,
      0,
      NIGHT_BRASS.top.size,
      NIGHT_BRASS.top.size,
    );
    const side = new RectAreaLight(
      NIGHT_BRASS.side.colour,
      0,
      NIGHT_BRASS.side.size,
      NIGHT_BRASS.side.size,
    );
    return { rim, top, side, all: [rim, rim.target, top, side] };
  }, []);

  const st = useRef({
    view: trumpet.view,
    at: -10,
    from: sideOn(trumpet.view) ? 1 : 0,
    k: sideOn(trumpet.view) ? 1 : 0,
    seq: trumpet.seq,
    flash: 0,
    ring: 0,
  });
  const tmp = useMemo(
    () => ({
      c: new Vector3(),
      back: new Vector3(),
      side: new Vector3(),
      up: new Vector3(0, 1, 0),
      col: new Color(),
    }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    const now = performance.now() / 1000;

    // Side-on in Front, held in Player and Close.
    if (s.view !== trumpet.view) {
      s.view = trumpet.view;
      s.from = s.k;
      s.at = now;
    }
    const goal = sideOn(trumpet.view) ? 1 : 0;
    s.k = s.from + (goal - s.from) * ease((now - s.at) / GLIDE);
    place(s.k, rig.trumpet);
    rig.trumpet.updateMatrixWorld(true);

    // The valves: down for the sounding note, up when it stops.
    const sounding = trumpet.sounding !== null && now < trumpet.soundingUntil;
    // Learning a song, between notes the hand rests on the next note's
    // valves, pressed part way.
    const preview =
      !sounding && trumpet.session?.mode === "learn" && trumpet.target !== null;
    let want = valvesDown("rest");
    if (sounding) want = valvesDown(trumpet.sounding!);
    else if (preview) want = valvesDown(trumpet.target!);
    const depth = sounding ? 1 : VALVE.preview;
    want.forEach((down, i) => {
      const tc = down ? VALVE.down : VALVE.up;
      rig.press[i] +=
        ((down ? depth : 0) - rig.press[i]) * (1 - Math.exp(-dt / tc));
    });
    if (!parts) return;
    parts.valves.forEach((v, i) => {
      // eslint-disable-next-line no-param-reassign
      if (v) v.position.y = parts.restY[i] - TRUMPET.pressTravel * rig.press[i];
    });

    // Each new note: the bell flashes and a ring leaves it.
    notesSince(s.seq).forEach((e) => {
      s.seq = e.seq;
      s.flash = Math.max(s.flash, 0.4 + 0.6 * e.strength);
      const r = parts.rings[s.ring];
      s.ring = (s.ring + 1) % parts.rings.length;
      r.at = e.at;
      r.strength = e.strength;
    });
    s.flash *= Math.exp(-dt / BELL_GLOW.fade);
    const level = sounding ? Math.min(1, sound.last.level * 2.5) : 0;
    const glow = BELL_GLOW.flash * s.flash + BELL_GLOW.hold * level;
    parts.glowMat.uniforms.uAlpha.value = Math.min(3, glow) * 0.75;
    (parts.glowMat.uniforms.uColour.value as Color).copy(BELL_GLOW.colour);
    parts.glow.visible = glow > 0.005;

    /* eslint-disable no-param-reassign */
    parts.rings.forEach((r) => {
      const t = (now - r.at) / RINGS.life;
      if (t < 0 || t >= 1) {
        r.mesh.visible = false;
        return;
      }
      // A gentler ease-out than the views' (it keeps moving as it fades).
      const k = 1 - (1 - t) ** 2;
      const radius =
        RINGS.radius.from + (RINGS.radius.to - RINGS.radius.from) * k;
      r.mesh.visible = true;
      r.mesh.position.set(
        TRUMPET.bellMouth.x + 0.02 + RINGS.travel * k,
        TRUMPET.bellMouth.y,
        TRUMPET.bellMouth.z,
      );
      r.mesh.scale.setScalar(radius);
      const fade = (1 - t) ** 1.4;
      const strength =
        RINGS.strength.from + (RINGS.strength.to - RINGS.strength.from) * k;
      r.mat.uniforms.uAlpha.value =
        RINGS.alpha * (0.5 + 0.5 * r.strength) * fade * (strength / 3.2);
      (r.mat.uniforms.uColour.value as Color)
        .copy(RINGS.colour.from)
        .lerp(RINGS.colour.to, k)
        .multiplyScalar(strength / 2);
    });
    /* eslint-enable no-param-reassign */

    // The night lights, placed round the trumpet from the camera.
    const n = studioLight.night;
    const c = tmp.c.set(0.24, 0, 0).applyMatrix4(rig.trumpet.matrixWorld);
    const back = tmp.back.copy(c).sub(camera.position);
    back.y = 0;
    back.normalize();
    const side = tmp.side.crossVectors(tmp.up, back);
    night.rim.position
      .copy(c)
      .addScaledVector(back, 0.55)
      .addScaledVector(side, 0.25)
      .addScaledVector(tmp.up, 0.45);
    night.rim.target.position.copy(c);
    night.rim.target.updateMatrixWorld();
    night.top.position
      .copy(c)
      .addScaledVector(back, -0.15)
      .addScaledVector(tmp.up, 0.55);
    night.top.lookAt(c);
    night.side.position
      .copy(c)
      .addScaledVector(back, -0.45)
      .addScaledVector(side, -0.45)
      .addScaledVector(tmp.up, 0.15);
    night.side.lookAt(c);
    night.rim.intensity = NIGHT_BRASS.rim.power * n;
    night.top.intensity = NIGHT_BRASS.top.power * n;
    night.side.intensity = NIGHT_BRASS.side.power * n;
    night.all.forEach((l) => {
      // eslint-disable-next-line no-param-reassign
      l.visible = n > 0.01;
    });
  });

  return (
    <>
      <primitive object={rig.trumpet} />
      {night.all.map((l) => (
        <primitive key={l.uuid} object={l} />
      ))}
    </>
  );
};
