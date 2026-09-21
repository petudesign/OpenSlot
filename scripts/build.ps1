param(
  [Parameter(Mandatory = $true)]
  [string]$SdkRoot
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sdkPath = (Resolve-Path $SdkRoot).Path
$packager = Join-Path $sdkPath 'PhoneSDK/tools/build-mmpkg.mjs'
$pluginPath = Join-Path $repoRoot 'plugin'
$outputPath = Join-Path $repoRoot 'dist/openslot-0.1.0.mmpkg'

if (-not (Test-Path -LiteralPath $packager)) {
  throw "Could not find the official PhoneSDK packager at '$packager'."
}
if (-not (Test-Path -LiteralPath (Join-Path $pluginPath 'manifest.json'))) {
  throw "OpenSlot plugin manifest is missing at '$pluginPath'."
}

New-Item -ItemType Directory -Force -Path (Split-Path $outputPath) | Out-Null
Write-Host "Building OpenSlot with official PhoneSDK packager..."
& node $packager $pluginPath $outputPath
if ($LASTEXITCODE -ne 0) {
  throw "PhoneSDK packager failed with exit code $LASTEXITCODE."
}
Write-Host "Created $outputPath"
