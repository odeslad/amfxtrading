# Reloads the EA on every running MT4 terminal, one terminal at a time: stops it
# and lets the AMFX-Watchdog scheduled task (infra/scripts/startup.ps1, running as
# the logged-on Administrator) start it again in the interactive session.
# Never Start-Process terminal.exe from here: a process started from an SSH
# session lands in session 0, invisible, and dies.
# The task ignores /run while it is still running (it sleeps 20 s after each
# start), so every /run waits for it to be idle first (spec 031).
#
# Then it checks every EA, all at once and at most EaWaitSec: an EA is up when its
# HttpBridgeState rewrote bridge/symbols-available.json after the reload (it always
# does when it starts) and the backend sees the broker's pipe connected (an EA that
# started with a wrong broker name never connects). MT4 can load an EA and start it
# minutes later, and its log on disk lags behind (MT4 buffers it), so neither the
# process nor the log tell. A terminal still down is reloaded once more and checked
# again; one still down after that fails the job by name. Only the EAs connected before the reload
# are checked: a broker that was already down stays as it was and does not fail the job.
# Exit 1 when a terminal is missing or an EA is not up after its retry.
param(
    [int] $TimeoutSec = 720,
    [int] $SoftWaitSec = 90,
    [int] $IdleWaitSec = 120,
    [int] $EaWaitSec = 180
)

$task = 'AMFX-Watchdog'
$deadline = (Get-Date).AddSeconds($TimeoutSec)
$brokersFile = 'C:/amfxtrading/backend/brokers.json'
$healthUrl = 'http://localhost:3000/health'

function Running-Terminals {
    @(Get-CimInstance Win32_Process -Filter "Name = 'terminal.exe'" | Select-Object ProcessId, SessionId, ExecutablePath)
}

function Is-Back([string] $exe) {
    [bool](Running-Terminals | Where-Object { $_.ExecutablePath -eq $exe -and $_.SessionId -ne 0 })
}

function Wait-WatchdogIdle {
    $limit = (Get-Date).AddSeconds($IdleWaitSec)
    while ((Get-ScheduledTask -TaskName $task).State -eq 'Running') {
        if ((Get-Date) -ge $limit) { Write-Host "[WARN] $task still running after $IdleWaitSec s, asking anyway"; return }
        Start-Sleep -Seconds 2
    }
}

function Run-Watchdog {
    Wait-WatchdogIdle
    schtasks /run /tn $task | Out-Null
}

# Stops one terminal and has the watchdog start it again; true once it is back.
function Reload-Terminal([string] $exe) {
    $t = Running-Terminals | Where-Object { $_.ExecutablePath -eq $exe } | Select-Object -First 1
    if ($t) {
        Write-Host "Stopping: $exe (pid $($t.ProcessId), session $($t.SessionId))"
        $proc = Get-Process -Id $t.ProcessId -ErrorAction SilentlyContinue
        if ($proc) {
            $null = $proc.CloseMainWindow()
            if (-not $proc.WaitForExit(10000)) { Stop-Process -Id $t.ProcessId -Force }
        }
    }
    Run-Watchdog
    $soft = (Get-Date).AddSeconds($SoftWaitSec)
    while (-not (Is-Back $exe) -and (Get-Date) -lt $soft) { Start-Sleep -Seconds 3 }
    $back = Is-Back $exe
    if ($back) { Write-Host "Started: $exe" }
    else { Write-Host "[WARN] $exe not back after $SoftWaitSec s, checking again at the end" }
    $back
}

# terminal.exe path -> its broker name and bridge folder (bridgePath = <dataDir>\MQL4\Files\bridge;
# the data folder's origin.txt names the install folder).
function Brokers-ByExe {
    $map = @{}
    foreach ($b in (Get-Content $brokersFile -Raw | ConvertFrom-Json)) {
        $dataDir = Split-Path (Split-Path (Split-Path $b.bridgePath -Parent) -Parent) -Parent
        $origin = Join-Path $dataDir 'origin.txt'
        if (-not (Test-Path $origin)) { continue }
        $exe = Join-Path ((Get-Content $origin -Raw).Trim()) 'terminal.exe'
        $map[$exe] = @{ Name = $b.name; Bridge = $b.bridgePath }
    }
    $map
}

