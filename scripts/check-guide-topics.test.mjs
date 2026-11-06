import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXPECTED_TOPICS, slug, split } from './check-guide-topics.mjs';

const ids = (doc) => split(doc).map((t) => t.id);

describe('slug', () => {
  it.each([
    ['Getting started', 'getting-started'],
    ['Face, world and image tracking', 'face-world-and-image-tracking'],
    ['What fails on phones', 'what-fails-on-phones'],
    ['  Lots   of -- punctuation!! ', 'lots-of-punctuation'],
    ['Café crème', 'caf-cr-me'],
    ['İstanbul', 'istanbul'],
    ['!!!', 'topic'],
    ['', 'topic'],
  ])('%j -> %s', (title, id) => {
    expect(slug(title)).toBe(id);
  });

  it('cuts at 48 characters and trims a cut word back to the last dash', () => {
    const id = slug('word '.repeat(12));
    expect(id).toBe(Array(9).fill('word').join('-'));
    expect(id.length).toBeLessThanOrEqual(48);
  });

  it('drops the last whole word too when the cut lands right after it, as split.go does', () => {
    expect(slug(`${'abc '.repeat(11)}abcd efgh`)).toBe(Array(11).fill('abc').join('-'));
  });

  it('keeps everything when the cut lands on a dash', () => {
    expect(slug(`${'x'.repeat(47)} yz`)).toBe('x'.repeat(47));
  });

  it('keeps a single over-long word at 48 characters', () => {
    expect(slug('a'.repeat(60))).toBe('a'.repeat(48));
  });
});

describe('split', () => {
  it('puts the text before the first heading in overview', () => {
    const topics = split('# Title\n\nIntro.\n\n## Getting started\n\nBody.\n');
    expect(topics.map((t) => t.id)).toEqual(['overview', 'getting-started']);
    expect(topics[0].body).toBe('# Title\n\nIntro.\n');
    expect(topics[1].body).toBe('## Getting started\n\nBody.\n');
  });

  it('drops an empty overview', () => {
    expect(ids('\n  \n## Only\nbody\n')).toEqual(['only']);
  });

  it('keeps a heading with nothing under it, because the heading line is its body', () => {
    expect(ids('## Empty\n## Next\nbody\n')).toEqual(['empty', 'next']);
  });

  it('does not cut at a ## line inside a fence, with or without a language or indent', () => {
    const doc = [
      'intro',
      '```tsx',
      '## not a topic',
      '```',
      '## Real',
      '  ```',
      '## also not a topic',
      '  ```',
      'after',
    ].join('\n');
    expect(ids(doc)).toEqual(['overview', 'real']);
  });

  it('cuts only at "## " at the start of the line', () => {
    expect(ids('intro\n### Sub\n##NoSpace\n ## Indented\n## Yes\n')).toEqual(['overview', 'yes']);
  });

  it('removes backticks from the title', () => {
    const [topic] = split('## The `useGestureHold` hook\nbody\n');
    expect(topic).toMatchObject({ id: 'the-usegesturehold-hook', title: 'The useGestureHold hook' });
  });

  it('numbers duplicate ids from 2', () => {
    expect(ids('## Notes\na\n## Notes\nb\n## notes!\nc\n')).toEqual(['notes', 'notes-2', 'notes-3']);
  });

  it('never yields the reserved connector id', () => {
    expect(ids('## Connector\na\n## connector\nb\n')).toEqual(['connector-2', 'connector-3']);
  });

  it('reads CRLF line endings', () => {
    expect(split('## A title\r\nbody\r\n')[0]).toMatchObject({ id: 'a-title', title: 'A title' });
  });
});

describe('the shipped GROUNDING.md', () => {
  it('splits into exactly the guide topics, in order', () => {
    const doc = readFileSync(join(process.cwd(), 'GROUNDING.md'), 'utf8');
    expect(ids(doc)).toEqual(EXPECTED_TOPICS);
  });
});
