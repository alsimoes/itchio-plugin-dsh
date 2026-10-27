#!/usr/bin/env node
/**
 * Diagnostics for the itch.io release environment.
 * Checks butler, its version, credentials, and the plugin configuration.
 *
 * Usage: node test-release.js [user/game]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const targetArg = process.argv[2];

function findButler() {
  if (process.env.BUTLER_PATH && existsSync(process.env.BUTLER_PATH)) return process.env.BUTLER_PATH;
  const exe = process.platform === 'win32' ? 'butler.exe' : 'butler';
  const roots = [];
  if (process.platform === 'win32') {
    if (process.env.APPDATA) roots.push(join(process.env.APPDATA, 'itch', 'broth', 'butler'));
  } else if (process.platform === 'darwin') {
    roots.push(join(homedir(), 'Library', 'Application Support', 'itch', 'broth', 'butler'));
  } else {
    roots.push(join(homedir(), '.config', 'itch', 'broth', 'butler'));
  }
  for (const rootDir of roots) {
    try {
      const chosen = join(rootDir, '.chosen-version');
      if (existsSync(chosen)) {
        const candidate = join(rootDir, 'versions', readFileSync(chosen, 'utf8').trim(), exe);
        if (existsSync(candidate)) return candidate;
      }
      const versions = join(rootDir, 'versions');
      if (existsSync(versions)) {
        const dirs = readdirSync(versions, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort()
          .reverse();
        for (const version of dirs) {
          const candidate = join(versions, version, exe);
          if (existsSync(candidate)) return candidate;
        }
      }
    } catch {
      // Ignore inaccessible directories.
    }
  }
  return null;
}

let failures = 0;
function ok(message) { console.log(`OK    ${message}`); }
function warn(message) { console.log(`WARN  ${message}`); }
function fail(message) { failures += 1; console.log(`ERROR ${message}`); }

console.log('itch.io Plugin diagnostics\n');

const butler = findButler();
if (butler) {
  ok(`butler: ${butler}`);
  const version = spawnSync(butler, ['--version'], { encoding: 'utf8' });
  const versionText = `${version.stdout ?? ''}${version.stderr ?? ''}`.trim();
  if (versionText) console.log(`      ${versionText}`);
  else fail(`butler did not run: ${version.error?.message ?? 'no output'}`);
} else {
  warn('butler not found (install the itch.io desktop app or set BUTLER_PATH)');
}

const creds = join(homedir(), '.config', 'itch', 'butler_creds');
if (existsSync(creds)) {
  ok(`butler credentials: ${creds} (${statSync(creds).size} bytes)`);
} else {
  warn('no butler credentials. Run: butler login');
}

const patchPath = join(root, 'cordis.patch.yml');
let configuredTarget = '';
if (existsSync(patchPath)) {
  const patch = readFileSync(patchPath, 'utf8');
  const match = patch.match(/^\s*target:\s*['"]?([^'"\n#]+)['"]?\s*$/m);
  if (match) configuredTarget = match[1].trim();
  ok('cordis.patch.yml found');
} else {
  warn('cordis.patch.yml not found');
}

const target = targetArg || configuredTarget;
if (target) {
  ok(`target: ${target}`);
  if (butler) {
    try {
      console.log('\nbutler status:');
      console.log(execFileSync(butler, ['status', target], { encoding: 'utf8' }).trim());
    } catch (error) {
      fail(`butler status failed: ${error.message}`);
    }
  }
} else {
  warn('target not configured. Use: node test-release.js user/game');
}

console.log(failures === 0 ? '\nDiagnostics finished without failures.' : `\nDiagnostics finished with ${failures} failure(s).`);
process.exitCode = failures === 0 ? 0 : 1;
