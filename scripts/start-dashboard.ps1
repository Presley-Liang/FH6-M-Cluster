$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dashboardUrl = 'http://localhost:3000'
$nodePath = (Get-Command node -ErrorAction Stop).Source

function Test-DashboardReady {
  try {
    $status = Invoke-RestMethod -Uri "$dashboardUrl/status" -TimeoutSec 1
    return $null -ne $status
  } catch {
    return $false
  }
}

if (-not (Test-DashboardReady)) {
  $logDirectory = Join-Path $projectRoot 'logs'
  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
  Start-Process -FilePath $nodePath `
    -ArgumentList 'src/index.js' `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDirectory 'dashboard.log') `
    -RedirectStandardError (Join-Path $logDirectory 'dashboard-error.log')

  $deadline = (Get-Date).AddSeconds(12)
  do {
    Start-Sleep -Milliseconds 250
    if (Test-DashboardReady) { break }
  } while ((Get-Date) -lt $deadline)

  if (-not (Test-DashboardReady)) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
      "FH6 Telemetry failed to start. Check logs\dashboard-error.log.",
      'FH6 Telemetry',
      'OK',
      'Error'
    ) | Out-Null
    exit 1
  }
}

Start-Process $dashboardUrl
