@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==========================================
echo            发布艺术馆
echo ==========================================
echo.

echo [1/3] 检查有没有新的展品...
git add public/art
git diff --cached --quiet
if %errorlevel%==0 goto nothing

echo [2/3] 打包提交...
git commit -m "chore(art): 换展 %date% %time%" >nul
if errorlevel 1 goto failed

echo [3/3] 推送到线上...
git -c http.sslBackend=openssl push origin main
if errorlevel 1 goto pushfail

echo.
echo ==========================================
echo   完成！等 1-2 分钟，然后刷新：
echo   https://stulanez.com/art/
echo ==========================================
echo.
pause
exit /b 0

:nothing
echo 没有发现新展品，没什么要发布的。
echo.
echo 请先这样做：
echo   1. 浏览器打开  https://stulanez.com/art/
echo   2. 右上角点「策展台」
echo   3. 选图库 - 打标 - 点「写回「art」」
echo   4. 再双击本文件
echo.
pause
exit /b 0

:failed
echo.
echo 提交失败。把上面的信息截图发给 AI 处理。
pause
exit /b 0

:pushfail
echo.
echo 推送失败。常见原因：别人刚推过东西，需要先合并。
echo 把上面的信息发给 AI 处理，别自己乱敲命令。
pause
exit /b 0
