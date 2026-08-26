# add-favicon.ps1 - Adds favicon link to all HTML files in public folder
$files = Get-ChildItem -Path "C:\xampp\htdocs\RetentionLab\public" -Filter *.html -Recurse
foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw
    if ($content -match "<head>" -and $content -notmatch "favicon") {
        $content = $content -replace "<head>", '<head><link rel="icon" href="/favicon.ico" type="image/x-icon">'
        Set-Content $f.FullName $content -Encoding UTF8
        Write-Host "Updated: $($f.FullName)"
    }
}
Write-Host "Done"