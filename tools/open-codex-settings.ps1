$ErrorActionPreference='Stop'
$package=Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1
$node=Join-Path $package.InstallLocation 'app\resources\cua_node\bin\node.exe'
& $node (Join-Path $PSScriptRoot 'open-codex-settings.mjs')
