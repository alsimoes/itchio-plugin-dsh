/**
 * itch.io Release Manager — Host plugin for the DeepSeek Harness.
 *
 * Uploads builds to itch.io through the official butler CLI
 * (https://itch.io/docs/butler/), the only supported upload tool.
 *
 * Authentication: butler reads its credentials file
 * (`~/.config/itch/butler_creds`, created by `butler login`).
 * Set BUTLER_PATH or the `butlerPath` config option to override the binary.
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

/** Plugin identity. */
export const name = 'itchio-manager';

/** Required services: tool registry and the session working directory. */
export const inject = ['tools', 'workingDirectory'];

const DEFAULT_CHANNEL = 'windows';
const MAX_BUFFER = 4 * 1024 * 1024;
const MAX_TEXT = 8000;

/** Directories where the itch.io desktop app bundles butler. */
function brothRoots() {
  if (process.platform === 'win32') {
    return process.env.APPDATA ? [join(process.env.APPDATA, 'itch', 'broth', 'butler')] : [];
  }
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home) return [];
  if (process.platform === 'darwin') {
    return [join(home, 'Library', 'Application Support', 'itch', 'broth', 'butler')];
  }
  return [join(home, '.config', 'itch', 'broth', 'butler')];
}

/** Locates the butler binary bundled by the itch.io desktop app, if present. */
function butlerFromBroth() {
  const exe = process.platform === 'win32' ? 'butler.exe' : 'butler';
  for (const root of brothRoots()) {
    try {
      const chosen = join(root, '.chosen-version');
      if (existsSync(chosen)) {
        const version = readFileSync(chosen, 'utf8').trim();
        const candidate = join(root, 'versions', version, exe);
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
      // Inaccessible directory: try the next candidate.
    }
  }
  return undefined;
}

/** Resolution order: plugin config, BUTLER_PATH, bundled butler, PATH. */
function resolveButlerPath(config) {
  if (typeof config.butlerPath === 'string' && config.butlerPath.trim()) {
    return config.butlerPath.trim();
  }
  if (process.env.BUTLER_PATH && process.env.BUTLER_PATH.trim()) {
    return process.env.BUTLER_PATH.trim();
  }
  return butlerFromBroth() ?? 'butler';
}

/** Runs a process and resolves with its exit code, stdout, and stderr. */
function runProcess(file, args, options = {}) {
  return new Promise((resolvePromise) => {
    execFile(
      file,
      args,
      { windowsHide: true, maxBuffer: MAX_BUFFER, ...options },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
        resolvePromise({
          code,
          missing: Boolean(error && error.code === 'ENOENT'),
          stdout: String(stdout ?? ''),
          stderr: String(stderr ?? ''),
        });
      },
    );
  });
}

async function runButler(butlerPath, args, signal) {
  const result = await runProcess(butlerPath, args, { signal });
  if (result.missing) {
    throw new Error(
      `butler was not found at "${butlerPath}". Install the itch.io app, set BUTLER_PATH, or configure butlerPath.`,
    );
  }
  return result;
}

