# ============================================================
#  注册 stulanez-deck:// 自定义协议（写当前用户 HKCU，无需管理员）
#  作用：网站网页上点「指挥室」→ 本机启动 launch-command-deck.ps1 → 拉起本地看板
#  撤销：Remove-Item 'HKCU:\Software\Classes\stulanez-deck' -Recurse
# ============================================================
$ErrorActionPreference = "Stop"

$key      = "HKCU:\Software\Classes\stulanez-deck"
$launcher = 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "E:\AI\Lowkey\scripts\launch-command-deck.ps1" "%1"'

# 已存在则先清掉，保证干净重写
if (Test-Path $key) { Remove-Item $key -Recurse -Force }

New-Item -Path $key -Force | Out-Null
Set-ItemProperty -Path $key -Name "(default)"  -Value "URL:CommandDeck Protocol"
Set-ItemProperty -Path $key -Name "URL Protocol" -Value ""

New-Item -Path "$key\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$key\shell\open\command" -Name "(default)" -Value $launcher

Write-Host "OK 已注册 stulanez-deck:// 到当前用户（HKCU）。"
Write-Host "现在网页上（本地或公网站）点「指挥室」就会在本机拉起本地看板。"
Write-Host "撤销：Remove-Item 'HKCU:\Software\Classes\stulanez-deck' -Recurse"
