# Measures one server over a time window and prints one line of JSON (spec 046):
# total CPU, CPU per process group and per MT4 terminal (with its broker name),
# free memory, and the tick delay per broker read from the local /health.
# Read-only. CPU figures are in "core %": 100 = one full logical core.
param(
    [int] $WindowSec = 60,
    [int] $PollMs = 500,
    [string] $HealthUrl = 'http://localhost:3000/health'
)

$ErrorActionPreference = 'SilentlyContinue'

$brokersFile = @('C:\amfxtrading\backend\brokers.json', 'C:\amfxtradingv2\backend\brokers.json') |
    Where-Object { Test-Path $_ } | Select-Object -First 1

function Get-TerminalBrokers {
    $map = @{}
    foreach ($b in (Get-Content $brokersFile -Raw | ConvertFrom-Json)) {
        $dataDir = Split-Path (Split-Path (Split-Path $b.bridgePath -Parent) -Parent) -Parent
        $originFile = Join-Path $dataDir 'origin.txt'
        if (-not (Test-Path $originFile)) { continue }
        $exe = Join-Path (Get-Content $originFile -Raw).Trim() 'terminal.exe'
        $map[$exe.ToLower()] = $b.name
    }
    return $map
}

function Get-FreeMb { [int]((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024) }

function Round1([double] $n) { [math]::Round($n, 1) }

$terminalBrokers = Get-TerminalBrokers
$logical = (Get-CimInstance Win32_Processor | Measure-Object NumberOfLogicalProcessors -Sum).Sum
$freeStart = Get-FreeMb

$cpuStart = @{}
Get-Process | ForEach-Object { $cpuStart[$_.Id] = $_.CPU }
$startedAt = (Get-Date).ToUniversalTime()

$ticks = @{}
$healthFailures = 0
$deadline = $startedAt.AddSeconds($WindowSec)
while ((Get-Date).ToUniversalTime() -lt $deadline) {
    $pollStart = Get-Date
    $health = $null
    try { $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 2 } catch { $health = $null }
    if ($null -eq $health) { $healthFailures++ }
    else {
        foreach ($b in $health.brokers) {
            if (-not $ticks.ContainsKey($b.name)) { $ticks[$b.name] = @{ readings = 0; late = 0; noTick = 0; worstS = 0 } }
            $t = $ticks[$b.name]
            $t.readings++
            if ($null -eq $b.tickAgeS) { $t.noTick++ }
            else {
                if ($b.tickAgeS -ge 1) { $t.late++ }
                if ($b.tickAgeS -gt $t.worstS) { $t.worstS = $b.tickAgeS }
            }
        }
    }
    $rest = $PollMs - [int]((Get-Date) - $pollStart).TotalMilliseconds
    if ($rest -gt 0) { Start-Sleep -Milliseconds $rest }
}

$processes = Get-Process
$elapsed = ((Get-Date).ToUniversalTime() - $startedAt).TotalSeconds
$freeEnd = Get-FreeMb

$groups = @{ terminals = 0.0; node = 0.0; postgres = 0.0; antivirus = 0.0; other = 0.0 }
$perTerminal = @{}
foreach ($p in $processes) {
    if (-not $cpuStart.ContainsKey($p.Id) -or $null -eq $p.CPU -or $null -eq $cpuStart[$p.Id]) { continue }
    $corePct = ($p.CPU - $cpuStart[$p.Id]) / $elapsed * 100
    switch ($p.ProcessName) {
        'terminal' {
            $groups.terminals += $corePct
            $broker = $null
            if ($p.Path) { $broker = $terminalBrokers[$p.Path.ToLower()] }
            if (-not $broker) { $broker = "unknown:$($p.Id)" }
            $perTerminal[$broker] = [pscustomobject]@{ corePct = Round1 $corePct; ramMb = [int]($p.WorkingSet64 / 1MB) }
        }
        'node' { $groups.node += $corePct }
        'postgres' { $groups.postgres += $corePct }
        'MsMpEng' { $groups.antivirus += $corePct }
        default { $groups.other += $corePct }
    }
}
$totalCore = ($groups.Values | Measure-Object -Sum).Sum

$tickReport = @{}
foreach ($name in $ticks.Keys) {
    $t = $ticks[$name]
    $tickReport[$name] = [pscustomobject]@{
        readings = $t.readings
        latePct  = if ($t.readings -gt 0) { Round1 ($t.late / $t.readings * 100) } else { $null }
        noTick   = $t.noTick
        worstS   = $t.worstS
    }
}

[pscustomobject]@{
    host           = $env:COMPUTERNAME
    startedAtUtc   = $startedAt.ToString('yyyy-MM-ddTHH:mm:ssZ')
    windowSec      = Round1 $elapsed
    logicalCores   = $logical
    totalCpuPct    = Round1 ($totalCore / $logical)
    corePct        = [pscustomobject]@{
        terminals = Round1 $groups.terminals
        node      = Round1 $groups.node
        postgres  = Round1 $groups.postgres
        antivirus = Round1 $groups.antivirus
        other     = Round1 $groups.other
    }
    terminalCount  = $perTerminal.Count
    terminals      = $perTerminal
    freeMbStart    = $freeStart
    freeMbEnd      = $freeEnd
    healthFailures = $healthFailures
    ticks          = $tickReport
} | ConvertTo-Json -Compress -Depth 5
