param(
    [string]$ProjectRoot = (Join-Path $PSScriptRoot '../..'),
    [string]$OutputDirectory = ''
)
. (Join-Path $PSScriptRoot 'common.ps1')
Initialize-DatabaseTools -ProjectRoot $ProjectRoot
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $script:DatabaseProject 'backups' }
$folder = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($folder) | Out-Null
$id = [guid]::NewGuid().ToString('N')
$name = 'brewlite-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + $id.Substring(0, 8)
$remote = '/tmp/brewlite-backup-' + $id + '.dump'
$partial = Join-Path $folder ($name + '.dump.partial')
$dump = Join-Path $folder ($name + '.dump')
$manifest = Join-Path $folder ($name + '.json')
try {
    # Binary archive stays in files; never pipe pg_dump bytes through PowerShell.
    Invoke-DatabaseShell -Command 'export PGPASSWORD="$POSTGRES_PASSWORD"; pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --no-owner --no-privileges --file="$1"' -Arguments @($remote) | Out-Null
    $toc = @(Invoke-DatabaseShell -Command 'pg_restore --list "$1"' -Arguments @($remote))
    $tables = @($toc | ForEach-Object {
        if ($_ -match '^\d+;\s+\d+\s+\d+\s+TABLE\s+(\S+)\s+(\S+)\s+\S+\s*$') { $Matches[1] + '.' + $Matches[2] }
    } | Sort-Object -Unique)
    if ($tables.Count -eq 0) { throw 'Archive contains no tables. Backup was not finalized.' }
    Invoke-DockerChecked -DockerArgs @('cp', ($script:DatabaseContainer + ':' + $remote), $partial) | Out-Null
    if ((Get-Item -LiteralPath $partial).Length -eq 0) { throw 'Empty backup file' }
    $hash = (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant()
    $source = (@(Invoke-DatabaseShell -Command 'printf "%s" "$POSTGRES_DB"') -join '').Trim()
    $version = (@(Invoke-DatabaseShell -Command 'pg_dump --version') -join '').Trim()
    Move-Item -LiteralPath $partial -Destination $dump
    Write-JsonFile -Path $manifest -Value ([ordered]@{
        formatVersion = 1; createdAtUtc = [DateTime]::UtcNow.ToString('o'); sourceDatabase = $source
        file = [System.IO.Path]::GetFileName($dump); sha256 = $hash; bytes = (Get-Item -LiteralPath $dump).Length
        archiveFormat = 'PostgreSQL custom'; dumpTool = $version; tables = $tables
    })
    Write-Output "Backup: $dump"
    Write-Output "Manifest: $manifest"
    Write-Output 'Keep both files together. This backup includes private application data.'
} finally {
    # Only this run's generated file is removed; never delete backups or volumes.
    try { Invoke-DatabaseShell -Command 'rm -f -- "$1"' -Arguments @($remote) | Out-Null } catch { Write-Warning 'Could not remove temporary archive inside db container.' }
}
