# Checks the itch.io Plugin environment (butler, credentials, and configuration).
# Installs nothing: butler ships with the itch.io desktop app.

Write-Host "Checking the itch.io Plugin environment..." -ForegroundColor Cyan
Write-Host ""

$isWindowsOS = if ($PSVersionTable.PSVersion.Major -ge 6) { $IsWindows } else { $true }
$exe = if ($isWindowsOS) { 'butler.exe' } else { 'butler' }

$butler = $null
if ($env:BUTLER_PATH -and (Test-Path -LiteralPath $env:BUTLER_PATH)) {
    $butler = $env:BUTLER_PATH
}
if (-not $butler -and $isWindowsOS -and $env:APPDATA) {
    $broth = Join-Path $env:APPDATA 'itch/broth/butler'
    $chosenFile = Join-Path $broth '.chosen-version'
    if (Test-Path -LiteralPath $chosenFile) {
        $chosen = (Get-Content -LiteralPath $chosenFile -Raw).Trim()
        $candidate = Join-Path (Join-Path (Join-Path $broth 'versions') $chosen) $exe
        if (Test-Path -LiteralPath $candidate) { $butler = $candidate }
    }
    if (-not $butler -and (Test-Path -LiteralPath (Join-Path $broth 'versions'))) {
        $dirs = Get-ChildItem -LiteralPath (Join-Path $broth 'versions') -Directory | Sort-Object Name -Descending
        foreach ($dir in $dirs) {
            $candidate = Join-Path $dir.FullName $exe
            if (Test-Path -LiteralPath $candidate) { $butler = $candidate; break }
        }
    }
}
if (-not $butler) {
    $command = Get-Command butler -ErrorAction SilentlyContinue
    if ($command) { $butler = $command.Source }
}

if ($butler) {
    Write-Host "OK    butler: $butler" -ForegroundColor Green
    & $butler --version
}
else {
    Write-Host "WARN  butler not found." -ForegroundColor Yellow
    Write-Host "      Install the itch.io desktop app (butler ships with it) or set BUTLER_PATH."
}

$creds = Join-Path (Join-Path $HOME '.config/itch') 'butler_creds'
if (Test-Path -LiteralPath $creds) {
    Write-Host "OK    butler credentials found ($creds)" -ForegroundColor Green
}
else {
    Write-Host "WARN  no butler credentials. Run: butler login" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Run a release with:" -ForegroundColor Cyan
Write-Host "  ./release.ps1 -Source ./dist -Target youruser/yourgame -Channel windows -Version 1.0.0"
Write-Host ""
Write-Host "Tip: add -DryRun to test without publishing."
