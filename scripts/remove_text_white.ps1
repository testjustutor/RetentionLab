$files = Get-ChildItem -Path 'public/admin' -Filter '*.html' -Recurse
foreach ($file in $files) {
  $path = $file.FullName
  $text = Get-Content -Raw -Encoding UTF8 $path
  $orig = $text
  $re = New-Object System.Text.RegularExpressions.Regex('class\\s*=\\s*"([^\"]*\\btext-white\\b[^\"]*)"', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $text2 = $re.Replace($text, {
    param($m)
    $idx = $m.Index
    $tagStart = $text.LastIndexOf('<', $idx)
    $tagName = ''
    if ($tagStart -ge 0) {
      $len = [Math]::Min(60, $text.Length - $tagStart)
      $tagPart = $text.Substring($tagStart, $len)
      if ($tagPart -match '^<\s*([a-zA-Z0-9_-]+)') { $tagName = $matches[1].ToLower() }
    }
    if ($tagName -eq 'button') { return $m.Value }
    $classes = $m.Groups[1].Value -replace '\\btext-white\\b',''
    $classes = [regex]::Replace($classes, '\\s+',' ').Trim()
    if ($classes -eq '') { return '' } else { return 'class="' + $classes + '"' }
  })
  if ($text2 -ne $orig) {
    Copy-Item -Path $path -Destination ($path + '.bak') -Force
    Set-Content -Path $path -Value $text2 -Encoding UTF8
    Write-Output "MODIFIED: $path"
  }
}
