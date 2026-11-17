$ErrorActionPreference = 'Stop'

$Root = 'C:\amfxtrading'

function Invoke-Step {
    param([string]$Label, [scriptblock]$Command)
    Write-Host "[$Label]"
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE" }
}

# A push that touches several layers starts their deploys at once, all on this one
# checkout: only one of them works on git at a time. The handle is exclusive and
# Windows drops it when this process ends, so a deploy that dies never blocks the next.
function Enter-GitLock {
    $path = Join-Path $Root '.git\deploy.lock'
    $deadline = (Get-Date).AddMinutes(10)
    while ($true) {
        try { return [System.IO.File]::Open($path, 'OpenOrCreate', 'ReadWrite', 'None') }
        catch [System.IO.IOException] {
            if ((Get-Date) -gt $deadline) { throw "another deploy has held the git lock for 10 minutes" }
            Write-Host "[git lock] another deploy is updating the checkout, waiting"
            Start-Sleep -Seconds 3
        }
    }
}

Set-Location $Root

$gitLock = Enter-GitLock
try {
    # Fetch and reset instead of pull: a merge refuses to run over a file another
    # deploy uploaded a moment ago, a reset just takes what master has.
    Invoke-Step "git fetch" { git fetch origin master }
    Invoke-Step "git reset" { git reset --hard origin/master }
    Invoke-Step "git clean" { git clean -fd }
} finally {
    $gitLock.Dispose()
}

Set-Location frontend

Set-Content ".env.production" "VITE_API_BASE=https://api.amfxtrading.com"

Invoke-Step "npm ci" { npm ci }
Invoke-Step "build" { npm run build }

Write-Host "[OK] Frontend deployed"
