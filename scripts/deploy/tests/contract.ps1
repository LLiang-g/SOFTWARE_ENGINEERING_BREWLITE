param([string]$RepositoryRoot = (Join-Path $PSScriptRoot '../../..'))
$ErrorActionPreference = 'Stop'
$repository = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$bundle = Join-Path ([IO.Path]::GetTempPath()) ('brewlite-deploy-contract-' + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory((Join-Path $bundle 'scripts/deploy')) | Out-Null
[IO.Directory]::CreateDirectory((Join-Path $bundle 'scripts/database')) | Out-Null
[IO.Directory]::CreateDirectory((Join-Path $bundle 'deploy')) | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../deploy.ps1') -Destination (Join-Path $bundle 'scripts/deploy/deploy.ps1')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../../../deploy/docker-compose.release.yml') -Destination (Join-Path $bundle 'deploy/docker-compose.release.yml')
foreach ($name in @('backup.ps1','common.ps1')) {
    Copy-Item -LiteralPath (Join-Path $repository ('scripts/database/' + $name)) -Destination (Join-Path $bundle ('scripts/database/' + $name))
}
$global:DeployCalls = New-Object 'System.Collections.Generic.List[string]'
$global:DeployFailStart = $false
$global:DeployFailMigration = $false
$global:DeployFailBackup = $false
function global:docker {
    $items = @($args)
    $global:LASTEXITCODE = 0
    $text = $items -join ' '
    $global:DeployCalls.Add($text + ' [image=' + $env:BACKEND_IMAGE + ']')
    if ($items[0] -eq 'compose') {
        if ($items -contains 'ps') { return ('b' * 64) }
        if (($items -contains 'run') -and $global:DeployFailMigration) { $global:LASTEXITCODE = 1; return }
        if (($items -contains 'up') -and $global:DeployFailStart -and $env:BACKEND_IMAGE.StartsWith('ghcr.io/')) { $global:LASTEXITCODE = 1; return }
        return
    }
    if ($items[0] -eq 'inspect') { return ('sha256:' + ('a' * 64)) }
    if ($items[0] -eq 'cp') { [IO.File]::WriteAllText($items[2], 'fake-custom-archive'); return }
    if ($items[0] -eq 'exec') {
        if ($text.Contains('pg_dump --username') -and $global:DeployFailBackup) { $global:LASTEXITCODE = 1; return }
        if ($text.Contains('pg_restore --list')) { return @('1; 1259 1234 TABLE public Product user', '2; 1259 1235 TABLE public Order user') }
        if ($text.Contains('pg_dump --version')) { return 'pg_dump (PostgreSQL) 16 test adapter' }
        if ($text.Contains('printf')) { return 'brewlite' }
    }
}
function global:Invoke-RestMethod { return @(@{ id = 1 }) }
function global:Invoke-WebRequest { return @{ StatusCode = 200 } }
try {
    foreach ($scenario in @('success','start-failure','migration-failure','backup-failure')) {
        $runtime = Join-Path $bundle $scenario
        [IO.Directory]::CreateDirectory((Join-Path $runtime 'backend')) | Out-Null
        foreach ($f in @('docker-compose.yml','.env.docker','backend/.env')) { [IO.File]::WriteAllText((Join-Path $runtime $f),'test fixture only') }
        $env:BACKEND_IMAGE = 'ghcr.io/test/brewlite-backend@sha256:' + ('1' * 64)
        $env:FRONTEND_IMAGE = 'ghcr.io/test/brewlite-frontend@sha256:' + ('2' * 64)
        $env:TOOLS_IMAGE = 'ghcr.io/test/brewlite-tools@sha256:' + ('3' * 64)
        $env:RELEASE_COMMIT = 'fixture'
        $global:DeployCalls.Clear()
        $global:DeployFailStart = $scenario -eq 'start-failure'
        $global:DeployFailMigration = $scenario -eq 'migration-failure'
        $global:DeployFailBackup = $scenario -eq 'backup-failure'
        $thrown = $false
        try { & (Join-Path $bundle 'scripts/deploy/deploy.ps1') -ProjectRoot $runtime } catch { $thrown = $true }
        if (($scenario -eq 'success') -eq $thrown) { throw "Unexpected deploy result: $scenario" }
        $stateFile = Get-ChildItem (Join-Path $runtime 'deploy-state/*.json') | Select-Object -First 1
        if (-not $stateFile) { throw 'Missing deploy state' }
        $state = Get-Content -LiteralPath $stateFile.FullName -Raw | ConvertFrom-Json
        $expected = if ($scenario -eq 'success') { 'success' } else { 'application-rolled-back' }
        if ($state.status -ne $expected) { throw "State mismatch for $scenario" }
        $active = Get-Content -LiteralPath (Join-Path $runtime 'deploy-state/active-images.env')
        if (@($active).Count -ne 3) { throw 'Active image file must contain three distinct assignments' }
        $dumpIndex = -1; $migrationIndex = -1
        for ($i=0; $i -lt $global:DeployCalls.Count; $i++) {
            $line = $global:DeployCalls[$i]
            if ($line.Contains('pg_dump --username')) { $dumpIndex = $i }
            if ($line.Contains(' run ') -and $line.Contains('migrate')) { $migrationIndex = $i }
            if ($line.Contains(' seed') -or $line.Contains(' down ') -or $line.Contains('DROP DATABASE') -or $line.Contains('reset')) { throw 'Destructive or seed operation in deploy' }
        }
        if ($scenario -eq 'backup-failure') {
            if ($dumpIndex -lt 0 -or $migrationIndex -ge 0) { throw 'Failed backup must block migration' }
        } elseif ($dumpIndex -lt 0 -or $migrationIndex -le $dumpIndex) { throw 'Backup must complete before migration' }
        if ($scenario -ne 'success' -and -not $active[0].Contains('brewlite-rollback-backend:')) { throw 'Previous image was not restored' }
        Write-Output "PASS deployment orchestration adapter: $scenario"
    }
} finally {
    Remove-Item Function:\docker
    Remove-Item Function:\Invoke-RestMethod
    Remove-Item Function:\Invoke-WebRequest
}
