// Daily check of what `vincentt init` actually hands a creator: the `latest`
// tag. Fails when `latest` is not the highest release tag (a release job died
// before moving it), or when the SDK/harness versions locked at `latest` are
// not the ones the template should follow (a package shipped and the template
// never followed). A template on the shared runtime follows the versions that
// runtime carries, since its build loads them from the runtime and a newer local
// copy would be bundled beside it; otherwise it follows npm's `latest` dist-tag.
// Reads the repo this file lives in; tags must be fetched.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const POINTER = 'latest';
export const FOLLOWED = ['@vincentt-xr/sdk', '@vincentt-xr/harness'];
export const RUNTIME = '@vincentt-xr/runtime';
// The production runtime: `latest` is what a creator scaffolds, and prod is
// where a released runtime version is guaranteed to exist.
export const RUNTIME_ORIGIN = 'https://runtime.vincentt.studio';

const RELEASE_TAG = /^(\d+)\.(\d+)\.(\d+)$/;

export function highestReleaseTag(tags) {
  let best = null;
  for (const tag of tags) {
    const m = RELEASE_TAG.exec(tag.trim());
    if (!m) continue;
    const parts = m.slice(1).map(Number);
    if (!best || compareParts(parts, best.parts) > 0) best = { tag: tag.trim(), parts };
  }
  return best?.tag ?? null;
}

function compareParts(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// The version the root importer resolves `pkg` to. The lockfile, not the
// package.json specifier, is what a scaffold installs: `^1.5.0` says nothing
// about which 1.x a creator gets.
export function lockedVersion(lockText, pkg) {
  const lines = lockText.split('\n');
  const start = lines.findIndex((l) => l === 'importers:');
  if (start === -1) return null;
  const rootAt = lines.findIndex((l, i) => i > start && l === '  .:');
  if (rootAt === -1) return null;
  const keys = [`      '${pkg}':`, `      ${pkg}:`];
  for (let i = rootAt + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^ {0,2}\S/.test(line)) break;
    if (!keys.includes(line)) continue;
    for (let j = i + 1; j < lines.length && lines[j].startsWith('        '); j += 1) {
      const m = /^ {8}version: ([^(\s]+)/.exec(lines[j]);
      if (m) return m[1];
    }
    return null;
  }
  return null;
}

export function pointerFailures({ pointerSha, highestTag, highestSha }) {
  if (!highestTag) return ['no bare-semver release tag found'];
  if (!pointerSha) return [`tag \`${POINTER}\` does not exist`];
  if (pointerSha !== highestSha) {
    return [
      `\`${POINTER}\` is at ${pointerSha}, but the highest release tag ${highestTag} is at ${highestSha}; the release job for ${highestTag} did not move \`${POINTER}\``,
    ];
  }
  return [];
}

/**
 * The versions the template should lock, and where they come from: the shared
 * runtime's own package versions when the template locks a runtime, npm's
 * `latest` dist-tags otherwise. A runtime whose manifest could not be read is a
 * failure, never a silent fall back to npm.
 */
export function expectedVersions({ runtimeVersion, runtimePackages, distLatest }) {
  if (!runtimeVersion) return { want: distLatest, source: 'npm `latest`', failures: [] };
  if (!runtimePackages) {
    return {
      want: {},
      source: `runtime ${runtimeVersion}`,
      failures: [`the template at \`${POINTER}\` locks ${RUNTIME} ${runtimeVersion}, but its manifest could not be read`],
    };
  }
  return { want: runtimePackages, source: `runtime ${runtimeVersion}`, failures: [] };
}

export function pinFailures(locked, want, source = 'npm `latest`') {
  const failures = [];
  for (const pkg of FOLLOWED) {
    const have = locked[pkg];
    const expected = want[pkg];
    if (!have) failures.push(`${pkg} is not locked in the template at \`${POINTER}\``);
    else if (!expected) failures.push(`${pkg} has no version in ${source}`);
    else if (have !== expected) {
      failures.push(`${pkg}: the template at \`${POINTER}\` locks ${have}, ${source} is ${expected}`);
    }
  }
  return failures;
}

async function runtimePackagesFor(version) {
  try {
    const res = await fetch(`${RUNTIME_ORIGIN}/v/${version}/manifest.json`, { redirect: 'error' });
    if (!res.ok) return null;
    const manifest = await res.json();
    if (manifest?.version !== version || typeof manifest.packages !== 'object' || manifest.packages === null) {
      return null;
    }
    return manifest.packages;
  } catch {
    return null;
  }
}

function git(...args) {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function tagSha(tag) {
  try {
    return git('rev-list', '-n1', `refs/tags/${tag}`);
  } catch {
    return null;
  }
}

async function main() {
  const highestTag = highestReleaseTag(git('tag', '-l').split('\n'));
  const failures = pointerFailures({
    pointerSha: tagSha(POINTER),
    highestTag,
    highestSha: highestTag ? tagSha(highestTag) : null,
  });

  if (tagSha(POINTER)) {
    const lockText = git('show', `refs/tags/${POINTER}:pnpm-lock.yaml`);
    const locked = {};
    const distLatest = {};
    for (const pkg of FOLLOWED) {
      locked[pkg] = lockedVersion(lockText, pkg);
      const tags = JSON.parse(
        execFileSync('npm', ['view', pkg, 'dist-tags', '--json'], { encoding: 'utf8' }),
      );
      distLatest[pkg] = tags.latest ?? null;
    }
    const runtimeVersion = lockedVersion(lockText, RUNTIME);
    const runtimePackages = runtimeVersion ? await runtimePackagesFor(runtimeVersion) : null;
    const { want, source, failures: sourceFailures } = expectedVersions({
      runtimeVersion,
      runtimePackages,
      distLatest,
    });
    for (const pkg of FOLLOWED) {
      const npmNote = runtimeVersion ? `, npm latest ${distLatest[pkg]}` : '';
      console.log(`${pkg}: locked at \`${POINTER}\` ${locked[pkg]}, ${source} ${want[pkg] ?? '?'}${npmNote}`);
    }
    failures.push(...sourceFailures, ...pinFailures(locked, want, source));
  }

  console.log(`\`${POINTER}\` -> ${tagSha(POINTER)}; highest release tag ${highestTag}`);
  if (failures.length === 0) console.log('OK');
  for (const f of failures) console.log(`::error::${f}`);
  process.exit(failures.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
