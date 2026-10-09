param([ValidateSet('codex', 'claude', 'both')][string]$Client = 'both')
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22.13+ before setup.' }
& node (Join-Path $PSScriptRoot 'scripts/setup.mjs') --client $Client
if ($LASTEXITCODE -ne 0) { throw 'Setup failed. Review the message above; do not change execution policies.' }
