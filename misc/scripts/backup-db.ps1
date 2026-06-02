<#
.SYNOPSIS
  Backs up the SQLite database (superglazka.db) with timestamped copies.
.DESCRIPTION
  Copies server/data/superglazka.db to server/data/backups/ with a timestamp
  filename and optionally prunes backups older than the retention count.
.PARAMETER BackupDir
  Directory to store backups. Default: server/data/backups/
.PARAMETER Retention
  Number of most recent backups to keep. Default: 30 (0 = keep all).
.EXAMPLE
  .\misc\scripts\backup-db.ps1
  .\misc\scripts\backup-db.ps1 -BackupDir D:\backups -Retention 60
#>

param(
    [string]$BackupDir,
    [int]$Retention = 30
)

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$DbPath = Join-Path $ProjectRoot "server" "data" "superglazka.db"

if (-not $BackupDir) {
    $BackupDir = Join-Path $ProjectRoot "server" "data" "backups"
}

if (-not (Test-Path $DbPath)) {
    Write-Error "Database not found at $DbPath"
    exit 1
}

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

$Timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$BackupFile = Join-Path $BackupDir "superglazka_$Timestamp.db"

Copy-Item -Path $DbPath -Destination $BackupFile
Write-Output "Backup created: $BackupFile"

if ($Retention -gt 0) {
    $Backups = Get-ChildItem -Path $BackupDir -Filter "superglazka_*.db" | Sort-Object Name -Descending
    if ($Backups.Count -gt $Retention) {
        $RemoveCount = $Backups.Count - $Retention
        $Backups | Select-Object -Skip $Retention | Remove-Item
        Write-Output "Removed $RemoveCount old backup(s) — kept $Retention"
    }
}
