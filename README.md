# itch.io Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](#requirements)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-plugin-5b21b6.svg)](#installation)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin and a standalone PowerShell script for publishing game builds to **itch.io** through the official **butler** CLI.

> This project is not affiliated with or endorsed by itch.io. itch.io and butler are products of itch.io.

## Overview

Uploading builds by hand is repetitive and easy to get wrong. This project wraps the official [`butler`](https://itch.io/docs/butler/) workflow in two ways:

- **A DeepSeek Harness plugin** that registers `itchio_push` and `itchio_status` tools, so an agent can publish and inspect builds directly.
- **A standalone `release.ps1` script** that works without the harness, for local or CI use.

Both paths call the same `butler` binary, so behavior is identical and no custom upload protocol is involved.

## Features

- One-command upload: `butler push <build> <user/game>:<channel>`.
- Channel status inspection with `itchio_status` / `butler status`.
- Automatic butler detection: bundled with the itch.io desktop app, `BUTLER_PATH`, or `PATH`.
- Dry-run mode to preview the upload without publishing.
- Optional post-release hook script.
- Cross-platform: Windows, macOS, and Linux (standalone script requires PowerShell).
- Zero runtime dependencies for the plugin.
- Credentials stay in butler's own store; no API keys are kept in this repository or plugin config.

## Requirements

- **butler** — bundled with the itch.io desktop app (v26.12.0 or later), or installed standalone.
- **Authentication** — run `butler login` once, or provide a credentials file. butler stores it at `~/.config/itch/butler_creds` by default.
- **An itch.io project** with a slug in the form `user/game`.
- **Node.js 18+** to run the DeepSeek Harness plugin.
- **PowerShell 5.1+** (Windows) or **PowerShell 7+** (macOS/Linux) to run the standalone script.

## Installation

### As a DeepSeek Harness plugin

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

### Standalone script

No installation is required. Download or clone the repository and run `release.ps1` (see [Standalone script reference](#standalone-script-reference)).

## Quick start

```powershell
# 1. Preview the upload without publishing
./release.ps1 -Source ./dist -Target youruser/yourgame -Channel windows -DryRun

# 2. Publish for real
./release.ps1 -Source ./dist -Target youruser/yourgame -Channel windows -Version 1.0.0
```

After a successful push, the script prints `butler status` and runs `.itchio-release-hook.ps1` if it exists.

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

## Standalone script reference

`release.ps1` parameters:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `-Source` | yes | Build directory or `.zip` file to upload. |
| `-Target` | yes | itch.io project in `user/game` format. |
| `-Channel` | no | Upload channel. Default: `windows`. |
| `-Version` | no | Version string passed as `--userversion`. |
| `-ButlerPath` | no | Explicit path to the butler executable. |
| `-DryRun` | no | Preview the upload without publishing. |
| `-SkipStatus` | no | Skip the final `butler status` call. |
| `-HookPath` | no | Custom post-release hook script. |
| `-NoHook` | no | Do not run any post-release hook. |

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

Example for a Rust/Bevy game. The same pattern applies to any engine: build, stage a clean output folder, then push.

```powershell
# 1. Build the game
cargo build --release

# 2. Stage a clean distribution folder
$dist = "dist/windows"
New-Item -ItemType Directory -Force $dist | Out-Null
Copy-Item target/release/mygame.exe $dist
Copy-Item assets $dist -Recurse -Force
Copy-Item README.md $dist -ErrorAction SilentlyContinue

# 3. Publish
./release.ps1 -Source $dist -Target youruser/mygame -Channel windows -Version 1.0.0
```

Push only the final build folder. Avoid uploading intermediate directories such as `target/`, and exclude debug symbols or caches.

## Post-release hooks

After a successful push, `release.ps1` runs `.itchio-release-hook.ps1` from the repository root, unless `-NoHook` is passed. Use it for notifications, changelog updates, or opening the game page. A minimal hook is included in this repository.

## Diagnostics

```powershell
./install.ps1                 # checks butler, its version, and credentials
node test-release.js          # same checks plus the configured target
node test-release.js user/game
```

## Project structure

```
.
├── index.js                  # DeepSeek Harness plugin (Host half)
├── cordis.patch.yml          # Bundle patch (plugin row and config)
├── example-config.yml        # Configuration example
├── locale/en.json            # Plugin display metadata
├── icon.svg                  # Plugin icon
├── release.ps1               # Standalone release script
├── install.ps1/.bat/.sh      # Environment checks
├── test-release.js           # Node.js diagnostics
├── .itchio-release-hook.ps1  # Optional post-release hook
├── LICENSE.md                # MIT license
└── README.md
```

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `butler` is not recognized | Install the itch.io desktop app, pass `-ButlerPath`, or set `BUTLER_PATH`. |
| `required argument 'target'` | Pass `-Target user/game` or configure `target`. |
| `invalid target` or `403` | Wrong slug, or the project does not belong to the authenticated account. |
| Authentication errors | Run `butler login` and retry. |
| First push is slow | Expected: the first upload sends the full build; later pushes send deltas. |
| `--hidden` fails on existing channel | Hidden uploads are only supported when a channel is first created. |

## Security

- Never commit API keys or credentials. butler keeps its token in its own credentials file outside this repository.
- Do not place API keys in `cordis.patch.yml`.
- If a key is exposed, revoke it in the itch.io account settings and run `butler login` again.

## Contributing

Issues and pull requests are welcome. Keep changes focused, run the diagnostics before submitting, and update the README when behavior changes.

## License

Released under the [MIT License](LICENSE.md).

Copyright (c) 2026 André Simões.
