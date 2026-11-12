Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Initialize-DatabaseTools {
    param([string]$ProjectRoot)
    $script:DatabaseProject = (Resolve-Path -LiteralPath $ProjectRoot).Path
    foreach ($file in @('docker-compose.yml', '.env.docker')) {
        if (-not (Test-Path -LiteralPath (Join-Path $script:DatabaseProject $file))) {
            throw "Missing $file at project root. Copy scripts into scripts/database first, or pass -ProjectRoot."
        }
    }
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker CLI not found. Open Docker Desktop and a new terminal.' }
    $script:ComposeArgs = @('compose', '--project-directory', $script:DatabaseProject, '--env-file', (Join-Path $script:DatabaseProject '.env.docker'), '-f', (Join-Path $script:DatabaseProject 'docker-compose.yml'))
    $ids = @(Invoke-DockerChecked -DockerArgs ($script:ComposeArgs + @('ps', '-q', 'db')))
    $script:DatabaseContainer = ($ids -join '').Trim()
    if ($script:DatabaseContainer -notmatch '^[a-f0-9]{12,64}$') { throw 'Expected one running db container. Start PostgreSQL with Docker Compose first.' }
}

function Invoke-DockerChecked {
    param([string[]]$DockerArgs)
    $result = & docker @DockerArgs
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed (exit $LASTEXITCODE). Operation stopped." }
    return $result
}

function Invoke-DatabaseShell {
    param([string]$Command, [string[]]$Arguments = @())
    Invoke-DockerChecked -DockerArgs (@('exec', $script:DatabaseContainer, 'sh', '-eu', '-c', $Command, 'brewlite-db-tool') + $Arguments)
}

function Write-JsonFile {
    param([string]$Path, $Value)
    $json = $Value | ConvertTo-Json -Depth 12
    [System.IO.File]::WriteAllText($Path, $json, (New-Object System.Text.UTF8Encoding($false)))
}
