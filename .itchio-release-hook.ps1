# itch.io Release Hook
# Runs after a successful release when invoked by release.ps1 (unless -NoHook is passed).

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "itch.io Release Hook - running..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$isWindowsOS = if ($PSVersionTable.PSVersion.Major -ge 6) { $IsWindows } else { $true }

if ($isWindowsOS) {
    Write-Host "OK    Windows environment detected" -ForegroundColor Green
}

if (Test-Path -LiteralPath "dist" -PathType Container) {
    Write-Host "OK    build directory found: dist/" -ForegroundColor Green
    Get-ChildItem -LiteralPath "dist" | Select-Object Name, Length | Format-Table -AutoSize
}

# Add your own post-release tasks here.
# Examples: send a notification, update a changelog, open the game page.

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Hook finished." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
