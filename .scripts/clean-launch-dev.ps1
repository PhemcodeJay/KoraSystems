param([int]$KillWaitMs = 1200)
try { Stop-Process -Name node -Force -ErrorAction Stop } catch {}
Start-Sleep -Milliseconds $KillWaitMs
$Tcp = New-Object Net.Sockets.TcpClient
$ok = $Tcp.Connect('127.0.0.1', 3000)
if ($ok) { Write-Output 'port 3000 still busy' } else { Write-Output 'port 3000 free' }
$Tcp.Close()
$env:PORT = '3000'
Start-Process -FilePath 'node.exe' -ArgumentList 'scripts\dev.mjs' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -RedirectStandardOutput "$env:TEMP\dev.log" -RedirectStandardError "$env:TEMP\dev.err"
Write-Output 'dev launched with PORT=3000'
