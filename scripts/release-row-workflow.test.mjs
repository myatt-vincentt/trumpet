/**
 * The release-row workflow re-sends a row and does nothing else. It is the
 * safe way to correct a migration note precisely because it cannot move
 * `latest`, so these assertions read the workflow file rather than trusting
 * that a later edit kept it that way.
 */
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const body = readFileSync(path.join(REPO, '.github/workflows/release-row.yml'), 'utf8');
// Comments may name what the workflow must not do; only the YAML is judged.
const yaml = body
  .split('\n')
  .filter((l) => !/^\s*#/.test(l))
  .join('\n');

test('manual dispatch only, with a required tag input', () => {
  expect(yaml).toMatch(/^on:\s*\n\s+workflow_dispatch:/m);
  expect(yaml).not.toMatch(/^\s+(push|pull_request|schedule|workflow_run):/m);
  expect(yaml).toMatch(/inputs:\s*\n\s+tag:[\s\S]*?required:\s*true/);
});

test('read-only on the repo, in the tag-only release environment', () => {
  expect(yaml).toMatch(/^permissions:\s*\n\s+contents:\s*read\s*$/m);
  expect(yaml).not.toMatch(/contents:\s*write/);
  expect(yaml).toMatch(/^\s+environment:\s*release\s*$/m);
});

test('never builds, never moves a tag, never touches `latest`', () => {
  expect(yaml).not.toMatch(/\bpnpm\b/);
  expect(yaml).not.toMatch(/\bgit\s+(tag|push)\b/);
  expect(yaml.replace(/ubuntu-latest/g, '')).not.toMatch(/\blatest\b/);
});

test('the dispatch ref must be the tag named by the input', () => {
  expect(yaml).toMatch(/REF_TYPE"\s*!=\s*"tag"/);
  expect(yaml).toMatch(/REF_NAME"\s*!=\s*"\$INPUT_TAG"/);
  expect(yaml).toContain('scripts/tag-guard.sh');
});
