Get-ChildItem -Path 'public/admin' -Filter '*.html' -Recurse | ForEach-Object {
  $path = $_.FullName
  $lines = Get-Content -Path $path -Encoding UTF8
  $changed = $false
  for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'text-white' -and ($lines[$i] -notmatch '<\s*button')) {
      $lines[$i] = ($lines[$i] -replace '\btext-white\b','') -replace '\s+',' '
      $changed = $true
    }
  }
  if ($changed) {
    Copy-Item -Path $path -Destination ($path + '.bak') -Force
    $lines | Set-Content -Path $path -Encoding UTF8
    Write-Output "MODIFIED: $path"
  }
}
