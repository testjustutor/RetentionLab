# =====================================================================
#  setup-live-url.ps1
#  Portable one-time setup for RetentionLab behind a local XAMPP Apache.
#
#  AUTO-DETECTS its own project folder ($PSScriptRoot), so it works no
#  matter where you place the project or on which machine's XAMPP, and
#  it lets you choose a different URL on each machine:
#
#      powershell -File setup-live-url.ps1 -Domain "myapp.test"
#
#  (Defaults to "localretentionlab.com" when no -Domain is passed.)
#
#  Steps (all idempotent / safe to re-run):
#    1. Enable Apache mod_proxy_http + mod_proxy_wstunnel in httpd.conf.
#    2. Write/refresh the reverse-proxy v-host in httpd-vhosts.conf using
#       THIS folder as DocumentRoot and the given Domain.
#    3. Add hosts entries:  domain + www.domain -> 127.0.0.1
#    4. Start the Node server on port 3000 (if not already running).
#    5. Open the browser at http://www.<Domain>/
# =====================================================================

param(
  [string]$Domain = "localretentionlab.com"
)

$ErrorActionPreference = 'continue'

# --- Resolve this project's location (portable) ---
$projectDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$wwwDomain  = "www.$Domain"
$frontURL   = "http://$wwwDomain/"

# --- Node port from project .env (default 3000) ---
$envPath = Join-Path $projectDir '.env'
$nodePort = '3000'
if (Test-Path $envPath) {
  try {
    $match = Get-Content $envPath -Encoding Ascii |
             Where-Object { $_ -match '^PORT=' } |
             Select-Object -First 1
    if ($match) { $nodePort = $match.Split('=')[1].Trim() }
  } catch { }
}

# --- XAMPP Apache config paths ---
$httpdConf  = "C:\xampp\apache\conf\httpd.conf"
$vhostsConf = "C:\xampp\apache\conf\extra\httpd-vhosts.conf"
$hostsFile  = "C:\Windows\System32\drivers\etc\hosts"

Write-Host ""
Write-Host "================================================================"
Write-Host "  RetentionLab - portable local setup"
Write-Host "  Project folder : $projectDir"
Write-Host "  Live URL       : $frontURL"
Write-Host "  Node port      : $nodePort"
Write-Host "================================================================"
Write-Host ""

if (-not (Test-Path $httpdConf)) {
  Write-Host "  [FAIL] Apache not found at $httpdConf"
  Write-Host "         XAMPP must be at C:\xampp. Fix and re-run."
  exit 1
}

# ---------------------------------------------------------------
# Step 1: enable required proxy modules (idempotent)
# ---------------------------------------------------------------
try {
  $httpd = Get-Content $httpdConf -Encoding Ascii
} catch { $httpd = @() }
$enableMap = @{
  '#LoadModule proxy_http_module modules/mod_proxy_http.so'        = 'LoadModule proxy_http_module modules/mod_proxy_http.so'
  '#LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so' = 'LoadModule proxy_wstunnel_module modules/mod_proxy_wstunnel.so'
}
$changed = $false
for ($i = 0; $i -lt $httpd.Count; $i++) {
  $t = $httpd[$i].Trim()
  if ($enableMap.ContainsKey($t)) {
    $httpd[$i] = $enableMap[$t]
    $changed = $true
  }
}
if ($changed) {
  Set-Content -Path $httpd -Value $httpd -Encoding Ascii
  Write-Host "  [1/5] Enabled mod_proxy_http + mod_proxy_wstunnel in httpd.conf."
} else {
  Write-Host "  [1/5] Apache proxy modules already enabled / or httpd.conf unchanged."
}

# ---------------------------------------------------------------
# Step 2: write/refresh the reverse-proxy v-host (this folder + domain)
# ---------------------------------------------------------------
$vhostLines = @(
  "# === RetentionLab AUTO-VHOST (managed by setup-live-url.bat; do not edit manually) ===",
  "<VirtualHost *:80>",
  "    ServerName $wwwDomain",
  "    ServerAlias $Domain",
  "    DocumentRoot ""$projectDir""",
  "    <Directory ""$projectDir"">",
  "        AllowOverride All",
  "        Require all granted",
  "    </Directory>",
  "    # RetentionLab = Node.js/Express app (server.js); Apache reverse-proxies to it.",
  "    ProxyPreserveHost On",
  "    ProxyRequests Off",
  "    # Socket.IO WebSocket -> Node (must precede ProxyPass /)",
  "    ProxyPass /socket.io/ ws://localhost:$nodePort/socket.io/",
  "    ProxyPassReverse /socket.io/ ws://localhost:$nodePort/socket.io/",
  "    # Everything else -> Node",
  "    ProxyPass / http://localhost:$nodePort/",
  "    ProxyPassReverse / http://localhost:$nodePort/",
  "    ErrorLog ""logs/retentionlab-error.log""",
  "    CustomLog ""logs/retentionlab-access.log"" common",
  "</VirtualHost>",
  "# === END RetentionLab AUTO-VHOST ==="
)

try {
  $vhosts = @(Get-Content $vhostsConf -Encoding Ascii)
} catch {
  Write-Host "  [FAIL] Could not read $vhostsConf config."; exit 1
}

