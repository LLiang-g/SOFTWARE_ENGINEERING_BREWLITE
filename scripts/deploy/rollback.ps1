param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][string]$StateFile
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
$state = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
if ($state.rollbackBackend -notmatch '^brewlite-rollback-backend:[0-9TZ-]+[a-f0-9]{8}$' -or
    $state.rollbackFrontend -notmatch '^brewlite-rollback-frontend:[0-9TZ-]+[a-f0-9]{8}$' -or
    $state.tools -notmatch '^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$') { throw 'Invalid rollback image references.' }
$dir = Join-Path $root 'deploy-state'
$lock = [IO.File]::Open((Join-Path $dir 'deployment.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
try {
    $env:BACKEND_IMAGE = $state.rollbackBackend; $env:FRONTEND_IMAGE = $state.rollbackFrontend; $env:TOOLS_IMAGE = $state.tools
    $overlay = Join-Path $dir 'docker-compose.release.yml'
    & docker compose --project-directory $root --env-file (Join-Path $root '.env.docker') -f (Join-Path $root 'docker-compose.yml') -f $overlay up -d --no-build --pull never --wait --wait-timeout 180 backend frontend
    if ($LASTEXITCODE -ne 0) { throw 'Application rollback failed. Database was not changed.' }
    $lines = @(('BACKEND_IMAGE=' + $env:BACKEND_IMAGE), ('FRONTEND_IMAGE=' + $env:FRONTEND_IMAGE), ('TOOLS_IMAGE=' + $env:TOOLS_IMAGE))
    [IO.File]::WriteAllText((Join-Path $dir 'active-images.env'), ($lines -join "`n") + "`n", (New-Object Text.UTF8Encoding($false)))
    Write-Output 'Previous application images are healthy. Database schema/data were NOT restored or downgraded.'
} finally { $lock.Dispose() }
