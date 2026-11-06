// QA-F21 fixtures for the template's half of f21 (see features/f21-visual-editor/qa.md,
// "Fixtures"). Each tree is a throwaway copy in the OS temp dir, so a case that builds,
// runs the dev server or edits src/ never touches the checkout it runs from.

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function git(args, cwd = ROOT) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function tempDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `qa-f21-${label}-`));
}

function linkModules(dir) {
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(dir, "node_modules"), "dir");
}

/** F21_TEMPLATE_PROJECT: this checkout's tracked and unignored files, as they are on disk. */
export function templateProject() {
  const dir = tempDir("project");
  const files = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    .split("\0")
    .filter(Boolean);
  for (const rel of files) {
    const from = path.join(ROOT, rel);
    if (!fs.existsSync(from)) continue;
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.copyFileSync(from, path.join(dir, rel));
  }
  linkModules(dir);
  return dir;
}

/**
 * The commit F21_TEMPLATE_PRE names: the `latest` tag (override: F21_PRE_REF). The remote
 * tag is authoritative, because `latest` is moved on every release and a local copy of the
 * tag goes stale (when this was written, the local tag sat 36 commits behind origin's).
 */
export function preCommit() {
  const ref = process.env.F21_PRE_REF ?? "latest";
  try {
    const line = git(["ls-remote", "origin", `refs/tags/${ref}`]);
    if (line) return { ref, sha: line.split(/\s+/)[0], from: "origin" };
  } catch {
    // offline: fall through to the local ref
  }
  return { ref, sha: git(["rev-parse", `${ref}^{commit}`]), from: "local" };
}

/** F21_TEMPLATE_PRE: the tree at `pre.sha`, installed from this checkout's node_modules. */
export function templatePre(pre) {
  const dir = tempDir("pre");
  let local = true;
  try {
    git(["cat-file", "-e", `${pre.sha}^{commit}`]);
  } catch {
    local = false;
  }
  if (local) {
    const tar = path.join(dir, "..", `${path.basename(dir)}.tar`);
    git(["archive", "--format=tar", "-o", tar, pre.sha]);
    execFileSync("tar", ["-xf", tar, "-C", dir]);
    fs.rmSync(tar);
  } else {
    const url = git(["remote", "get-url", "origin"]);
    execFileSync("git", ["clone", "--quiet", "--depth", "1", "--branch", pre.ref, url, dir]);
  }
  linkModules(dir);
  return dir;
}

export function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

/**
 * `npm run dev` in `dir` on `port`. Resolves once the server prints its address AND the first
 * watch build has finished: dev.mjs prints the address ~200 ms before `.dev/assets` exists.
 */
export function startDev(dir, port) {
  const child = spawn("npm", ["run", "dev"], {
    cwd: dir,
    env: { ...process.env, PORT: String(port), HOST: "" },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  const stop = () => {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // already gone
    }
  };
  const ready = new Promise((resolve, reject) => {
    const onData = (b) => {
      log += b.toString();
      if (log.includes(`dev server: http://localhost:${port}`) && log.includes("build finished")) {
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => reject(new Error(`dev server exited (${code}):\n${log}`)));
    setTimeout(() => reject(new Error(`dev server not up in 60 s:\n${log}`)), 60_000);
  });
  return { ready, stop, log: () => log };
}
