#!/usr/bin/env node
/**
 * itch.io release CLI — cross-platform, Node.js only, no external dependencies.
 *
 * Usage:
 *   node release.js push --source <dir|zip> --target <user/game> [options]
 *   node release.js check [user/game]
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CHANNEL = 'windows';

function usage() {
  console.log(`itch.io release CLI

Usage:
  node release.js push --source <dir|zip> --target <user/game> [options]
  node release.js check [user/game]

Commands:
  push    Upload a build to itch.io with the official butler CLI
  check   Verify butler, credentials, and configuration

Push options:
  -s, --source <path>       Build directory or .zip file (required)
  -t, --target <user/game>  itch.io project (required)
  -c, --channel <name>      Upload channel (default: windows)
  -v, --version <value>     Version passed as --userversion
  -b, --butler <path>       Explicit butler path
      --dry-run             List what would be uploaded, without publishing
      --skip-status         Do not run "butler status" after the push
      --hook <path>         Node.js script run after a successful push
  -h, --help                Show this help

Environment:
  BUTLER_PATH               Override the butler binary path`);
}

class UsageError extends Error {}

/** Directories where the itch.io desktop app bundles butler. */
function brothRoots() {
  if (process.platform === 'win32') {
    return process.env.APPDATA ? [join(process.env.APPDATA, 'itch', 'broth', 'butler')] : [];
  }
  if (process.platform === 'darwin') {
    return [join(homedir(), 'Library', 'Application Support', 'itch', 'broth', 'butler')];
  }
  return [join(homedir(), '.config', 'itch', 'broth', 'butler')];
}

/** Resolution order: explicit path, BUTLER_PATH, bundled butler, PATH. */
function findButler(explicit) {
  if (explicit) return explicit;
  if (process.env.BUTLER_PATH && process.env.BUTLER_PATH.trim()) {
    return process.env.BUTLER_PATH.trim();
  }
  const exe = process.platform === 'win32' ? 'butler.exe' : 'butler';
  for (const root of brothRoots()) {
    try {
      const chosen = join(root, '.chosen-version');
      if (existsSync(chosen)) {
        const candidate = join(root, 'versions', readFileSync(chosen, 'utf8').trim(), exe);
        if (existsSync(candidate)) return candidate;
      }
      const versionsDir = join(root, 'versions');
      if (existsSync(versionsDir)) {
        const versions = readdirSync(versionsDir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort()
          .reverse();
        for (const version of versions) {
          const candidate = join(versionsDir, version, exe);
          if (existsSync(candidate)) return candidate;
        }
      }
    } catch {
      // Ignore inaccessible directories.
    }
  }
  return 'butler';
}

/** Reads optional defaults from cordis.patch.yml. */
function readConfig() {
  const config = { target: '', defaultChannel: '' };
  const patch = join(HERE, 'cordis.patch.yml');
  if (!existsSync(patch)) return config;
  const text = readFileSync(patch, 'utf8');
  const target = text.match(/^\s*target:\s*['"]?([^'"\n#]+)['"]?\s*$/m);
  const channel = text.match(/^\s*defaultChannel:\s*['"]?([^'"\n#]+)['"]?\s*$/m);
  if (target) config.target = target[1].trim();
  if (channel) config.defaultChannel = channel[1].trim();
  return config;
}

function credentialsPath() {
  return join(homedir(), '.config', 'itch', 'butler_creds');
}

function runInherit(file, args, env = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(file, args, {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.on('error', rejectPromise);
    child.on('close', (code, signal) => resolvePromise(code ?? (signal ? 1 : 0)));
  });
}

function capture(file, args) {
  const result = spawnSync(file, args, { encoding: 'utf8' });
  return {
    code: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
    error: result.error,
  };
}

function parseArgs(argv) {
  const flags = {
    source: '',
    target: '',
    channel: '',
    version: '',
    butler: '',
    hook: '',
    dryRun: false,
    skipStatus: false,
  };
  const positionals = [];
  const valueFlags = {
    '--source': 'source', '-s': 'source',
    '--target': 'target', '-t': 'target',
    '--channel': 'channel', '-c': 'channel',
    '--version': 'version', '-v': 'version',
    '--butler': 'butler', '-b': 'butler',
    '--hook': 'hook',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h' || arg === 'help') {
      flags.help = true;
    } else if (arg === '--dry-run') {
      flags.dryRun = true;
    } else if (arg === '--skip-status') {
      flags.skipStatus = true;
    } else if (Object.hasOwn(valueFlags, arg)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('-')) {
        throw new UsageError(`missing value for ${arg}`);
      }
      flags[valueFlags[arg]] = value;
      index += 1;
    } else if (arg.startsWith('-')) {
      throw new UsageError(`unknown option ${arg}`);
    } else {
      positionals.push(arg);
    }
  }
  return { flags, positionals };
}

