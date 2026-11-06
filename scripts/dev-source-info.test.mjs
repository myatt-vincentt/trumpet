// @vitest-environment node
// The desktop editor needs JSX source locations and live reload from the
// development build, and neither may reach a published bundle. The production
// half builds the real app through the real options twice: as configured, and
// with `jsxDev` removed (the config before it existed). Equal bytes is the claim;
// the marker scan is what catches a dev-only path that leaked some other way.
// The development half is the positive control: a scan that finds nothing
// because the build never emitted it would otherwise pass as "clean".

import { describe, expect, it } from "vitest";
import esbuild from "esbuild";
import { buildOptions } from "../esbuild.config.mjs";
import { LIVE_RELOAD_SNIPPET, devIndexHtml } from "./dev-html.mjs";

const FORBIDDEN = ["jsxDEV", "_debugSource", "EventSource", "/esbuild"];

async function build(options) {
  const result = await esbuild.build({ ...options, write: false, logLevel: "silent" });
  return new Map(result.outputFiles.map((f) => [f.path, f.contents]));
}

describe("production bundle is unchanged by the editor's development support", () => {
  it("is byte-identical with and without the jsxDev option, and carries no dev marker", async () => {
    const options = buildOptions({ mode: "production" });
    expect(options.jsxDev).toBe(false);
    const { jsxDev, ...before } = options;

    const [now, then] = await Promise.all([build(options), build(before)]);
    expect([...now.keys()].sort()).toEqual([...then.keys()].sort());
    for (const [file, bytes] of now) {
      expect(Buffer.compare(Buffer.from(bytes), Buffer.from(then.get(file))), file).toBe(0);
    }

    for (const [file, bytes] of now) {
      const text = Buffer.from(bytes).toString("latin1");
      for (const marker of FORBIDDEN) expect(text.includes(marker), `${marker} in ${file}`).toBe(false);
    }
  }, 60_000);
});

describe("development build carries source info and live reload", () => {
  it("compiles JSX through jsxDEV with the source file name", async () => {
    const options = buildOptions({ mode: "development" });
    expect(options.jsxDev).toBe(true);
    // Shaped as scripts/dev.mjs builds it.
    const out = await build({ ...options, splitting: false, sourcemap: false, entryNames: "[name]" });
    const main = [...out].find(([file]) => file.endsWith("main.js"));
    const text = Buffer.from(main[1]).toString("utf8");
    expect(text).toContain("jsxDEV");
    expect(text).toMatch(/fileName: "src\/App\.tsx"/);
  }, 60_000);

  it("writes a reload on esbuild's change event into the page head", () => {
    const html = devIndexHtml(
      '<html><head><link href="/src/index.css" rel="stylesheet" /></head>' +
        '<body><script type="module" src="/src/main.tsx"></script></body></html>',
    );
    expect(html).toContain(LIVE_RELOAD_SNIPPET);
    expect(html.indexOf(LIVE_RELOAD_SNIPPET)).toBeLessThan(html.indexOf("</head>"));
    expect(LIVE_RELOAD_SNIPPET).toMatch(/new EventSource\("\/esbuild"\)\.addEventListener\("change"/);
    expect(html).toContain('<script type="module" src="/assets/main.js"></script>');
    expect(html).toContain('<link rel="stylesheet" href="/assets/main.css" />');
  });
});
