#Requires -Version 5.1
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$package=Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1
if(-not $package -or $package.SignatureKind -ne 'Store') {throw 'Install the official Microsoft Store Codex application first.'}
$node=Join-Path $package.InstallLocation 'app\resources\cua_node\bin\node.exe'
if(-not(Test-Path -LiteralPath $node)) {throw 'This Codex version does not include the required Node runtime.'}
& (Join-Path $PSScriptRoot 'build-startup-gate.ps1')
$desktop=[Environment]::GetFolderPath('Desktop')
$shell=New-Object -ComObject WScript.Shell
foreach($entry in @(@('Codex Animation','launch-hidden.vbs','launch.ico'),@('Codex Image Settings','settings-hidden.vbs','settings.ico'))) {
  $shortcutPath=Join-Path $desktop ($entry[0]+'.lnk')
  if(Test-Path -LiteralPath $shortcutPath) {
    $existing=$shell.CreateShortcut($shortcutPath)
    if($existing.Arguments -notlike ('*'+$repo+'*')) {throw ('Shortcut already exists for another installation: '+$shortcutPath)}
  }
  $shortcut=$shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath=Join-Path $env:WINDIR 'System32\wscript.exe'
  $shortcut.Arguments='"'+(Join-Path $PSScriptRoot $entry[1])+'"'
  $shortcut.WorkingDirectory=$repo
  $shortcut.IconLocation=(Join-Path $repo ('assets\icons\'+$entry[2]))+',0'
  $shortcut.Save()
}
Write-Output 'Installed. Fully exit Codex, then open the Codex Animation desktop shortcut.'
