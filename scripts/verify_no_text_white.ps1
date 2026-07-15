$found = $false
Get-ChildItem -Path public -Recurse -Filter *.html | ForEach-Object {
  $path = $_.FullName
  $i = 1
  Get-Content -Path $path -Encoding UTF8 | ForEach-Object {
    if ($_ -match 'text-white' -and ($_ -notmatch '<\s*button')) {
      Write-Output ("{0}:{1}: {2}" -f $path, $i, $_.Trim())
      $found = $true
    }
    $i++
  }
}
if (-not $found) { Write-Output 'NO_NON_BUTTON_TEXT_WHITE_FOUND' }