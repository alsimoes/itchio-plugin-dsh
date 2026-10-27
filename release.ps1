#Requires -Version 5.1
<#
.SYNOPSIS
    Publish a build to itch.io using the official butler CLI.

.DESCRIPTION
    Locates butler (itch.io desktop app, BUTLER_PATH, or PATH), uploads the
    build with `butler push`, prints the channel status, and optionally runs
    a post-release hook.

.PARAMETER Source
    Directory or .zip file of the build to upload.

.PARAMETER Target
    itch.io project in "user/game" format (for example youruser/yourgame).

.PARAMETER Channel
    Upload channel: windows, linux, osx, windows-beta, etc. Default: windows.

.PARAMETER Version
    Version shown on itch.io (--userversion), for example 1.0.0.

.PARAMETER ButlerPath
    Path to the butler executable. Default: auto-detect.

.PARAMETER DryRun
    List what would be uploaded without publishing.

.PARAMETER SkipStatus
    Skip the final `butler status` call.

.PARAMETER HookPath
    Optional PowerShell script executed after a successful push.

.EXAMPLE
    ./release.ps1 -Source ./dist -Target youruser/yourgame -Channel windows -Version 1.0.0

.EXAMPLE
    ./release.ps1 -Source ./dist -Target youruser/yourgame -DryRun

.EXAMPLE
    ./release.ps1 -Source ./dist -Target youruser/yourgame -HookPath ./examples/post-release-hook.ps1
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, HelpMessage = 'Directory or .zip file of the build')]
    [string]$Source,

    [Parameter(Mandatory = $true, HelpMessage = 'itch.io project in user/game format')]
    [string]$Target,

    [string]$Channel = 'windows',

    [string]$Version,

    [string]$ButlerPath,

    [switch]$DryRun,

    [switch]$SkipStatus,

    [string]$HookPath
)

$ErrorActionPreference = 'Stop'

$isWindowsOS = if ($PSVersionTable.PSVersion.Major -ge 6) { $IsWindows } else { $true }

function Find-Butler {
    if ($ButlerPath) { return $ButlerPath }
    if ($env:BUTLER_PATH) { return $env:BUTLER_PATH }

    $exe = if ($isWindowsOS) { 'butler.exe' } else { 'butler' }
    $roots = @()
    if ($isWindowsOS) {
        if ($env:APPDATA) { $roots += (Join-Path $env:APPDATA 'itch/broth/butler') }
    }
    elseif ($PSVersionTable.PSVersion.Major -ge 6 -and $IsMacOS) {
        $roots += (Join-Path $HOME 'Library/Application Support/itch/broth/butler')
    }
    else {
        $roots += (Join-Path $HOME '.config/itch/broth/butler')
    }

    foreach ($root in $roots) {
        $chosenFile = Join-Path $root '.chosen-version'
        if (Test-Path -LiteralPath $chosenFile) {
            $chosen = (Get-Content -LiteralPath $chosenFile -Raw).Trim()
            $candidate = Join-Path (Join-Path (Join-Path $root 'versions') $chosen) $exe
            if (Test-Path -LiteralPath $candidate) { return $candidate }
        }
        $versionsDir = Join-Path $root 'versions'
        if (Test-Path -LiteralPath $versionsDir) {
            $dirs = Get-ChildItem -LiteralPath $versionsDir -Directory | Sort-Object Name -Descending
            foreach ($dir in $dirs) {
                $candidate = Join-Path $dir.FullName $exe
                if (Test-Path -LiteralPath $candidate) { return $candidate }
            }
        }
    }

    $command = Get-Command butler -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    return $null
}

$butler = Find-Butler
if (-not $butler) {
    throw 'butler was not found. Install the itch.io desktop app or pass -ButlerPath / set BUTLER_PATH.'
}

if (-not (Test-Path -LiteralPath $Source)) {
    throw "Source not found: $Source. Build the game and point to the output folder."
}
if ($Target -notmatch '^[^\s/]+/[^\s/]+$') {
    throw "Invalid target: '$Target'. Use the user/game format."
}

Write-Host "butler: $butler" -ForegroundColor Cyan
& $butler --version

$pushArgs = @('push')
if ($DryRun) { $pushArgs += '--dry-run' }
$pushArgs += @([string]$Source, "${Target}:${Channel}")
if ($Version) { $pushArgs += @('--userversion', $Version) }

Write-Host ""
Write-Host "Running: $butler $($pushArgs -join ' ')" -ForegroundColor Yellow
Write-Host ""
& $butler @pushArgs
if ($LASTEXITCODE -ne 0) {
    throw "butler push failed (exit $LASTEXITCODE)."
}

if (-not $SkipStatus) {
    Write-Host ""
    Write-Host "Channel status for ${Target}:" -ForegroundColor Cyan
    & $butler status $Target
}

if ($HookPath) {
    if (-not (Test-Path -LiteralPath $HookPath)) {
        throw "Hook script not found: $HookPath"
    }
    Write-Host ""
    Write-Host "Running post-release hook: $HookPath" -ForegroundColor Cyan
    & $HookPath
}

Write-Host ""
Write-Host "Release complete: ${Target} (${Channel})" -ForegroundColor Green
