param([int]$Seconds = 60)
$log = "$env:TEMP\dev.log"
if (Test-Path $log) { Write-Output 'waiting for dev server to boot...' } else { Write-Output 'no log yet' }
Start-Sleep -Seconds $Seconds
if (Test-Path $log) { Get-Content $log -Tail 6 }
$t = Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue
if ($t) { Write-Output ('port 3000: LISTENING pid ' + ($t.OwningProcess -join ',')) } else { Write-Output 'port 3000: not listening' }
