param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [string]$ApiBase = 'http://localhost:3001',
    [string]$WebBase = 'http://localhost:3000'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
$bundle = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$overlay = Join-Path $bundle 'deploy/docker-compose.release.yml'
$backupScript = Join-Path $bundle 'scripts/database/backup.ps1'
foreach ($file in @((Join-Path $root 'docker-compose.yml'), (Join-Path $root '.env.docker'), (Join-Path $root 'backend/.env'), $overlay, $backupScript)) {
    if (-not (Test-Path -LiteralPath $file)) { throw "Missing deployment prerequisite: $file" }
}
foreach ($name in @('BACKEND_IMAGE', 'FRONTEND_IMAGE', 'TOOLS_IMAGE')) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ($value -notmatch '^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$') { throw "Set $name to an exact ghcr.io image digest." }
}
$compose = @('compose', '--project-directory', $root, '--env-file', (Join-Path $root '.env.docker'), '-f', (Join-Path $root 'docker-compose.yml'), '-f', $overlay)
function Invoke-DeployDocker {
    param([string[]]$DockerArgs)
    $result = & docker @DockerArgs
    if ($LASTEXITCODE -ne 0) { throw "Docker deployment command failed (exit $LASTEXITCODE)." }
    return $result
}
function Invoke-DeployCompose {
    param([string[]]$ComposeCommand)
    Invoke-DeployDocker -DockerArgs ($compose + $ComposeCommand)
}
$stateDir = Join-Path $root 'deploy-state'
[IO.Directory]::CreateDirectory($stateDir) | Out-Null
$lock = [IO.File]::Open((Join-Path $stateDir 'deployment.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
$run = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$stateFile = Join-Path $stateDir ($run + '.json')
Copy-Item -LiteralPath $overlay -Destination (Join-Path $stateDir 'docker-compose.release.yml') -Force
$oldBackend = ''; $oldFrontend = ''; $maintenance = $false; $migrationFinished = $false
$candidateBackend = $env:BACKEND_IMAGE; $candidateFrontend = $env:FRONTEND_IMAGE
function Save-DeployState {
    param([string]$Status)
    $value = [ordered]@{
        status = $Status; updatedAtUtc = [DateTime]::UtcNow.ToString('o'); commit = $env:RELEASE_COMMIT
        backend = $candidateBackend; frontend = $candidateFrontend; tools = $env:TOOLS_IMAGE
        rollbackBackend = $oldBackend; rollbackFrontend = $oldFrontend
        migrationFinished = $migrationFinished; databaseAutomaticallyRestored = $false
    }
    [IO.File]::WriteAllText($stateFile, ($value | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
}
function Save-ActiveImages {
    $lines = @(('BACKEND_IMAGE=' + $env:BACKEND_IMAGE), ('FRONTEND_IMAGE=' + $env:FRONTEND_IMAGE), ('TOOLS_IMAGE=' + $env:TOOLS_IMAGE))
    $temp = Join-Path $stateDir ($run + '.active.tmp')
    [IO.File]::WriteAllText($temp, ($lines -join "`n") + "`n", (New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temp -Destination (Join-Path $stateDir 'active-images.env') -Force
}
try {
    Invoke-DeployCompose -ComposeCommand @('config', '--quiet') | Out-Null
    # Existing initialized app is required. First install remains the Docker setup procedure.
    foreach ($service in @('backend', 'frontend')) {
        $id = (@(Invoke-DeployCompose -ComposeCommand @('ps', '-q', $service)) -join '').Trim()
        if ($id -notmatch '^[a-f0-9]{12,64}$') { throw "Expected an existing running $service container; initialize deployment first." }
        $imageId = (@(Invoke-DeployDocker -DockerArgs @('inspect', '--format', '{{.Image}}', $id)) -join '').Trim()
        if ($imageId -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Unable to record rollback image.' }
        $tag = 'brewlite-rollback-' + $service + ':' + $run
        Invoke-DeployDocker -DockerArgs @('image', 'tag', $imageId, $tag) | Out-Null
        if ($service -eq 'backend') { $oldBackend = $tag } else { $oldFrontend = $tag }
    }
    Save-DeployState -Status 'pulling'
    foreach ($image in @($env:BACKEND_IMAGE, $env:FRONTEND_IMAGE, $env:TOOLS_IMAGE)) {
        Invoke-DeployDocker -DockerArgs @('pull', $image) | Out-Null
    }
    $maintenance = $true
    Invoke-DeployCompose -ComposeCommand @('stop', 'frontend', 'backend') | Out-Null
    Save-DeployState -Status 'backing-up'
    & $backupScript -ProjectRoot $root
    Save-DeployState -Status 'migrating'
    Invoke-DeployCompose -ComposeCommand @('--profile', 'setup', 'run', '--rm', '--no-deps', 'migrate') | Out-Null
    $migrationFinished = $true
    Save-DeployState -Status 'starting'
    Invoke-DeployCompose -ComposeCommand @('up', '-d', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '180', 'backend', 'frontend') | Out-Null
    $api = Invoke-RestMethod -Uri ($ApiBase.TrimEnd('/') + '/products') -TimeoutSec 20
    $web = Invoke-WebRequest -Uri $WebBase -UseBasicParsing -TimeoutSec 20
    if ($null -eq $api -or $web.StatusCode -ne 200) { throw 'Post-deploy smoke failed.' }
    Save-ActiveImages
    Save-DeployState -Status 'success'
    $maintenance = $false
    Write-Output "Deployment PASS. State: $stateFile"
} catch {
    $failure = $_
    try { Save-DeployState -Status 'failed' } catch { Write-Warning 'Could not write failure state; recovery will still be attempted.' }
    if ($maintenance -and $oldBackend -and $oldFrontend) {
        Write-Warning 'Deployment failed. Restoring previous application images; database is NOT automatically restored.'
        $env:BACKEND_IMAGE = $oldBackend; $env:FRONTEND_IMAGE = $oldFrontend
        try {
            Invoke-DeployCompose -ComposeCommand @('up', '-d', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '180', 'backend', 'frontend') | Out-Null
            Save-ActiveImages
            try { Save-DeployState -Status 'application-rolled-back' } catch { Write-Warning 'Previous app is running, but state logging failed.' }
        } catch {
            try { Save-DeployState -Status 'rollback-failed' } catch { Write-Warning 'Rollback failure state could not be saved.' }
            Write-Warning 'Previous app did not become healthy. Inspect logs and backup; manual recovery required.'
        }
    }
    throw $failure
} finally {
    $lock.Dispose()
}
