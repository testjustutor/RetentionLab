param()
# fix-password-placeholder.ps1
# Replace corrupted (mojibake) password placeholder values across all HTML pages.
# Non-ASCII placeholder content is normalized to a run of bullet characters (U+2022).
$ErrorActionPreference = 'Stop'

$publicRoot = 'C:\xampp\htdocs\RetentionLab\public'
$files = Get-ChildItem -Path $publicRoot -Filter *.html -Recurse

# A run of 8 bullets
$bulletChar = [string][char]0x2022
$bulletRun = $bulletChar * 8

$count = 0
foreach ($f in $files) {
    $original = [System.IO.File]::ReadAllText($f.FullName)

    $needsFix = $false
    $pairs = [regex]::Matches($original, 'placeholder="([^"]*)"')
    foreach ($p in $pairs) {
        $inner = $p.Groups[1].Value
        foreach ($ch in $inner.ToCharArray()) {
            if ([int]$ch -gt 127) {
                $needsFix = $true
                break
            }
        }
        if ($needsFix) { break }
    }

    if (-not $needsFix) { continue }

    # Rebuild string replacing corrupted placeholders with bullet run.
    $sb = New-Object System.Text.StringBuilder
    $lastIdx = 0
    foreach ($p in [regex]::Matches($original, 'placeholder="([^"]*)"')) {
        [void]$sb.Append($original.Substring($lastIdx, $p.Index - $lastIdx))
        $inner = $p.Groups[1].Value
        $hasNonAscii = $false
        foreach ($ch in $inner.ToCharArray()) {
            if ([int]$ch -gt 127) { $hasNonAscii = $true; break }
        }
        if ($hasNonAscii) {
            [void]$sb.Append('placeholder="' + $bulletRun + '"')
        } else {
            [void]$sb.Append($p.Value)
        }
        $lastIdx = $p.Index + $p.Length
    }
    [void]$sb.Append($original.Substring($lastIdx))
    $changed = $sb.ToString()

    if ($changed -ne $original) {
        [System.IO.File]::WriteAllText($f.FullName, $changed, (New-Object System.Text.UTF8Encoding($true)))
        $count++
        Write-Host "Fixed: $($f.FullName)"
    }
}
Write-Host "Completed. Files fixed: $count"