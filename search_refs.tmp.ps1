$patterns = 'pipeline\.py|python_main|assemblyai_engine|audio_preprocess|storage_output|channel_transcriber|whisper_engine|whisperx_engine|health_check|resemblyzer_diarizer|report_schema|report_scorer|report_storage'
$root = 'C:\xampp\htdocs\RetentionLab'
$results = @()
Get-ChildItem -Path $root -Recurse -File -Include *.py,*.js,*.json,*.md,*.html | ForEach-Object {
    $p = $_.FullName
    if ($p -match '\\services\\engine\\' ) { return }
    if ($p -match '__pycache__|\\\.git\\|node_modules') { return }
    $m = Select-String -Path $p -Pattern $patterns
    foreach ($r in $m) {
        $results += "$($r.FileName):$($r.LineNumber): $($r.Line.Trim())"
    }
}
if ($results.Count -eq 0) {
    Write-Output 'NO_REFERENCES_FOUND_OUTSIDE_ENGINE'
} else {
    $results | ForEach-Object { Write-Output $_ }
}