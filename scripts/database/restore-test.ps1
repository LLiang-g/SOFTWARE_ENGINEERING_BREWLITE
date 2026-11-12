param(
    [Parameter(Mandatory = $true)][string]$BackupFile,
    [string]$ProjectRoot = (Join-Path $PSScriptRoot '../..')
)
. (Join-Path $PSScriptRoot 'common.ps1')
$dump = (Resolve-Path -LiteralPath $BackupFile).Path
$manifestPath = [System.IO.Path]::ChangeExtension($dump, '.json')
if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'Matching JSON manifest is required.' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.formatVersion -ne 1 -or $manifest.file -ne [System.IO.Path]::GetFileName($dump)) { throw 'Unsupported or mismatched manifest.' }
$hash = (Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hash -ne $manifest.sha256 -or (Get-Item -LiteralPath $dump).Length -ne $manifest.bytes) { throw 'Backup checksum/size mismatch. Nothing was restored.' }
Initialize-DatabaseTools -ProjectRoot $ProjectRoot
$target = 'brewlite_restore_' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmss') + '_' + [guid]::NewGuid().ToString('N').Substring(0, 8)
if ($target -notmatch '^brewlite_restore_\d{14}_[a-f0-9]{8}$' -or $target -eq $manifest.sourceDatabase) { throw 'Unsafe restore target.' }
$remote = '/tmp/' + $target + '.dump'
$reportPath = Join-Path ([System.IO.Path]::GetDirectoryName($dump)) ($target + '.verification.json')
$created = $false
try {
    Invoke-DockerChecked -DockerArgs @('cp', $dump, ($script:DatabaseContainer + ':' + $remote)) | Out-Null
    Invoke-DatabaseShell -Command 'pg_restore --list "$1" >/dev/null' -Arguments @($remote) | Out-Null
    # createdb fails if the name exists. No --clean, DROP DATABASE or production target.
    Invoke-DatabaseShell -Command 'export PGPASSWORD="$POSTGRES_PASSWORD"; test "$1" != "$POSTGRES_DB"; createdb --username="$POSTGRES_USER" --maintenance-db=postgres --template=template0 "$1"' -Arguments @($target) | Out-Null
    $created = $true
    Invoke-DatabaseShell -Command 'export PGPASSWORD="$POSTGRES_PASSWORD"; pg_restore --username="$POSTGRES_USER" --dbname="$2" --single-transaction --exit-on-error --no-owner --no-privileges "$1"' -Arguments @($remote, $target) | Out-Null
    $sql = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'verify-restore.sql'))
    # SQL is copied as UTF-8 to a generated file; no binary data or quoting through pipes.
    $localSql = Join-Path ([System.IO.Path]::GetTempPath()) ($target + '.sql')
    $remoteSql = '/tmp/' + $target + '.sql'
    try {
        [System.IO.File]::WriteAllText($localSql, $sql, (New-Object System.Text.UTF8Encoding($false)))
        Invoke-DockerChecked -DockerArgs @('cp', $localSql, ($script:DatabaseContainer + ':' + $remoteSql)) | Out-Null
        $raw = @(Invoke-DatabaseShell -Command 'export PGPASSWORD="$POSTGRES_PASSWORD"; psql --username="$POSTGRES_USER" --dbname="$1" --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align --quiet --file="$2"' -Arguments @($target, $remoteSql))
        $inventory = ($raw -join "`n").Trim() | ConvertFrom-Json
        $actual = @($inventory.tables | ForEach-Object { $_.table })
        $missing = @($manifest.tables | Where-Object { $_ -notin $actual })
        if ($missing.Count -gt 0) { throw ('Restored tables missing: ' + ($missing -join ', ')) }
        if ($inventory.unvalidatedConstraints -ne 0) { throw 'Restored database has unvalidated constraints.' }
        Write-JsonFile -Path $reportPath -Value ([ordered]@{
            verifiedAtUtc = [DateTime]::UtcNow.ToString('o'); backupFile = $manifest.file; sha256 = $hash
            restoredDatabase = $target; expectedTableCount = @($manifest.tables).Count; inventory = $inventory
            result = 'PASS'; scope = 'Checksum, archive restore, table presence/readability, row counts and validated constraints. Not application E2E.'
        })
        Write-Output "PASS: restored into $target"
        Write-Output "Verification: $reportPath"
        Write-Output 'The restored database is kept for inspection. The application still uses its original database.'
    } finally {
        if (Test-Path -LiteralPath $localSql) { Remove-Item -LiteralPath $localSql }
        try { Invoke-DatabaseShell -Command 'rm -f -- "$1"' -Arguments @($remoteSql) | Out-Null } catch { Write-Warning 'Temporary SQL cleanup failed.' }
    }
} catch {
    if ($created) { Write-Warning "Test database $target is kept for inspection; it may be incomplete. No success report was written for this run." }
    throw
} finally {
    try { Invoke-DatabaseShell -Command 'rm -f -- "$1"' -Arguments @($remote) | Out-Null } catch { Write-Warning 'Temporary archive cleanup failed.' }
}
