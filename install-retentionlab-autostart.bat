@echo off
REM =====================================================================
REM  install-retentionlab-autostart.bat
REM  Registers the RetentionLab server to AUTO-START in the background
REM  every time you log into Windows. No command needed ever again.
REM
REM  - Works from any location (it locates itself via %~dp0)
REM  - Adds a small launcher into your Windows Startup folder that
REM    starts the hidden vbs (which lives inside the project folder).
REM =====================================================================
setlocal

set "PROJECT_DIR=%~dp0"
set "HIDDEN=start-retentionlab-hidden.vbs"
set "STARTUP=%APPDATA%\Microsoft\Windows\Startup\Programs\Startup"

if not exist "%PROJECT_DIR%%HIDDEN%" (
  echo [ERROR] %HIDDEN% was not found next to this installer.
  echo Aborted - nothing changed.
  pause
  goto :done
)

if not exist "%STARTUP%" (
  echo [ERROR] Could not find your Windows Startup folder:
  echo        %STARTUP%
  echo
  echo Aborted - nothing changed.
  pause
  goto :done
)

echo Installing RetentionLab auto-start...
echo Project : %PROJECT_DIR%
echo Startup : %STARTUP%
echo.

REM Write a tiny launcher into Startup that redirects to the hidden vbs
REM (which lives inside the project, so the project location is preserved).
set "LAUNCHER=%STARTUP%\start-retentionlab.cmd"

> "%LAUNCHER%" echo @echo off
>> "%LAUNCHER%" echo REM Auto-started RetentionLab server (installed by install-retentionlab-autostart.bat)
>> "%LAUNCHER%" echo cd /d "%PROJECT_DIR%"
>> "%LAUNCHER%" echo wscript.exe "%PROJECT_DIR%%HIDDEN%"
>> "%LAUNCHER%" echo exit

echo Installed. The server will now start automatically in the background
echo at every Windows logon.

echo.
echo How to open it later:
echo   - Browser:  http://localhost:3000/
echo   - Or use the included start-retentionlab.bat (starts server + opens browser)
echo   - To UNDO auto-start, run: remove-retentionlab-autostart.bat
echo.
echo NOTE: If you ever move the project folder, re-run this installer so the
echo auto-start path is updated to the new location.
echo

pause
:done
endlocal