@echo off
REM =====================================================================
REM  start-retentionlab.bat
REM  Portable launcher for RetentionLab (works no matter where the folder
REM  is located - it locates itself via %~dp0).
REM
REM  Usage:
REM    1. Double-click this file -> starts the server and opens the browser.
REM    2. Or call it from any other folder:  call "C:\any\path\start-retentionlab.bat"
REM =====================================================================
setlocal

REM --- === CHANGE ME IF NODE IS NOT ON YOUR PATH === ---
if not defined NODE_CMD set "NODE_CMD=node"

REM --- Determine the project folder (the folder that contains this .bat) ---
set "PROJECT_DIR=%~dp0"

REM --- Port (keep in sync with .env PORT) ---
set "PORT=3000"

echo ============================================================
echo   RetentionLab - one-click start
echo   Project folder : %PROJECT_DIR%
echo   Port           : %PORT%
echo ============================================================
echo.

REM --- Switch to the project folder so relative .env/database loads ---
pushd "%PROJECT_DIR%"

REM --- If a server is already running on the port, just open the browser ---
set "ALREADY_RUNNING=no"
for /f "tokens=1" %%p in ('netstat -ano ^| findstr ":%PORT% "') do set ALREADY_RUNNING=yes

if /i "%ALREADY_RUNNING%"=="yes" (
  echo Server already running on port %PORT%. Opening browser...
  start "" "http://localhost:%PORT%/"
  goto :done
)

echo Starting the Node server (server.js)...
echo A black console window will stay open while the server runs.
echo Close that window to stop the server. The log also writes to logs/.
echo.

REM --- Start the server in a visible console so you can see logs ---
start "RetentionLab Server" /D "%PROJECT_DIR%" "%NODE_CMD%" server.js

REM --- Wait a moment for the server to boot, then open the browser ---
timeout /t 3 /nobreak >nul
start "" "http://localhost:%PORT%/"

:done
echo.
echo Done. If the browser did not open, type: http://localhost:%PORT%/
popd
endlocal