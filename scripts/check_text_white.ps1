Get-ChildItem -Path 'public/admin' -Filter '*.html' -Recurse | ForEach-Object {
  $path = $_.FullName
  $i = 1
  Get-Content -Path $path -Encoding UTF8 | ForEach-Object {
    if ($_ -match 'text-white') { Write-Output ("{0}:{1}: {2}" -f $path, $i, $_.Trim()) }
    $i++
  }
}
