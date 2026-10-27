@echo off
setlocal
cd /d "%~dp0"

echo Checking the itch.io Plugin environment...
echo.

if defined BUTLER_PATH (
  echo butler: %BUTLER_PATH%
  "%BUTLER_PATH%" --version
) else (
  where butler >nul 2>nul
  if errorlevel 1 (
    echo WARN: butler not found on PATH.
    echo The itch.io desktop app bundles butler; set BUTLER_PATH if needed.
  ) else (
    butler --version
  )
)

echo.
echo Run a release with:
echo   release.ps1 -Source .\dist -Target youruser/yourgame -Channel windows -Version 1.0.0
echo.
pause
