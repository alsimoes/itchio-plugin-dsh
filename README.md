# itch.io Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](#platform-support)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-plugin-5b21b6.svg)](#installation)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin and a standalone PowerShell script for publishing game builds to **itch.io** through the official **butler** CLI.

> This project is not affiliated with or endorsed by itch.io. itch.io and butler are products of itch.io.

## Overview

Uploading builds by hand is repetitive and easy to get wrong. This project wraps the official [`butler`](https://itch.io/docs/butler/) workflow in two ways:

- **A DeepSeek Harness plugin** that registers `itchio_push` and `itchio_status` tools, so an agent can publish and inspect builds directly.
- **A standalone `release.ps1` script** that works without the harness, for local or CI use.

Both paths call the same `butler` binary, so behavior is identical and no custom upload protocol is involved.

## Platform support

The plugin is pure Node.js/ES modules with no native dependencies, so it runs wherever the DeepSeek Harness runs. The standalone script requires PowerShell, which is available on all three platforms.

| Capability | Windows | macOS | Linux |
|------------|---------|-------|-------|
| DeepSeek Harness plugin | ✅ | ✅ | ✅ |
| Automatic butler detection | ✅ | ✅ | ✅ |
| `release.ps1` (PowerShell 7+) | ✅ | ✅ | ✅ |
| `install.sh` (bash diagnostics) | Git Bash / WSL | ✅ | ✅ |
| Post-release hook | ✅ | ✅ (PowerShell 7+) | ✅ (PowerShell 7+) |

No platform-specific build step is needed: install the plugin, make `butler` reachable, and run the same commands.

## Features

- One-command upload: `butler push <build> <user/game>:<channel>`.
- Channel status inspection with `itchio_status` / `butler status`.
- Automatic butler detection: bundled with the itch.io desktop app, `BUTLER_PATH`, or `PATH`.
- Dry-run mode to preview the upload without publishing.
- Optional post-release hook script.
- Runs on Windows, macOS, and Linux.
- Zero runtime dependencies for the plugin.
- Credentials stay in butler's own store; no API keys are kept in this repository or plugin config.

## Requirements

| Requirement | Windows | macOS | Linux |
|-------------|---------|-------|-------|
| butler | itch.io desktop app, or standalone | itch.io desktop app, or standalone | itch.io desktop app, or standalone |
| Authentication | `butler login` (once) | `butler login` (once) | `butler login` (once) |
| Plugin runtime | Node.js 18+ (provided by DeepSeek Harness) | same | same |
| Standalone script | PowerShell 5.1+ or 7+ | PowerShell 7+ | PowerShell 7+ |
| itch.io project | `user/game` slug | same | same |

### Installing butler

The itch.io desktop app bundles butler and keeps it updated, which is the simplest option on every platform. To install the standalone CLI instead, download it from the [butler page](https://itchio.itch.io/butler), or use the automation-friendly broth URLs described in the [official installation guide](https://itch.io/docs/butler/installing.html).

**Windows** — extract the `.zip`, add the folder to `PATH`, then run:

```powershell
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

The plugin searches for butler in this order: the `butlerPath` config value, the `BUTLER_PATH` environment variable, the itch.io desktop app's data directory, then `PATH`. The app-bundled locations are:

| OS | Bundled butler root |
|----|---------------------|
| Windows | `%APPDATA%\itch\broth\butler` |
| macOS | `~/Library/Application Support/itch/broth/butler` |
| Linux | `~/.config/itch/broth/butler` |

butler stores credentials at `~/.config/itch/butler_creds` on all platforms unless `--identity` is used.

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

### Standalone script

No installation is required. Download or clone the repository and run `release.ps1` (see [Standalone script reference](#standalone-script-reference)).

## Quick start

**Windows (Windows PowerShell or PowerShell 7+):**

```powershell
# Preview the upload without publishing
./release.ps1 -Source ./dist -Target youruser/yourgame -Channel windows -DryRun

# Publish for real
./release.ps1 -Source ./dist -Target youruser/yourgame -Channel windows -Version 1.0.0
```

**macOS and Linux (PowerShell 7+):**

```bash
# Preview the upload without publishing
pwsh ./release.ps1 -Source ./dist -Target youruser/yourgame -Channel linux -DryRun

# Publish for real
pwsh ./release.ps1 -Source ./dist -Target youruser/yourgame -Channel linux -Version 1.0.0
```

If PowerShell is not available, call butler directly — the plugin and script only wrap these commands:

```bash
butler push ./dist youruser/yourgame:linux --userversion 1.0.0
butler status youruser/yourgame
```

After a successful push, `release.ps1` prints `butler status` and runs `.itchio-release-hook.ps1` if it exists.

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

`release.ps1` runs on Windows PowerShell 5.1+, PowerShell 7+ on Windows, and PowerShell 7+ on macOS/Linux. On macOS/Linux invoke it with `pwsh ./release.ps1`.

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

On macOS and Linux, `butlerPath` is usually unnecessary because the plugin finds the app-bundled or `PATH` binary automatically.

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

The pattern is the same on every platform: build, stage a clean output folder, then push.

### Windows (Rust/Bevy example)

```powershell
cargo build --release

$dist = "dist/windows"
New-Item -ItemType Directory -Force $dist | Out-Null
Copy-Item target/release/mygame.exe $dist
Copy-Item assets $dist -Recurse -Force
Copy-Item README.md $dist -ErrorAction SilentlyContinue

./release.ps1 -Source $dist -Target youruser/mygame -Channel windows -Version 1.0.0
```

### macOS (Rust/Bevy example)

```bash
cargo build --release

dist="dist/macos"
mkdir -p "$dist"
cp -R "target/release/bundle/osx/MyGame.app" "$dist/"   # with cargo-bundle; otherwise copy the binary
cp -R assets "$dist/"

pwsh ./release.ps1 -Source "$dist" -Target youruser/mygame -Channel osx -Version 1.0.0
```

### Linux (Rust/Bevy example)

```bash
cargo build --release

dist="dist/linux"
mkdir -p "$dist"
cp target/release/mygame "$dist/"
cp -R assets "$dist/"

pwsh ./release.ps1 -Source "$dist" -Target youruser/mygame -Channel linux -Version 1.0.0
```

Push only the final build folder. Avoid uploading intermediate directories such as `target/`, and exclude debug symbols or caches. On macOS, push the `.app` bundle rather than loose binaries so symlinks and frameworks are preserved.

## Post-release hooks

After a successful push, `release.ps1` runs `.itchio-release-hook.ps1` from the repository root, unless `-NoHook` is passed. On macOS and Linux the hook runs through PowerShell 7+, so it has the same capabilities as on Windows. Use it for notifications, changelog updates, or opening the game page. A minimal hook is included in this repository.

## Diagnostics

**Windows:**

```powershell
./install.ps1
node test-release.js
node test-release.js user/game
```

**macOS and Linux:**

```bash
./install.sh          # bash environment check
pwsh ./install.ps1    # equivalent check through PowerShell 7+
node test-release.js
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
├── release.ps1               # Standalone release script (all platforms)
├── install.ps1               # Environment checks (PowerShell, all platforms)
├── install.bat               # Environment checks (Windows batch)
├── install.sh                # Environment checks (bash: macOS/Linux)
├── test-release.js           # Node.js diagnostics
├── .itchio-release-hook.ps1  # Optional post-release hook
├── LICENSE.md                # MIT license
└── README.md
```

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `butler` is not recognized | Install the itch.io desktop app, pass `-ButlerPath`, or set `BUTLER_PATH`. |
| `Permission denied` when running butler (macOS/Linux) | Run `chmod +x butler` on the extracted binary. |
| `pwsh: command not found` (macOS/Linux) | Install PowerShell 7+, or call `butler` directly as shown in [Quick start](#quick-start). |
| macOS blocks the butler binary | Allow it in System Settings → Privacy & Security, or remove the quarantine attribute with `xattr -d com.apple.quarantine butler`. |
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

Issues and pull requests are welcome. Keep changes focused, run the diagnostics for your platform before submitting, and update the README when behavior changes.

## License

Released under the [MIT License](LICENSE.md).

Copyright (c) 2026 André Simões.