$startMarker = "# === RetentionLab AUTO-VHOST (managed"
$endMarker   = "# === END RetentionLab AUTO-VHOST ==="
$startIdx = -1; $endIdx = -1
for ($i = 0; $i -lt $vhosts.Count; $i++) {
  if ($vhosts[$i] -like "$startMarker*") { $startIdx = $i }
  if ($vhosts[$i] -eq $endMarker) { $endIdx = $i }
}

if ($startIdx -ge 0 -and $endIdx -ge $startIdx) {
  # Replace region [startIdx..endIdx] with the fresh block
  $out = @()
  for ($i = 0; $i -lt $startIdx; $i++) { $out += $vhosts[$i] }
  foreach ($ln in $vhostLines) { $out += $ln }
  for ($i = $endIdx + 1; $i -lt $vhosts.Count; $i++) { $out += $vhosts[$i] }
  Set-Content -Path $vhostsConf -Value $out -Encoding Ascii
  Write-Host "  [2/5] Refreshed RetentionLab v-host (old folder / URL replaced)."
} else {
  # Append a fresh block
  $out = @()
  foreach ($ln in $vhosts) { $out += $ln }
  $out += ""
  foreach ($ln in $vhostLines) { $out += $ln }
  Set-Content -Path $vhostsConf -Value $out -Encoding Ascii
  Write-Host "  [2/5] Appended RetentionLab v-host to vhosts conf."
}

# ---------------------------------------------------------------
# Step 3: ensure the hosts file maps domain + www.domain -> 127.0.0.1
# ---------------------------------------------------------------
$alreadyHost = $false
$rawHosts = ""
try {
  if (Test-Path $hostsFile) { $rawHosts = Get-Content $hostsFile -Raw -Encoding Ascii }
  if ($rawHosts -and ($rawHosts -match $Domain)) { $alreadyHost = $true }
} catch { $rawHosts = "" }

if ($alreadyHost) {
  Write-Host "  [3/5] hosts entry already present for $Domain (OK)."
} else {
  try {
    $existing = @()
    if (Test-Path $hostsFile) { $existing = @(Get-Content $hostsFile -Encoding Ascii) }
    $outText = ""
    foreach ($ln in $existing) { $outText = $outText + $ln + "`r`n" }
    if ($existing.Count -gt 0 -and $existing[$existing.Count - 1] -ne "") { $outText = $outText + "`r`n" }
    $outText = $outText + "# RetentionLab local mapping (setup-live-url.bat)`r`n"
    $outText = $outText + "127.0.0.1 $Domain`r`n"
    $outText = $outText + "127.0.0.1 $wwwDomain`r`n"
    $outText = $outText + "::1 $Domain`r`n"
    $outText = $outText + "::1 $wwwDomain`r`n"
    $fs = New-Object System.IO.FileStream([System.IO.Path]::GetFullPath($hostsFile), 2)
    $fs.SetLength(0)
    $bs = [System.Text.Encoding]::ASCII.GetBytes($outText)
    $fs.Write($bs, 0, $bs.Length)
    $fs.Close()
    Write-Host "  [3/5] Added hosts entries for $Domain + $wwwDomain -> 127.0.0.1"
  } catch {
    Write-Host "  [3/5] WARN: could not write hosts file (run this as Administrator)."
  }
}

# ---------------------------------------------------------------
# Step 4: ensure the Node server is running on port $nodePort
# ---------------------------------------------------------------
function TestPort([int]$p) {
  $c = $null
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $c.Connect("127.0.0.1", $p)
    $c.Close()
    return $true
  } catch {
    if ($c -ne $null) { try { $c.Close() } catch { } }
    return $false
  }
}

if (TestPort([int]$nodePort)) {
  Write-Host "  [4/5] Node server already running on port $nodePort (OK)."
} else {
  $vbsPath = Join-Path $projectDir "start-retentionlab-hidden.vbs"
  Write-Host "  [4/5] Starting Node server on port $nodePort ..."
  if (Test-Path $vbsPath) {
    Start-Process "wscript.exe" -ArgumentList @($vbsPath) -WindowStyle Hidden
  } else {
    Start-Process "node.exe" -WorkingDirectory $projectDir -ArgumentList @("server.js") -WindowStyle Hidden
  }
  Start-Sleep -Seconds 2
}

# ---------------------------------------------------------------
# Step 5: open the browser
# ---------------------------------------------------------------
Write-Host "  [5/5] Opening browser at $frontURL"
try { Start-Process $frontURL } catch { }

Write-Host ""
Write-Host "Done locally. Next, YOU must:"
Write-Host "  1. Open XAMPP Control Panel and START Apache."
Write-Host "  2. START MySQL (if the database needs to run)."
Write-Host "  3. If Apache was already running, RESTART it (Stop then Start)."
Write-Host "  4. Visit  $frontURL"
Write-Host ""
Write-Host "If the project folder is renamed or moved to another machine,"
Write-Host "just re-run this script on that machine - no manual Apache edits"
Write-Host "are needed (it auto-detects its own folder and your new URL)."
Write-Host ""