function normalizeTarget(value) {
  const target = String(value ?? '').trim();
  if (!target) {
    throw new UsageError('missing target; pass --target user/game or configure target in cordis.patch.yml');
  }
  if (!/^[^\s/]+\/[^\s/]+$/.test(target)) {
    throw new UsageError(`invalid target "${target}"; use the user/game format`);
  }
  return target;
}

async function pushCommand(flags) {
  if (!flags.source) throw new UsageError('missing --source (build directory or .zip)');
  const target = normalizeTarget(flags.target);
  const config = readConfig();
  const channel = flags.channel || config.defaultChannel || DEFAULT_CHANNEL;
  const butler = findButler(flags.butler);

  const sourcePath = isAbsolute(flags.source) ? flags.source : resolve(process.cwd(), flags.source);
  if (!existsSync(sourcePath)) {
    throw new Error(`source not found: ${sourcePath}. Build the game and point to the output folder.`);
  }

  const args = ['push'];
  if (flags.dryRun) args.push('--dry-run');
  args.push(sourcePath, `${target}:${channel}`);
  if (flags.version) args.push('--userversion', flags.version);

  console.log(`butler: ${butler}`);
  console.log(`running: ${butler} ${args.join(' ')}\n`);

  try {
    const code = await runInherit(butler, args);
    if (code !== 0) throw new Error(`butler push failed (exit ${code})`);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(
        'butler was not found. Install the itch.io desktop app, pass --butler, or set BUTLER_PATH.',
      );
    }
    throw error;
  }

  if (!flags.skipStatus) {
    console.log(`\nchannel status for ${target}:`);
    await runInherit(butler, ['status', target]);
  }

  if (flags.hook) {
    const hookPath = isAbsolute(flags.hook) ? flags.hook : resolve(process.cwd(), flags.hook);
    if (!existsSync(hookPath)) throw new Error(`hook script not found: ${hookPath}`);
    console.log(`\nrunning post-release hook: ${hookPath}`);
    const code = await runInherit(process.execPath, [hookPath], {
      RELEASE_SOURCE: sourcePath,
      RELEASE_TARGET: target,
      RELEASE_CHANNEL: channel,
      RELEASE_VERSION: flags.version,
    });
    if (code !== 0) throw new Error(`post-release hook failed (exit ${code})`);
  }

  console.log(`\nrelease complete: ${target} (${channel})`);
}

async function checkCommand(positionals) {
  let failures = 0;
  const ok = (message) => console.log(`OK    ${message}`);
  const warn = (message) => console.log(`WARN  ${message}`);
  const fail = (message) => {
    failures += 1;
    console.log(`ERROR ${message}`);
  };

  console.log('itch.io release diagnostics\n');

  const butler = findButler('');
  const probe = capture(butler, ['--version']);
  if (probe.error) {
    fail(`butler not found (install the itch.io desktop app, set BUTLER_PATH, or pass --butler)`);
  } else {
    ok(`butler: ${butler}`);
    console.log(`      ${probe.output}`);
  }

  const creds = credentialsPath();
  if (existsSync(creds)) ok(`butler credentials: ${creds} (${statSync(creds).size} bytes)`);
  else warn('no butler credentials; run: butler login');

  const config = readConfig();
  if (config.target) ok(`configured target: ${config.target}`);
  else warn('target not configured (pass --target or set it in cordis.patch.yml)');

  const targetCandidate = (positionals[0] || config.target || '').trim();
  if (targetCandidate) {
    const target = normalizeTarget(targetCandidate);
    if (probe.error === undefined) {
      console.log(`\nbutler status for ${target}:`);
      const code = await runInherit(butler, ['status', target]);
      if (code !== 0) fail(`butler status failed (exit ${code})`);
    }
  }

  console.log(failures === 0 ? '\ndiagnostics finished without failures.' : `\ndiagnostics finished with ${failures} failure(s).`);
  if (failures > 0) process.exitCode = 1;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    usage();
    return;
  }
  const command = argv[0];
  const { flags, positionals } = parseArgs(argv.slice(1));
  if (flags.help) {
    usage();
    return;
  }
  if (command === 'push') await pushCommand(flags);
  else if (command === 'check') await checkCommand(positionals);
  else throw new UsageError(`unknown command "${command}"`);
}

try {
  await main();
} catch (error) {
  if (error instanceof UsageError) {
    console.error(`Error: ${error.message}\n`);
    usage();
    process.exitCode = 2;
  } else {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}
