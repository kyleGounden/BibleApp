$ErrorActionPreference = 'Stop'
$src = '\\tsclient\P'
$dest = 'C:\inetpub\scripture'
$backup = 'C:\inetpub\scripture-preserve'
$log = 'C:\inetpub\scripture-deploy.log'

function Write-Log($msg) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $msg
  Write-Host $line
  Add-Content -Path $log -Value $line
}

'' | Set-Content $log
Write-Log 'Deploy starting'

try {
  if (-not (Test-Path $src)) { throw "Mapped drive share not found: $src" }
  if (-not (Test-Path $dest)) { throw "Site path not found: $dest" }

  Import-Module WebAdministration
  Write-Log 'Stopping Scripture app pool...'
  Stop-WebAppPool -Name 'Scripture' -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2

  if (Test-Path $backup) { Remove-Item $backup -Recurse -Force }
  New-Item $backup -ItemType Directory | Out-Null

  Write-Log 'Backing up .env and .data...'
  if (Test-Path (Join-Path $dest '.env')) {
    Copy-Item (Join-Path $dest '.env') (Join-Path $backup '.env') -Force
  }
  if (Test-Path (Join-Path $dest '.data')) {
    Copy-Item (Join-Path $dest '.data') (Join-Path $backup '.data') -Recurse -Force
  }

  Write-Log 'Copying new publish files...'
  # Avoid /LOG: — empty/odd TEMP paths break robocopy arg parsing on this host
  & robocopy $src $dest /E /R:2 /W:2 /NFL /NDL /NP /XD .data logs /XF .env deploy-remote.ps1 deploy.cmd go.cmd restore.cmd
  $rc = $LASTEXITCODE
  if ($rc -ge 8) { throw "robocopy failed with exit code $rc" }
  Write-Log "robocopy exit=$rc"

  Write-Log 'Restoring .env and .data...'
  if (Test-Path (Join-Path $backup '.env')) {
    Copy-Item (Join-Path $backup '.env') (Join-Path $dest '.env') -Force
  }
  if (Test-Path (Join-Path $backup '.data')) {
    if (Test-Path (Join-Path $dest '.data')) { Remove-Item (Join-Path $dest '.data') -Recurse -Force }
    Copy-Item (Join-Path $backup '.data') (Join-Path $dest '.data') -Recurse -Force
  }

  if (-not (Test-Path (Join-Path $dest 'logs'))) {
    New-Item (Join-Path $dest 'logs') -ItemType Directory | Out-Null
  }

  Write-Log 'Deploy files in place.'
}
catch {
  Write-Log ("ERROR: " + $_.Exception.Message)
  throw
}
finally {
  Write-Log 'Starting Scripture app pool...'
  Import-Module WebAdministration -ErrorAction SilentlyContinue
  try { Start-WebAppPool -Name 'Scripture' } catch {}
  Start-Sleep -Seconds 2
  try { Restart-WebAppPool -Name 'Scripture' } catch {}
  Start-Sleep -Seconds 3
  Write-Log 'Pool start attempted. Deploy script finished.'
}
