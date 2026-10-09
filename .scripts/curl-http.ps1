Add-Type -AssemblyName System.Net.Http -ErrorAction SilentlyContinue
$Url = 'http://localhost:3000/'
$TimeoutMs = 45000
try {
  $handler = New-Object System.Net.Http.HttpClientHandler
  $handler.AllowAutoRedirect = $true
  $client = New-Object System.Net.Http.HttpClient($handler)
  $client.Timeout = [TimeSpan]::FromMilliseconds($TimeoutMs)
  $req = $client.GetAsync($Url, [System.Net.Http.HttpCompletionOption]::ResponseContentRead).ConfigureAwait($false)
  $res = $req.GetAwaiter().GetResult()
  if ($null -eq $res) { Write-Output 'no response' }
  else {
    $body = $res.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
    $s = [System.Text.Encoding]::UTF8.GetString($body)
    Write-Output ('HTTP ' + $res.StatusCode + ' | ' + $s.SubString(0, [Math]::Min(220, $s.Length)))
  }
} catch { Write-Output ('ERR ' + $_.Exception.Message) }
