// @vitest-environment node
// QA-F21-G09 (artifact arm) · Nothing of the editor reaches the published bytes or the
// creator's dependencies (B-F21-5).
//   Given F21_TEMPLATE_PRE (the `latest` tag) and F21_TEMPLATE_PROJECT (this checkout)
//   When  `npm run build` in each
//   Then  the two dist trees are byte-identical; no dist file carries a dev or editor marker;
//         package.json and the lockfile name no @vincentt-xr/editor-*
//   And   positive twin: the dev build (.dev/, from the real `npm run dev`) DOES carry
//         jsxDEV and the live-reload snippet.
// The bridge-marker-in-the-running-page twin and the no-platform-request arm need the
// editor and the CLI; they live in toolchain, not here.

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  ROOT,
  freePort,
  preCommit,
  startDev,
  templatePre,
  templateProject,
} from "./qa.f21.fixture.mjs";

// The bridge's own marker is not named by the record yet; these are the names any
// editor package or injected global would carry.
const FORBIDDEN = [
  "jsxDEV",
  "_debugSource",
  "/esbuild",
  "EventSource",
  "@vincentt-xr/editor",
  "editor-bridge",
  "__vincenttEditor",
];

const pre = preCommit();
const showPreConfig = () =>
  spawnSync("git", ["-C", ROOT, "show", `${pre.sha}:esbuild.config.mjs`], { encoding: "utf8" });
let preConfig = showPreConfig();
// A shallow CI checkout lacks the tag's commit; unread is not "pre-f21", so fetch it and read again.
if (preConfig.status !== 0 && pre.from === "origin") {
  spawnSync("git", ["-C", ROOT, "fetch", "--quiet", "--depth", "1", "origin", pre.sha]);
  preConfig = showPreConfig();
}
// Once a release carrying f21 moves `latest`, the tag is no longer a pre-f21 tree and the
// diff below would compare f21 with itself. Say so by name instead of passing vacuously.
const preIsPreF21 = preConfig.status !== 0 || !preConfig.stdout.includes("jsxDev");

const dirs = [];
afterAll(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

function npmBuild(dir) {
  const r = spawnSync("npm", ["run", "build"], { cwd: dir, encoding: "utf8" });
  expect(r.status, `npm run build in ${dir}\n${r.stdout}\n${r.stderr}`).toBe(0);
  return path.join(dir, "dist");
}

// esbuild's hashed entry name depends on the project's absolute path (two builds of one
// commit in two folders differ in `main-<hash>.js` and index.html), so each tree is built
// from the same folder, the way a creator's successive builds are.
function buildInSeat(seat, dir) {
  fs.renameSync(dir, seat);
  try {
    return hashes(npmBuild(seat));
  } finally {
    fs.renameSync(seat, dir);
  }
}

function hashes(distDir) {
  const out = new Map();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.set(path.relative(distDir, p), crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"));
    }
  };
  walk(distDir);
  return out;
}

let projectDist;

describe("QA-F21-G09 · nothing of the editor reaches the published bytes", () => {
  it.skipIf(!preIsPreF21)(
    `dist is byte-identical to F21_TEMPLATE_PRE (${pre.ref} = ${pre.sha.slice(0, 7)}, ${pre.from})`,
    () => {
      const preDir = templatePre(pre);
      const projectDir = templateProject();
      dirs.push(preDir, projectDir);
      // One node_modules serves both trees, which holds only if they pin the same install.
      for (const f of ["package.json", "pnpm-lock.yaml"]) {
        expect(fs.readFileSync(path.join(preDir, f), "utf8"), `${f} differs from ${pre.ref}`).toBe(
          fs.readFileSync(path.join(projectDir, f), "utf8"),
        );
      }
      const seat = path.join(path.dirname(preDir), `qa-f21-seat-${process.pid}`);
      const before = buildInSeat(seat, preDir);
      const now = buildInSeat(seat, projectDir);
      projectDist = path.join(projectDir, "dist");
      expect(now.size).toBeGreaterThan(0);
      expect([...now.keys()].sort()).toEqual([...before.keys()].sort());
      for (const [file, h] of now) expect(h, file).toBe(before.get(file));
    },
    180_000,
  );

  it("no file in dist carries a dev or editor marker", () => {
    if (!projectDist) {
      const projectDir = templateProject();
      dirs.push(projectDir);
      projectDist = npmBuild(projectDir);
    }
    const files = [...hashes(projectDist).keys()];
    expect(files.some((f) => f.endsWith(".js"))).toBe(true);
    for (const rel of files) {
      const text = fs.readFileSync(path.join(projectDist, rel)).toString("latin1");
      for (const m of FORBIDDEN) expect(text.includes(m), `${m} in dist/${rel}`).toBe(false);
    }
  }, 180_000);

  it("package.json and the lockfile name no @vincentt-xr/editor-* package", () => {
    for (const f of ["package.json", "pnpm-lock.yaml"]) {
      expect(fs.readFileSync(path.join(ROOT, f), "utf8")).not.toMatch(/@vincentt-xr\/editor/);
    }
  });

  it("positive twin: the real dev build carries jsxDEV with source locations and live reload", async () => {
    const dir = templateProject();
    dirs.push(dir);
    const dev = startDev(dir, await freePort());
    try {
      await dev.ready;
      const main = fs.readFileSync(path.join(dir, ".dev/assets/main.js"), "utf8");
      expect(main).toContain("jsxDEV");
      expect(main).toMatch(/fileName: "src\/Scene\.tsx",\s*lineNumber: \d+,\s*columnNumber: \d+/);
      const html = fs.readFileSync(path.join(dir, ".dev/index.html"), "utf8");
      const head = html.slice(0, html.indexOf("</head>"));
      expect(head).toMatch(/new EventSource\("\/esbuild"\)\.addEventListener\("change"/);
      expect(head).toContain("location.reload()");
    } finally {
      dev.stop();
    }
  }, 120_000);
});
