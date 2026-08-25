@echo off
REM =====================================================================
REM  setup-live-url.bat
REM  Portable one-time setup that makes RetentionLab reachable at a URL like
REM       http://www.YOUR-DOMAIN/
REM  through your local XAMPP Apache (you still start Apache yourself).
REM
REM  It auto-detects the project folder (no matter its name or location),
REM  so you can copy the whole project to another machine / XAMPP and
REM  re-run this here with a new domain.
REM
REM  What it does (run once; it will ask for Administrator privileges):
REM   1. Asks you for the URL/domain to use (default: localretentionlab.com)
REM   2. Enables the Apache proxy modules (mod_proxy_http, mod_proxy_wstunnel)
REM   3. Writes the reverse-proxy v-host into httpd-vhosts.conf with the
REM      correct DocumentRoot (this folder) and the domain you entered.
REM   4. Adds domain + www.domain -> 127.0.0.1 to the Windows hosts file.
REM   5. Starts the Node.js backend (server.js on the port from .env).
REM   6. Opens the browser.
REM
REM  Then YOU start Apache (XAMPP Control -> Apache -> Start / Restart).
REM =====================================================================
setlocal

set "PS1=%~dp0setup-live-url.ps1"

REM Prompt for the domain (URL) to use on THIS machine.
set "DOMAIN="
set /p "DOMAIN=Enter the URL/domain to use on this machine (e.g. localretentionlab.com, myapp.test): "
if not defined DOMAIN set "DOMAIN=localretentionlab.com"

echo.
echo Domain chosen : %DOMAIN%
echo Project folder: %~dp0
echo.
echo Requesting Administrator privileges to edit the Apache config and hosts file...
echo.

REM Self-elevate and run the PowerShell helper (quoted path so spaces are safe),
REM passing the chosen domain.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','""%PS1%""','-Domain','""%DOMAIN%""' -Verb RunAs"

echo.
echo Done. Set-up finished. Now start/restart Apache in the XAMPP Control Panel
echo and open:  http://www.%DOMAIN%/
endlocal