function clip(text) {
  const value = String(text ?? '');
  return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}\n… (output truncated)` : value;
}

function makeValue(ok, command, result) {
  return {
    ok,
    command,
    exitCode: result.code,
    stdout: clip(result.stdout),
    stderr: clip(result.stderr),
  };
}

function render(label, value) {
  const lines = [value.ok ? `✅ ${label}` : `❌ ${label}`, `$ ${value.command}`];
  if (value.stdout.trim()) lines.push(clip(value.stdout.trim()));
  if (value.stderr.trim()) lines.push(`stderr:\n${clip(value.stderr.trim())}`);
  lines.push(`exit code: ${value.exitCode}`);
  return [{ type: 'text', text: lines.join('\n') }];
}

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    command: { type: 'string' },
    exitCode: { type: 'integer' },
    stdout: { type: 'string' },
    stderr: { type: 'string' },
  },
  required: ['ok', 'command', 'exitCode', 'stdout', 'stderr'],
};

/** Effective session working directory, falling back to the process cwd. */
async function sessionDirectory(ctx, exec) {
  try {
    if (exec.agent && ctx.workingDirectory) {
      return await ctx.workingDirectory.ensure(exec.agent, exec.signal);
    }
  } catch {
    // Service unavailable: fall back to the process working directory.
  }
  return process.cwd();
}

function normalizeTarget(value) {
  const target = String(value ?? '').trim();
  if (!target) {
    throw new Error('Provide target as "user/game" or set target in the plugin config.');
  }
  if (!/^[^\s/]+\/[^\s/]+$/.test(target)) {
    throw new Error(`Invalid target "${target}". Use the "user/game" format, for example youruser/mygame.`);
  }
  return target;
}

function pushTool(ctx, config, butlerPath) {
  return {
    name: 'itchio_push',
    description:
      'Pushes a build (directory or .zip) to itch.io using the official butler CLI. Run it after building the game. Example: source "dist", target "user/game", channel "windows".',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        source: {
          type: 'string',
          description:
            'Directory or .zip file of the build to upload. Absolute, or relative to the session working directory.',
        },
        target: {
          type: 'string',
          description: 'itch.io project as "user/game". Defaults to the target config value.',
        },
        channel: {
          type: 'string',
          description: 'Upload channel: windows, linux, osx, windows-beta, etc. Defaults to defaultChannel.',
        },
        version: {
          type: 'string',
          description: 'Version shown on itch.io (--userversion), for example 1.0.0.',
        },
        dryRun: {
          type: 'boolean',
          description: 'Only list what would be uploaded, without publishing.',
        },
      },
      required: ['source'],
    },
    output: {
      schema: RESULT_SCHEMA,
      render: (args, value) => render(`butler push ${args.source}`, value),
    },
    async execute(input, exec) {
      const target = normalizeTarget(input.target ?? config.target);
      const channel =
        (typeof input.channel === 'string' && input.channel.trim()) ||
        (typeof config.defaultChannel === 'string' && config.defaultChannel.trim()) ||
        DEFAULT_CHANNEL;
      const cwd = await sessionDirectory(ctx, exec);
      const sourcePath = isAbsolute(input.source) ? input.source : resolve(cwd, input.source);
      if (!existsSync(sourcePath)) {
        throw new Error(`Source not found: ${sourcePath}. Build the game and point to the output folder.`);
      }

      const args = ['push'];
      if (input.dryRun) args.push('--dry-run');
      args.push(sourcePath, `${target}:${channel}`);
      if (typeof input.version === 'string' && input.version.trim()) {
        args.push('--userversion', input.version.trim());
      }

      const command = `${butlerPath} ${args.join(' ')}`;
      const result = await runButler(butlerPath, args, exec.signal);
      return makeValue(result.code === 0, command, result);
    },
  };
}

function statusTool(ctx, config, butlerPath) {
  return {
    name: 'itchio_status',
    description:
      'Shows the channels and latest build status of an itch.io project using butler status.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        target: {
          type: 'string',
          description: 'itch.io project as "user/game". Defaults to the target config value.',
        },
      },
    },
    output: {
      schema: RESULT_SCHEMA,
      render: (args, value) => render(`butler status ${args.target ?? config.target ?? ''}`.trim(), value),
    },
    async execute(input, exec) {
      const target = normalizeTarget(input.target ?? config.target);
      const args = ['status', target];
      const command = `${butlerPath} ${args.join(' ')}`;
      const result = await runButler(butlerPath, args, exec.signal);
      return makeValue(result.code === 0, command, result);
    },
  };
}

/**
 * Registers the itch.io release tools.
 * @param ctx Cordis plugin context.
 * @param config Configuration from cordis.patch.yml.
 */
export function apply(ctx, config) {
  const settings = config && typeof config === 'object' ? config : {};
  const butlerPath = resolveButlerPath(settings);
  ctx.tools.register(pushTool(ctx, settings, butlerPath));
  ctx.tools.register(statusTool(ctx, settings, butlerPath));
}
