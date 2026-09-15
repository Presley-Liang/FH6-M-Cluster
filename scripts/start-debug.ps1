$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $root
Set-Location $root
Write-Host 'FH6 Telemetry starting...'
Write-Host 'Keep this window open. Dashboard: http://localhost:3000'
node src/index.js
if ($LASTEXITCODE -ne 0) {
  Write-Host "`nThe program stopped with an error. Press Enter to close." -ForegroundColor Yellow
  Read-Host
}
