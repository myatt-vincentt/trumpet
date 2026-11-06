#!/usr/bin/env node
// The api's guide bundle (api internal/mcp/guide/split.go) cuts GROUNDING.md into the topics an AI
// app reads through the Vincentt connector. This is a port of that split, so a grounding edit that
// renames, drops or reorders a `## ` heading fails here instead of silently changing the guide.
// Keep split() and slug() byte-for-byte equivalent to split.go; the tests pin its edge cases.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED_TOPICS = [
  'overview',
  'getting-started',
  'sdk-parts',
  'face-world-and-image-tracking',
  'assets',
  'what-fails-on-phones',
  'publishing',
];

// The api serves its own `connector` topic in every bundle, so the id is taken before any section.
export const CONNECTOR_TOPIC = 'connector';
const MAX_ID_LEN = 48;

// Go's unicode.IsSpace set, which differs from JS \s (Go has U+0085, JS has U+FEFF).
const GO_SPACE = '\t\n\v\f\r \u0085                 　';

function goTrimSpace(s) {
  const chars = [...s];
  let a = 0;
  let b = chars.length;
  while (a < b && GO_SPACE.includes(chars[a])) a += 1;
  while (b > a && GO_SPACE.includes(chars[b - 1])) b -= 1;
  return chars.slice(a, b).join('');
}

function trimRightNewlines(s) {
  return s.replace(/[\r\n]+$/, '');
}

// Go's strings.SplitAfter(doc, "\n"): every piece keeps its "\n"; a trailing "" piece is harmless.
function splitAfterNewline(doc) {
  const out = [];
  let start = 0;
  for (let i = doc.indexOf('\n'); i !== -1; i = doc.indexOf('\n', start)) {
    out.push(doc.slice(start, i + 1));
    start = i + 1;
  }
  out.push(doc.slice(start));
  return out;
}

// Go's unicode.ToLower maps rune to rune; JS maps U+0130 to two code points, Go to "i".
function goLowerRune(r) {
  return r === 'İ' ? 'i' : r.toLowerCase();
}

export function slug(title) {
  let b = '';
  let dash = false;
  let cut = false;
  for (const ch of title) {
    if (b.length >= MAX_ID_LEN) {
      cut = true;
      break;
    }
    const r = goLowerRune(ch);
    if (/^[a-z0-9]$/.test(r)) {
      b += r;
      dash = false;
    } else if (!dash && b.length > 0) {
      b += '-';
      dash = true;
    }
  }
  let s = b.replace(/^-+|-+$/g, '');
  const i = s.lastIndexOf('-');
  if (cut && !dash && i > 0) s = s.slice(0, i);
  return s === '' ? 'topic' : s;
}

function unique(id, seen) {
  let out = id;
  for (let n = 2; seen.has(out); n += 1) out = `${id}-${n}`;
  seen.add(out);
  return out;
}

/** Cuts a markdown document at its `## ` headings outside fences, as the api does. */
export function split(doc) {
  const out = [];
  const seen = new Set([CONNECTOR_TOPIC]);
  let cur = { id: 'overview', title: 'Overview' };
  let body = '';
  let inFence = false;
  const flush = () => {
    const text = goTrimSpace(body);
    if (text !== '') out.push({ ...cur, id: unique(cur.id, seen), body: `${text}\n` });
    body = '';
  };
  for (const line of splitAfterNewline(doc)) {
    const trimmed = trimRightNewlines(line);
    if (goTrimSpace(trimmed).startsWith('```')) inFence = !inFence;
    if (!inFence && trimmed.startsWith('## ')) {
      flush();
      const title = goTrimSpace(trimmed.slice(3)).replaceAll('`', '');
      cur = { id: slug(title), title };
    }
    body += line;
  }
  flush();
  return out;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const ids = split(readFileSync(join(root, 'GROUNDING.md'), 'utf8')).map((t) => t.id);
  console.log(ids.join('\n'));
  if (ids.join(',') !== EXPECTED_TOPICS.join(',')) {
    console.error(
      `::error file=GROUNDING.md::the guide topics are [${ids.join(', ')}], expected [${EXPECTED_TOPICS.join(', ')}]. ` +
        'The api cuts one guide topic per "## " heading; keep these headings, in this order, and put new material under one of them as "###".',
    );
    process.exit(1);
  }
  console.log(`GROUNDING.md splits into the ${EXPECTED_TOPICS.length} guide topics, in order.`);
}

if (process.argv[1] && resolve(process.argv[1]).endsWith('check-guide-topics.mjs')) {
  main();
}
