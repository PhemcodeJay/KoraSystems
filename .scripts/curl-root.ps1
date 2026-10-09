param([string]$Url = 'http://localhost:3000/')
try {
  $wc = New-Object System.Net.WebClient
  $wc.Headers.Add('User-Agent', 'curl/7.88.1')
  $bytes = $wc.DownloadData($Url)
  $s = [System.Text.Encoding]::UTF8.GetString($bytes)
  Write-Output ('HTTP ' + $wc.ResponseHeaders['Status'] + ' | ' + $s.SubString(0, [Math]::Min(250, $s.Length)))
} catch { Write-Output ('ERR ' + $_.Exception.Message) }
