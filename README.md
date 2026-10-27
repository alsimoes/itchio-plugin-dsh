# itch.io Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](#platform-support)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-plugin-5b21b6.svg)](#installation)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin and a standalone Node.js CLI for publishing game builds to **itch.io** through the official **butler** CLI.

> This project is not affiliated with or endorsed by itch.io. itch.io and butler are products of itch.io.

## Overview

Uploading builds by hand is repetitive and easy to get wrong. This project wraps the official [`butler`](https://itch.io/docs/butler/) workflow in two ways:

- **A DeepSeek Harness plugin** that registers `itchio_push` and `itchio_status` tools, so an agent can publish and inspect builds directly.
- **A standalone `release.js` CLI** that works without the harness, for local or CI use.

Both paths call the same `butler` binary, so behavior is identical and no custom upload protocol is involved.

Everything except butler itself is Node.js. There is no platform-specific code, no shell wrapper, and no PowerShell dependency: the plugin, the CLI, the diagnostics, and the example hook run identically on Windows, macOS, and Linux.

## Platform support

| Capability | Windows | macOS | Linux |
|------------|---------|-------|-------|
| DeepSeek Harness plugin | ✅ | ✅ | ✅ |
| `release.js` CLI | ✅ | ✅ | ✅ |
| Automatic butler detection | ✅ | ✅ | ✅ |
| Diagnostics (`check`) | ✅ | ✅ | ✅ |
| Node.js post-release hook | ✅ | ✅ | ✅ |

Requirements are the same everywhere: Node.js and butler.

## Features

- One-command upload: `butler push <build> <user/game>:<channel>`.
- Channel status inspection with `itchio_status` / `butler status`.
- Automatic butler detection: bundled with the itch.io desktop app, `BUTLER_PATH`, or `PATH`.
- Dry-run mode to preview the upload without publishing.
- Optional post-release hook, written in Node.js.
- Runs on Windows, macOS, and Linux with the same commands.
- Zero npm dependencies for the plugin and the CLI.
- Credentials stay in butler's own store; no API keys are kept in this repository or plugin config.

## Requirements

| Requirement | Notes |
|-------------|-------|
| **butler** | Bundled with the itch.io desktop app, or installed standalone. |
| **Authentication** | Run `butler login` once. butler stores credentials at `~/.config/itch/butler_creds` unless `--identity` is used. |
| **Node.js 18+** | Used by the plugin, the CLI, and the diagnostics. The DeepSeek Harness already runs on Node.js. |
| **itch.io project** | A slug in the form `user/game`. |

### Installing butler

The itch.io desktop app bundles butler and keeps it updated, which is the simplest option on every platform. To install the standalone CLI instead, download it from the [butler page](https://itchio.itch.io/butler), or use the automation-friendly broth URLs described in the [official installation guide](https://itch.io/docs/butler/installing.html).

**Windows** — extract the `.zip`, add the folder to `PATH`, then run:

```bash
butler login
```

**macOS / Linux** — extract the archive, make the binary executable, and add its folder to `PATH`:

```bash
chmod +x butler
./butler login
```

Verify the installation on any platform:

```bash
butler version
```

The plugin and CLI search for butler in this order: an explicit `--butler`/`butlerPath` value, the `BUTLER_PATH` environment variable, the itch.io desktop app's data directory, then `PATH`. The app-bundled locations are:

| OS | Bundled butler root |
|----|---------------------|
| Windows | `%APPDATA%\itch\broth\butler` |
| macOS | `~/Library/Application Support/itch/broth/butler` |
| Linux | `~/.config/itch/broth/butler` |

## Installation

### As a DeepSeek Harness plugin

The installation is identical on Windows, macOS, and Linux:

1. Clone this repository:
   ```bash
   git clone https://github.com/alsimoes/itchio-plugin-dsh.git
   ```
2. Install the bundle in the harness profile, passing the **absolute path** to the checkout:
   ```
   plugin_manager install_bundle target="<path-to-checkout>"
   ```
3. Configure the default project slug in `cordis.patch.yml` (see [Configuration](#configuration)), or pass `target` on every tool call.

The bundle registers a single row with id `itchio-manager`.

### Standalone CLI

No installation is required. Clone the repository and run the CLI with Node.js (see [CLI reference](#cli-reference)). The same commands work on every platform.

## Quick start

```bash
# Preview the upload without publishing
node release.js push --source ./dist --target youruser/yourgame --channel windows --dry-run

# Publish for real
node release.js push --source ./dist --target youruser/yourgame --channel windows --version 1.0.0

# Verify the environment
node release.js check
```

The commands are identical on Windows, macOS, and Linux. If you prefer, the CLI is also executable on Unix-like systems: `./release.js push ...`.

If PowerShell, batch, or Bash is unavailable, that is not a problem: only Node.js is needed.

After a successful push, the CLI prints `butler status` and runs the hook passed with `--hook`, if any.

## Tools (DeepSeek Harness)

### `itchio_push`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source` | string | yes | Build directory or `.zip` file. Absolute, or relative to the session working directory. |
| `target` | string | no | itch.io project as `user/game`. Defaults to the `target` config value. |
| `channel` | string | no | Upload channel. Defaults to `defaultChannel` (then `windows`). |
| `version` | string | no | Version shown on itch.io (`--userversion`). |
| `dryRun` | boolean | no | List what would be uploaded without publishing. |

### `itchio_status`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `target` | string | no | itch.io project as `user/game`. Defaults to the `target` config value. |

## CLI reference

### Commands

| Command | Description |
|---------|-------------|
| `push` | Upload a build to itch.io with butler. |
| `check` | Verify butler, credentials, config, and optionally channel status. |

### `push` options

| Option | Required | Description |
|--------|----------|-------------|
| `-s`, `--source <path>` | yes | Build directory or `.zip` file to upload. |
| `-t`, `--target <user/game>` | yes | itch.io project slug. |
| `-c`, `--channel <name>` | no | Upload channel. Default: `windows` (or `defaultChannel` from config). |
| `-v`, `--version <value>` | no | Version string passed as `--userversion`. |
| `-b`, `--butler <path>` | no | Explicit butler path. |
| `--dry-run` | no | List what would be uploaded, without publishing. |
| `--skip-status` | no | Skip the final `butler status` call. |
| `--hook <path>` | no | Node.js script executed after a successful push. |

### `check`

```bash
node release.js check            # uses the configured target, if any
node release.js check user/game  # also queries channel status
```

## Configuration

The plugin reads configuration from `cordis.patch.yml` (see [`example-config.yml`](example-config.yml)):

```yaml
- insert:
    - id: itchio-manager
      name: 'itchio-plugin-dsh'
      config:
        target: 'user/game'      # required for push/status when not passed per call
        defaultChannel: windows  # default channel
        butlerPath: ''           # empty = auto-detect
```

| Option | Default | Description |
|--------|---------|-------------|
| `target` | empty | itch.io project slug (`user/game`). |
| `defaultChannel` | `windows` | Channel used when a tool call omits `channel`. |
| `butlerPath` | empty | Explicit butler path. Empty enables auto-detection. |

The CLI reads `target` and `defaultChannel` from the same file as fallback defaults.

## Channels

The channel name determines the initial platform tags on itch.io:

| Channel | Platform |
|---------|----------|
| `windows` / `win64` | Windows |
| `linux` | Linux |
| `osx` / `mac` | macOS |
| `windows-beta` | Windows (test channel) |

A channel may combine platforms (for example `win-linux-mac`). Tags can be adjusted later on the itch.io game page.

## Typical workflow

The pattern is the same on every platform: build, stage a clean output folder, then push with the same CLI command.

### Windows

```bat
cargo build --release

mkdir dist\windows
copy target\release\mygame.exe dist\windows\
xcopy assets dist\windows\assets /E /I /Y

node release.js push --source dist\windows --target youruser/mygame --channel windows --version 1.0.0
```

### macOS

```bash
cargo build --release

dist="dist/macos"
mkdir -p "$dist"
cp -R "target/release/bundle/osx/MyGame.app" "$dist/"   # with cargo-bundle; otherwise copy the binary
cp -R assets "$dist/"

node release.js push --source "$dist" --target youruser/mygame --channel osx --version 1.0.0
```

### Linux

```bash
cargo build --release

dist="dist/linux"
mkdir -p "$dist"
cp target/release/mygame "$dist/"
cp -R assets "$dist/"

node release.js push --source "$dist" --target youruser/mygame --channel linux --version 1.0.0
```

Push only the final build folder. Avoid uploading intermediate directories such as `target/`, and exclude debug symbols or caches. On macOS, push the `.app` bundle rather than loose binaries so symlinks and frameworks are preserved.

## Post-release hooks

Hooks are opt-in and written in Node.js, so they run on every platform. After a successful push, the CLI runs the script passed with `--hook`:

```bash
node release.js push --source ./dist --target youruser/mygame \
  --hook ./examples/post-release-hook.js
```

See [`examples/post-release-hook.js`](examples/post-release-hook.js). The hook receives the release details through environment variables: `RELEASE_SOURCE`, `RELEASE_TARGET`, `RELEASE_CHANNEL`, and `RELEASE_VERSION`.

## Diagnostics

```bash
node release.js check
node release.js check user/game
```

This checks butler, its version, credentials, and the configured target, and can query channel status. It works identically on all platforms and needs only Node.js.

## Project structure

```
.
├── index.js                        # DeepSeek Harness plugin (Host half)
├── cordis.patch.yml                # Bundle patch (plugin row and config)
├── example-config.yml              # Configuration example
├── locale/en.json                  # Plugin display metadata
├── icon.svg                        # Plugin icon
├── release.js                      # Standalone Node.js CLI (all platforms)
├── examples/
│   └── post-release-hook.js        # Optional Node.js hook, passed with --hook
├── LICENSE.md                      # MIT license
└── README.md
```

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `butler` is not recognized | Install the itch.io desktop app, pass `--butler`, or set `BUTLER_PATH`. |
| `Permission denied` when running butler (macOS/Linux) | Run `chmod +x butler` on the extracted binary. |
| macOS blocks the butler binary | Allow it in System Settings → Privacy & Security, or remove the quarantine attribute with `xattr -d com.apple.quarantine butler`. |
| `node: command not found` | Install Node.js 18+ (the DeepSeek Harness already provides a compatible runtime). |
| `required argument 'target'` | Pass `--target user/game` or configure `target`. |
| `invalid target` or `403` | Wrong slug, or the project does not belong to the authenticated account. |
| Authentication errors | Run `butler login` and retry. |
| First push is slow | Expected: the first upload sends the full build; later pushes send deltas. |
| `--hidden` fails on existing channel | Hidden uploads are only supported when a channel is first created. |

## Security

- Never commit API keys or credentials. butler keeps its token in its own credentials file outside this repository.
- Do not place API keys in `cordis.patch.yml`.
- If a key is exposed, revoke it in the itch.io account settings and run `butler login` again.

## Contributing

Issues and pull requests are welcome. Keep changes focused, run `node release.js check` before submitting, and update the README when behavior changes. Platform-specific code is out of scope: the project targets Node.js on all platforms.

## License

Released under the [MIT License](LICENSE.md).

Copyright (c) 2026 André Simões.
