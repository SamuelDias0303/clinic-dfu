$ErrorActionPreference = "Stop"

$graphify = Get-Command graphify -ErrorAction SilentlyContinue

if (-not $graphify) {
  Write-Error @"
Graphify is not installed on PATH.

Install the official package first:
  py -3 -m pip install --user graphifyy
  # or: pipx install graphifyy
  # or: uv tool install graphifyy

Then run:
  npm run graphify
"@
}

& graphify .
