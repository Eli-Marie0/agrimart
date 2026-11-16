param(
  [string]$EnvFile = (Join-Path $PSScriptRoot '..\.env'),
  [string]$BackupDirectory = 'C:\laragon\backups\agrimart',
  [int]$RetentionDays = 30
)

$ErrorActionPreference = 'Stop'
$resolvedEnvFile = (Resolve-Path -LiteralPath $EnvFile).Path
$settings = @{}
foreach ($line in Get-Content -LiteralPath $resolvedEnvFile) {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
    $value = $Matches[2].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $settings[$Matches[1]] = $value
  }
}

if ($settings.DATABASE_CLIENT -ne 'mysql') { throw 'DATABASE_CLIENT must be mysql for this backup script.' }
foreach ($key in @('DATABASE_NAME', 'DATABASE_USERNAME')) {
  if ([string]::IsNullOrWhiteSpace($settings[$key])) { throw "$key is missing from the API .env file." }
}

$dumpCommand = Get-Command mysqldump.exe -ErrorAction SilentlyContinue
if ($dumpCommand) {
  $dumpPath = $dumpCommand.Source
} else {
  $mysqlRoot = 'C:\laragon\bin\mysql'
  $mysqlVersion = Get-ChildItem -LiteralPath $mysqlRoot -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -First 1
  if (-not $mysqlVersion) { throw 'Could not find mysqldump.exe in PATH or C:\laragon\bin\mysql.' }
  $dumpPath = Join-Path $mysqlVersion.FullName 'bin\mysqldump.exe'
}
if (-not (Test-Path -LiteralPath $dumpPath)) { throw "mysqldump.exe was not found at $dumpPath." }

New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupPath = Join-Path $BackupDirectory "agrimart_$timestamp.sql"
$env:MYSQL_PWD = [string]$settings.DATABASE_PASSWORD
try {
  & $dumpPath `
    "--host=$($settings.DATABASE_HOST ?? '127.0.0.1')" `
    "--port=$($settings.DATABASE_PORT ?? '3306')" `
    "--user=$($settings.DATABASE_USERNAME)" `
    '--single-transaction' '--routines' '--triggers' `
    "--result-file=$backupPath" `
    $settings.DATABASE_NAME
  if ($LASTEXITCODE -ne 0) { throw "mysqldump failed with exit code $LASTEXITCODE." }
} catch {
  Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
  throw
} finally {
  Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}

Get-ChildItem -LiteralPath $BackupDirectory -Filter 'agrimart_*.sql' -File |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
  Remove-Item -Force

Write-Output "Database backup created: $backupPath"
