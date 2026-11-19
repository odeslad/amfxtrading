# Spec 051: read-only snapshot of the server for Settings › Server, printed as one JSON
# object. Run every minute by services/server-monitor.ts; -Events (every 10 min) adds the
# crashes of the last 30 days and the backend's pm2 restart count, the slow parts.
param(
    [Parameter(Mandatory = $true)][string]$BrokersFile,
    [switch]$Events
)
$ErrorActionPreference = 'Stop'

$os = Get-CimInstance Win32_OperatingSystem
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$pageFile = Get-CimInstance Win32_PageFileUsage | Select-Object -First 1

$services = foreach ($name in 'postgresql-x64-17', 'nginx', 'Cloudflared', 'sshd') {
    $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
    [ordered]@{ name = $name; state = if ($svc) { $svc.Status.ToString().ToLower() } else { 'missing' } }
}

# bridgePath = <dataDir>\MQL4\Files\bridge, and <dataDir>\origin.txt names the install
# folder: the same resolution as infra/scripts/startup.ps1.
$running = @{}
foreach ($p in Get-CimInstance Win32_Process -Filter "Name='terminal.exe'") {
    if ($p.ExecutablePath) { $running[$p.ExecutablePath.ToLower()] = [math]::Round($p.WorkingSetSize / 1MB) }
}
$terminals = foreach ($b in (Get-Content $BrokersFile -Raw | ConvertFrom-Json)) {
    $dataDir = Split-Path (Split-Path (Split-Path $b.bridgePath -Parent) -Parent) -Parent
    $origin = Join-Path $dataDir 'origin.txt'
    $exe = if (Test-Path $origin) { (Join-Path (Get-Content $origin -Raw).Trim() 'terminal.exe').ToLower() } else { $null }
    $isRunning = [bool]($exe -and $running.ContainsKey($exe))
    [ordered]@{ broker = $b.name; running = $isRunning; memMb = if ($isRunning) { $running[$exe] } else { $null } }
}

$result = [ordered]@{
    host        = $env:COMPUTERNAME
    os          = $os.Caption
    bootAt      = $os.LastBootUpTime.ToUniversalTime().ToString('o')
    pageFileMb  = if ($pageFile) { [int]$pageFile.CurrentUsage } else { $null }
    diskFreeGb  = [math]::Round($disk.FreeSpace / 1GB, 1)
    diskTotalGb = [math]::Round($disk.Size / 1GB, 1)
    services    = @($services)
    terminals   = @($terminals)
}

if ($Events) {
    # Event 41 is written at the boot after every unclean stop: a bugcheck code when
    # Windows crashed, 0 when the machine just went down (power, host, hard reset).
    $since = (Get-Date).AddDays(-30)
    $result.events = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; Id = 41; StartTime = $since } -ErrorAction SilentlyContinue | ForEach-Object {
        $code = [int64]$_.Properties[0].Value
        [ordered]@{
            at     = $_.TimeCreated.ToUniversalTime().ToString('o')
            kind   = if ($code -ne 0) { 'bugcheck' } else { 'unexpected' }
            code   = if ($code -ne 0) { '0x{0:X}' -f $code } else { $null }
            param1 = if ($code -ne 0) { '0x{0:X}' -f [int64]$_.Properties[1].Value } else { $null }
        }
    })
    # ConvertFrom-Json (PS 5.1) rejects pm2's env, which holds keys differing only in
    # case (Path / PATH); the restart count is read straight from the text.
    $jlist = (cmd /c 'pm2 jlist 2>nul') -join ''
    $match = [regex]::Match($jlist, '"name":"amfxtrading-backend".*?"restart_time":(\d+)')
    $result.backendRestarts = if ($match.Success) { [int]$match.Groups[1].Value } else { $null }
}

$result | ConvertTo-Json -Depth 4 -Compress
