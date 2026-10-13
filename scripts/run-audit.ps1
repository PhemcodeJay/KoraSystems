$log = $env:TEMP + "\kora-prod2\routes.log"
$err = $log + ".err"
$p = Start-Process -FilePath "node" -ArgumentList "scripts/_audit-routes.mjs" -WorkingDirectory "c:/Users/Phemcode/Documents/Jobs/Clients/KoraSystemsInc/KoraSystems" -RedirectStandardOutput $log -RedirectStandardError $err -NoNewWindow -PassThru
Wait-Process -Id $p.Id
"exit=" + $p.ExitCode > $env:TEMP\kora-prod2\done.txt
