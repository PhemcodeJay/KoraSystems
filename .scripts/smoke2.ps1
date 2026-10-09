Add-Type -AssemblyName System.Net.Http -ErrorAction SilentlyContinue
$Email = 'sme1@demo.kora.co.ke'
$Pass = 'Demo@1234'
# 1) login
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromMilliseconds(60000)
$form = @{}
$form['email'] = $Email
$form['password'] = $Pass
$buf = [System.Text.Encoding]::UTF8.GetBytes(($form | ConvertTo-Json))
$req = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, 'http://localhost:3000/api/auth/login')
$req.Content = New-Object System.Net.Http.StringContent([System.Text.Encoding]::UTF8.GetString($buf), [System.Text.Encoding]::UTF8, 'application/json')
try {
  $res = $client.SendAsync($req, [System.Net.Http.HttpCompletionOption]::ResponseContentRead).GetAwaiter().GetResult()
  $body = $res.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  Write-Output ('login -> HTTP ' + $res.StatusCode + ' | ' + $body.Trim().Substring(0, [Math]::Min(200, $body.Trim().Length)))
  if ($res.StatusCode -eq [System.Net.HttpStatusCode]::OK) {
    # 2) empty-cart checkout gate
    $form2 = @{ items = @() } | ConvertTo-Json
    $buf2 = [System.Text.Encoding]::UTF8.GetBytes($form2)
    $req2 = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, 'http://localhost:3000/api/checkout')
    $req2.Content = New-Object System.Net.Http.StringContent([System.Text.Encoding]::UTF8.GetString($buf2), [System.Text.Encoding]::UTF8, 'application/json')
    $res2 = $client.SendAsync($req2, [System.Net.Http.HttpCompletionOption]::ResponseContentRead).GetAwaiter().GetResult()
    $body2 = $res2.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    Write-Output ('checkout -> HTTP ' + $res2.StatusCode + ' | ' + $body2.Trim().Substring(0, [Math]::Min(120, $body2.Trim().Length)))
  }
} catch { Write-Output ('ERR ' + $_.Exception.Message) }