function Connected-Brokers {
    try { @((Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5).brokers | Where-Object { $_.pipe -eq 'connected' } | ForEach-Object { $_.name }) }
    catch { @() }
}

# 'up', or what is still missing: 'not started' (no symbol list written since the reload) or 'not connected'.
function Ea-State($entry, $connected) {
    $file = Join-Path $entry.Bridge 'symbols-available.json'
    if (-not ((Test-Path $file) -and (Get-Item $file).LastWriteTime -gt $entry.Since)) { return 'not started' }
    if ($connected -notcontains $entry.Name) { return 'not connected' }
    'up'
}

# Waits, for all the given EAs at once and at most EaWaitSec, until they are up; returns the ones still down.
function Wait-EasUp($entries) {
    $limit = (Get-Date).AddSeconds($EaWaitSec)
    $down = @($entries)
    while ($down.Count -gt 0) {
        $connected = Connected-Brokers
        $down = @($down | Where-Object { (Ea-State $_ $connected) -ne 'up' })
        if ($down.Count -eq 0 -or (Get-Date) -ge $limit) { break }
        Start-Sleep -Seconds 5
    }
    $down
}

$initial = Running-Terminals
if ($initial.Count -eq 0) {
    Write-Host "No MT4 terminal running; asking $task to start them"
    schtasks /run /tn $task | Out-Null
    exit 0
}

$started = Get-Date
$brokers = Brokers-ByExe
$watch = @()
$connectedBefore = Connected-Brokers
Write-Host "Reloading $($initial.Count) terminal(s) through $task"

foreach ($t in $initial) {
    $exe = $t.ExecutablePath
    $broker = $brokers[$exe]
    if (-not $broker) { Write-Host "[WARN] no broker in brokers.json for $exe; its EA is not checked" }
    elseif ($connectedBefore -notcontains $broker.Name) { Write-Host "[SKIP] EA of $($broker.Name) was not connected before the reload; not checked" }
    else { $watch += @{ Name = $broker.Name; Bridge = $broker.Bridge; Exe = $exe; Since = (Get-Date) } }
    $null = Reload-Terminal $exe
}

$missing = @($initial | Where-Object { -not (Is-Back $_.ExecutablePath) })
if ($missing.Count -gt 0) { Run-Watchdog }
while ($missing.Count -gt 0 -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 5
    $missing = @($initial | Where-Object { -not (Is-Back $_.ExecutablePath) })
}

# Every EA at once: the first ones are usually up while the last terminals reload.
$down = @(Wait-EasUp $watch)
if ($down.Count -gt 0) {
    $connected = Connected-Brokers
    foreach ($e in $down) { Write-Host "[RETRY] EA of $($e.Name): $(Ea-State $e $connected) after $EaWaitSec s, reloading its terminal once more" }
    foreach ($e in $down) { $e.Since = Get-Date; $null = Reload-Terminal $e.Exe }
    $down = @(Wait-EasUp $down)
}
Write-Host "EAs up: $($watch.Count - $down.Count)/$($watch.Count)"

$final = Running-Terminals
$elapsed = [int]((Get-Date) - $started).TotalSeconds
Write-Host "Terminals running: $($final.Count)/$($initial.Count) in $elapsed s"
if ($missing.Count -gt 0 -or $down.Count -gt 0) {
    foreach ($m in $missing) { Write-Host "[FAILED] $($m.ExecutablePath) is not running" }
    $connected = Connected-Brokers
    foreach ($e in $down) { Write-Host "[FAILED] EA of $($e.Name): $(Ea-State $e $connected) after a retry" }
    exit 1
}
Write-Host "Done - $($initial.Count) terminal(s) reloaded, every EA up"
exit 0
