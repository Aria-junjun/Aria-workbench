@echo off
cd /d "C:\Users\Administrator\Documents\店铺\Aria-workbench-main"
if errorlevel 1 exit /b 1

netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if not errorlevel 1 (
  start "" "http://localhost:3000"
  exit /b 0
)

start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:3000'"
npm run dev
pause
