# Windows 唤醒/登录后恢复 5060 WSL 服务（render + voice + cloudflared 隧道）
# 一次性注册（管理员 PowerShell）：
#   schtasks /Create /TN "3C-5060-WakeRecover" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File F:\3c-review-video-studio\scripts\wsl-wake-recover.ps1" /SC ONLOGON /RL HIGHEST /F

$ErrorActionPreference = "Continue"
$WslScript = "/mnt/f/3c-review-video-studio/scripts/5060-health-watchdog.sh"

Write-Host "[3C] WSL wake recover starting…"
wsl -u administrator -e bash -lc "sed -i 's/\r$//' '$WslScript' 2>/dev/null; bash '$WslScript' --recover --wait-voice"
$code = $LASTEXITCODE
Write-Host "[3C] wake recover exit=$code"
exit $code
