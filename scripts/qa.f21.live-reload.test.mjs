// @vitest-environment node
// QA-F21-GX1 arm (c), template half · live reload through the real dev server.
//   Given F21_TEMPLATE_PROJECT running under the real `npm run dev`
//   When  a client holds `GET /esbuild` (Accept: text/event-stream) through dev.mjs's Host
//         check, addressed by the IP-literal URLs the CLI builds (127.0.0.1 and [::1]) and by
//         `localhost` (what the `vincentt preview` proxy sends), and a literal in src/ changes
//   Then  a `change` event arrives within 2 s
//   And   negative twin: a Host that is not this server's is refused before the stream opens.
// The bridge's gate (held for a self-write, passed otherwise) is the toolchain half of (c).

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { freePort, startDev, templateProject } from "./qa.f21.fixture.mjs";

let dir;
let port;
let dev;

beforeAll(async () => {
  dir = templateProject();
  port = await freePort();
  dev = startDev(dir, port);
  await dev.ready;
}, 90_000);

afterAll(() => {
  dev?.stop();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

/** Opens the event stream; resolves with the response and a waiter for the next named event. */
function openStream(address, hostHeader) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { host: address, port, path: "/esbuild", headers: { Accept: "text/event-stream", Host: hostHeader } },
      (res) => {
        let buf = "";
        const waiters = [];
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          buf += chunk;
          let i;
          while ((i = buf.indexOf("\n\n")) !== -1) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const name = /^event: (.*)$/m.exec(block)?.[1];
            const data = /^data: (.*)$/m.exec(block)?.[1];
            for (const w of waiters.splice(0)) w({ name, data });
          }
        });
        const next = (ms) =>
          new Promise((res2, rej2) => {
            const t = setTimeout(() => rej2(new Error(`no event within ${ms} ms`)), ms);
            waiters.push((ev) => {
              clearTimeout(t);
              res2(ev);
            });
          });
        resolve({ res, next, close: () => req.destroy() });
      },
    );
    req.on("error", reject);
  });
}

let flip = 0;
/** Changes the Title label's fontSize literal; returns the time of the write. */
function editLiteral() {
  const file = path.join(dir, "src/Scene.tsx");
  const src = fs.readFileSync(file, "utf8");
  const from = flip % 2 === 0 ? "fontSize={54}" : "fontSize={55}";
  const to = flip % 2 === 0 ? "fontSize={55}" : "fontSize={54}";
  flip += 1;
  expect(src).toContain(from);
  fs.writeFileSync(file, src.replace(from, to));
  return performance.now();
}

async function expectChange(address, hostHeader, withinMs) {
  const stream = await openStream(address, hostHeader);
  try {
    expect(stream.res.statusCode).toBe(200);
    expect(stream.res.headers["content-type"]).toMatch(/text\/event-stream/);
    const pending = stream.next(withinMs);
    const t0 = editLiteral();
    const ev = await pending;
    const elapsed = performance.now() - t0;
    expect(ev.name).toBe("change");
    const { added = [], updated = [] } = JSON.parse(ev.data);
    // esbuild names the outputs under servedir; dev.mjs's outdir nests them (`/assets/assets/`).
    expect([...added, ...updated].some((p) => p.endsWith("/main.js"))).toBe(true);
    expect(elapsed).toBeLessThan(withinMs);
    return elapsed;
  } finally {
    stream.close();
  }
}

describe("QA-F21-GX1 (c) · the template's /esbuild change event, through the Host check", () => {
  // esbuild's watcher polls: a file not changed since the server started is found by a
  // random-subset scan (measured ~2 s on this template), a recently changed one in ~250 ms.
  // The first agent edit after start is therefore the slow one; it is bounded, not timed.
  // A warm edit is ~250 ms locally but lands at 1.0-1.05 s on a 2-CPU hosted runner when the
  // write just misses a poll, so the warm bound is 2 s: a broken reload never fires at all.
  it("cold: the first src literal change after start emits `change` (bounded at 5 s)", async () => {
    await expectChange("127.0.0.1", `127.0.0.1:${port}`, 5000);
  }, 15_000);

  for (const [label, address, host] of [
    ["127.0.0.1 (CLI dev URL)", "127.0.0.1", () => `127.0.0.1:${port}`],
    ["[::1] (CLI dev URL)", "::1", () => `[::1]:${port}`],
    ["localhost (preview proxy Host)", "127.0.0.1", () => `localhost:${port}`],
  ]) {
    it(`${label}: a src literal change emits \`change\` within 2 s`, async () => {
      await expectChange(address, host(), 2000);
    }, 15_000);
  }

  it("negative twin: a foreign Host, or this host on another port, is refused with 403", async () => {
    for (const host of ["evil.example", `evil.example:${port}`, `127.0.0.1:${port + 1}`]) {
      const stream = await openStream("127.0.0.1", host);
      try {
        expect(stream.res.statusCode, host).toBe(403);
      } finally {
        stream.close();
      }
    }
  });
});
