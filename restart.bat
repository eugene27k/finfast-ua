@echo off
cd /d E:\Github\finfast-ua
echo Pulling latest changes...
git pull origin claude/monobank-finances-app-FO9hQ
echo.
echo Installing dependencies...
npm install
echo.
echo Starting dev server...
npm run dev
pause
