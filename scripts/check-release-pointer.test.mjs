import { describe, it, expect } from 'vitest';
import {
  highestReleaseTag,
  lockedVersion,
  pointerFailures,
  pinFailures,
  expectedVersions,
} from './check-release-pointer.mjs';

describe('highestReleaseTag', () => {
  it('compares numerically, not lexically', () => {
    expect(highestReleaseTag(['1.5.9', '1.5.10', '1.10.0', '1.9.3'])).toBe('1.10.0');
  });

  it('ignores latest, prereleases and prefixed tags', () => {
    expect(highestReleaseTag(['latest', '2.0.0-rc.1', 'v9.9.9', '1.5.6', ''])).toBe('1.5.6');
  });

  it('returns null with no release tag', () => {
    expect(highestReleaseTag(['latest'])).toBeNull();
  });
});

const LOCK = `lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      '@vincentt-xr/harness':
        specifier: ^1.5.0
        version: 1.5.0(react@18.3.1)
      '@vincentt-xr/sdk':
        specifier: 2.0.0-alpha.5
        version: 2.0.0-alpha.5(@mediapipe/tasks-vision@0.10.35)(three@0.173.0)
      react:
        specifier: 18.3.1
        version: 18.3.1

packages:

  '@vincentt-xr/sdk@9.9.9':
    resolution: {integrity: sha512-x}
`;

describe('lockedVersion', () => {
  it('reads the root importer version without the peer suffix', () => {
    expect(lockedVersion(LOCK, '@vincentt-xr/sdk')).toBe('2.0.0-alpha.5');
    expect(lockedVersion(LOCK, '@vincentt-xr/harness')).toBe('1.5.0');
  });

  it('reads an unquoted key', () => {
    expect(lockedVersion(LOCK, 'react')).toBe('18.3.1');
  });

  it('does not read past the importers block', () => {
    expect(lockedVersion(LOCK, '@vincentt-xr/analytics')).toBeNull();
  });
});

describe('pointerFailures', () => {
  it('passes when latest is the highest tag', () => {
    expect(pointerFailures({ pointerSha: 'a', highestTag: '1.5.6', highestSha: 'a' })).toEqual([]);
  });

  it('fails naming the tag latest fell behind', () => {
    const [f] = pointerFailures({ pointerSha: 'a', highestTag: '1.5.7', highestSha: 'b' });
    expect(f).toContain('1.5.7');
  });

  it('fails when latest is missing', () => {
    expect(pointerFailures({ pointerSha: null, highestTag: '1.5.6', highestSha: 'a' })).toHaveLength(1);
  });
});

describe('pinFailures', () => {
  it('passes when both match', () => {
    const v = { '@vincentt-xr/sdk': '2.0.0-alpha.5', '@vincentt-xr/harness': '1.5.0' };
    expect(pinFailures(v, v)).toEqual([]);
  });

  it('names both versions on a mismatch', () => {
    const failures = pinFailures(
      { '@vincentt-xr/sdk': '2.0.0-alpha.4', '@vincentt-xr/harness': '1.5.0' },
      { '@vincentt-xr/sdk': '2.0.0-alpha.5', '@vincentt-xr/harness': '1.5.0' },
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('2.0.0-alpha.4');
    expect(failures[0]).toContain('2.0.0-alpha.5');
  });

  it('fails on a package that is not locked', () => {
    expect(pinFailures({}, { '@vincentt-xr/sdk': '1', '@vincentt-xr/harness': '1' })).toHaveLength(2);
  });
});

describe('expectedVersions', () => {
  const npm = { '@vincentt-xr/sdk': '2.0.0-alpha.11', '@vincentt-xr/harness': '3.4.0' };
  const runtime = { '@vincentt-xr/sdk': '2.0.0-alpha.10', '@vincentt-xr/harness': '3.0.0' };

  it('follows npm latest when the template locks no runtime', () => {
    const r = expectedVersions({ runtimeVersion: null, runtimePackages: null, distLatest: npm });
    expect(r.want).toBe(npm);
    expect(r.failures).toEqual([]);
  });

  it("follows the runtime's own versions when the template locks one", () => {
    const r = expectedVersions({ runtimeVersion: '2026.11.0', runtimePackages: runtime, distLatest: npm });
    expect(r.want).toBe(runtime);
    expect(r.source).toBe('runtime 2026.11.0');
    expect(r.failures).toEqual([]);
  });

  it('fails instead of falling back to npm when the runtime manifest is unreadable', () => {
    const r = expectedVersions({ runtimeVersion: '2026.11.0', runtimePackages: null, distLatest: npm });
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain('2026.11.0');
  });

  it('passes a template that locks what its runtime carries, though npm has newer', () => {
    const { want, source } = expectedVersions({ runtimeVersion: '2026.11.0', runtimePackages: runtime, distLatest: npm });
    expect(pinFailures(runtime, want, source)).toEqual([]);
  });

  it('fails a template that locks newer than its runtime, naming the runtime', () => {
    const { want, source } = expectedVersions({ runtimeVersion: '2026.11.0', runtimePackages: runtime, distLatest: npm });
    const failures = pinFailures({ ...runtime, '@vincentt-xr/harness': '3.4.0' }, want, source);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('runtime 2026.11.0 is 3.0.0');
  });
});
