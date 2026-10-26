$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root 'publish'

Set-Location $root
npm run build
if ($LASTEXITCODE -ne 0) { throw 'The site build failed.' }

if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item $dest -ItemType Directory | Out-Null
New-Item (Join-Path $dest 'src\lib') -ItemType Directory -Force | Out-Null
New-Item (Join-Path $dest 'logs') -ItemType Directory | Out-Null
New-Item (Join-Path $dest '.data') -ItemType Directory | Out-Null

Copy-Item (Join-Path $root 'package.json') $dest
Copy-Item (Join-Path $root 'package-lock.json') $dest
Copy-Item (Join-Path $root '.env.example') $dest
Copy-Item (Join-Path $root 'iis\web.config') (Join-Path $dest 'web.config')
Copy-Item (Join-Path $root 'dist') (Join-Path $dest 'dist') -Recurse
Copy-Item (Join-Path $root 'server') (Join-Path $dest 'server') -Recurse
Copy-Item (Join-Path $root 'src\lib\canon.ts') (Join-Path $dest 'src\lib\canon.ts')
New-Item (Join-Path $dest 'logs\.keep') -ItemType File | Out-Null
New-Item (Join-Path $dest '.data\.keep') -ItemType File | Out-Null

Set-Location $dest
npm ci --omit=dev
if ($LASTEXITCODE -ne 0) { throw 'The production install failed.' }

Write-Host "IIS site folder: $dest"
