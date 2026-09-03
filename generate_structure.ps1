$root = (Get-Location).Path
$exclude = @('.git', '.venv', '.vscode', 'node_modules', '__pycache__', '.pytest_cache', '.mypy_cache')
$keepHidden = @('.clinerules', '.env', '.env.example', '.gitignore', '.github')
$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('project_root/')

function Recurse($dir, $prefix) {
    $items = Get-ChildItem -LiteralPath $dir -Force |
        Where-Object {
            $_.Name -notin $exclude -and
            (-not $_.Name.StartsWith('.') -or $_.Name -in $keepHidden)
        } |
        Sort-Object @{Expression = { $_.PSIsContainer }; Ascending = $true }, @{Expression = { $_.Name.ToLower() }; Ascending = $true}

    foreach ($item in $items) {
        $lines.Add("$prefix|-- $($item.Name)")
        if ($item.PSIsContainer) {
            Recurse $item.FullName ($prefix + '    ')
        }
    }
}

Recurse $root ''
$target = Join-Path $root 'project_structure_only.txt'
[System.IO.File]::WriteAllText($target, ($lines -join [Environment]::NewLine) + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
Write-Host "Updated: $target"
