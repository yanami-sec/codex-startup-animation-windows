#Requires -Version 5.1
param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$proxyEnvFile=Join-Path $env:USERPROFILE '.codex\.env'
if(Test-Path -LiteralPath $proxyEnvFile) {
  foreach($proxyLine in [IO.File]::ReadAllLines($proxyEnvFile)) {
    if($proxyLine -match '^\s*(HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|NODE_USE_ENV_PROXY)\s*=\s*(.*?)\s*$') {
      [Environment]::SetEnvironmentVariable($matches[1],$matches[2].Trim('"',"'"),'Process')
    }
  }
}
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$package=Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1
if (-not $package -or $package.SignatureKind -ne 'Store') { throw 'Official Store Codex package not found.' }
$exe=Join-Path $package.InstallLocation 'app\ChatGPT.exe'
$node=Join-Path $package.InstallLocation 'app\resources\cua_node\bin\node.exe'
$stateRoot=Join-Path $env:LOCALAPPDATA 'OpenAI\ChatGPTFix'
$port=19341
$startedInjector=$false
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
if ($CheckOnly) {
  [pscustomobject]@{exe=$exe;nodeAvailable=(Test-Path -LiteralPath $node);injectorAvailable=(Test-Path -LiteralPath (Join-Path $repo 'extension\windows-wallpaper.mjs'));port=$port} | ConvertTo-Json
  exit
}
try {
  [pscustomobject]@{time=(Get-Date).ToString('o');status='starting'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stateRoot 'background-launch.json') -Encoding UTF8
  $listener=Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  if ($listener) {
    if (@($listener | Where-Object {$_.LocalAddress -ne '127.0.0.1'}).Count) { throw 'Wallpaper port is not restricted to loopback.' }
    foreach ($item in $listener) {
      if ((Get-Process -Id $item.OwningProcess).Path -ine $exe) { throw 'Wallpaper port belongs to another program.' }
    }
  } else {
    $running=Get-Process -Name ChatGPT -ErrorAction SilentlyContinue | Where-Object {$_.Path -ieq $exe}
    if ($running) { throw '请先从托盘完全退出 Codex，再双击这个背景启动入口。当前窗口没有背景接口，不能直接应用。' }
    $profile=Join-Path $env:APPDATA 'Codex\web\Codex'
    $readyPath=Join-Path $stateRoot ('startup-ready-'+[Guid]::NewGuid().ToString('N')+'.txt')
    $existingInjectors=Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {$_.CommandLine -like ('*'+$repo+'\extension\windows-wallpaper.mjs*')}
    foreach($oldInjector in $existingInjectors) {Stop-Process -Id $oldInjector.ProcessId -ErrorAction SilentlyContinue}
    Start-Process -FilePath $node -ArgumentList ('"'+(Join-Path $repo 'extension\windows-wallpaper.mjs')+'" '+$port+' "'+(Join-Path $stateRoot 'wallpaper-state.json')+'" "'+$readyPath+'"') -WindowStyle Hidden -RedirectStandardError (Join-Path $stateRoot 'wallpaper-error.log') | Out-Null
    $startedInjector=$true
    $appArguments='--remote-debugging-address=127.0.0.1 --remote-debugging-port='+$port+' --user-data-dir="'+$profile+'"'
    $gate=Join-Path $repo '.build\StartupGate.exe'
    if(-not(Test-Path -LiteralPath $gate)) {throw 'Run tools/install-windows.ps1 before launching.'}
    $gateArguments='"'+$exe+'" "'+$appArguments.Replace('"','\"')+'" "'+$readyPath+'"'
    Start-Process -FilePath $gate -ArgumentList $gateArguments -WindowStyle Hidden | Out-Null
    $verified=$false
    for($attempt=0;$attempt -lt 60;$attempt++) {
      Start-Sleep -Milliseconds 500
      $listener=Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
      if ($listener) {
        if (@($listener | Where-Object {$_.LocalAddress -ne '127.0.0.1'}).Count) { throw 'Unexpected listening address.' }
        foreach($item in $listener) { if ((Get-Process -Id $item.OwningProcess).Path -ine $exe) { throw 'Unexpected port owner.' } }
        $verified=$true;break
      }
    }
    if (-not $verified) { throw 'Codex 未开放页面背景接口，背景未应用。官方安装包未修改。' }
    [pscustomobject]@{pid=@($listener)[0].OwningProcess;logRoot=(Join-Path $env:LOCALAPPDATA 'Codex\Logs')} | ConvertTo-Json -Compress | Set-Content -LiteralPath ($readyPath+'.host.json') -Encoding UTF8
  }
  $alreadyRunning=Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {$_.CommandLine -like '*windows-wallpaper.mjs*'}
  if (-not $alreadyRunning -and -not $startedInjector) {
    Start-Process -FilePath $node -ArgumentList ('"'+(Join-Path $repo 'extension\windows-wallpaper.mjs')+'" '+$port+' "'+(Join-Path $stateRoot 'wallpaper-state.json')+'"') -WindowStyle Hidden -RedirectStandardError (Join-Path $stateRoot 'wallpaper-error.log') | Out-Null
  }
} catch {
  [pscustomobject]@{time=(Get-Date).ToString('o');status='failed';error=$_.Exception.Message} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stateRoot 'background-launch.json') -Encoding UTF8
  Add-Type -AssemblyName System.Windows.Forms
  [void][System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Codex 背景启动')
  exit 1
}
