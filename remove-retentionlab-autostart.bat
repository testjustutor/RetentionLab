@echo off
REM =====================================================================
REM  remove-retentionlab-autostart.bat
REM  Removes the RetentionLab auto-start launcher from the Windows Startup
REM  folder (undoes install-retentionlab-autostart.bat).
REM =====================================================================
setlocal

set "STARTUP=%APPDATA%\Microsoft\Windows\Startup\Programs\Startup"
set "LAUNCHER=%STARTUP%\start-retentionlab.cmd"

if exist "%LAUNCHER%" (
  del /q "%LAUNCHER%"
  echo Removed auto-start launcher:
  echo   %LAUNCHER%
) else (
  echo No installed auto-start launcher was found:
  echo   %LAUNCHER%
)

echo.
echo Note: this does NOT stop a server that is already running right now.
echo To stop it, close the black "RetentionLab Server" console window
echo (or use Task Manager to end the node.exe process running server.js).
echo
pause
endlocal