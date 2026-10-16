# Run the Kora seed with the repo-root .env ($DATABASE_URL / $DIRECT_URL / $KORA_SEED_DEMO)
# loaded into the environment, then execute prisma/seed.ts from packages/database.
$repoRoot = "C:\Users\Phemcode\Documents\Jobs\Clients\KoraSystemsInc\KoraSystems"
$envFile = Join-Path $repoRoot ".env"

if (Test-Path $envFile) {
  Get-Content $envFile | Where-Object { $_ -match "^(DATABASE_URL|DIRECT_URL|KORA_SEED_DEMO)=" } | ForEach-Object {
    $line = $_.Trim()
    $idx = $line.IndexOf("=")
    $key = $line.Substring(0, $idx).Trim()
    $val  = $line.Substring($idx + 1).Trim().Trim('"')
    Set-Item "env:$key" -Value $val
  }
} else {
  Write-Host "WARN: .env not found at $envFile"
}

$env:KORA_SEED_DEMO = "true"

Write-Host "Running seed with DATABASE_URL set: $($env:DATABASE_URL -replace ".{8}$", "********")..."
& "packages\database\node_modules\.bin\tsx" "packages\database\prisma\seed.ts"
