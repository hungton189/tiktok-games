@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Chua cai Node.js. Tai tai https://nodejs.org & pause & exit /b 1)
if not exist node_modules (
  echo Dang cai thu vien lan dau...
  call npm install || (pause & exit /b 1)
)
start "" http://localhost:3000/admin.html
npm start
