@echo off
chcp 65001 >nul
cd /d E:\Github\finfast-ua

set BRANCH=claude/monobank-finances-app-FO9hQ

echo ============================================
echo   FinFast UA - Save to GitHub
echo ============================================
echo.

REM --- Show what changed ---
echo [1/5] Changes to be saved:
echo.
git status --short
echo.

REM --- Ask if there is anything to commit ---
git status --porcelain | findstr "." >nul
if errorlevel 1 (
    echo Nothing to save locally - checking GitHub anyway...
    echo.
    goto sync
)

REM --- Ask for a commit message ---
echo Describe the changes (or just press Enter for an automatic note):
set "MSG="
set /p "MSG=> "
if "%MSG%"=="" set "MSG=Оновлення %DATE% %TIME%"
echo.

echo [2/5] Staging all changes...
git add -A
if errorlevel 1 ( echo ERROR: git add failed! & pause & exit /b 1 )
echo.

echo [3/5] Committing...
git commit -m "%MSG%"
if errorlevel 1 ( echo ERROR: git commit failed! & pause & exit /b 1 )
echo.

:sync
echo [4/5] Pulling latest from GitHub...
git pull --no-edit origin %BRANCH%
if errorlevel 1 (
    echo.
    echo ============================================
    echo   CONFLICT or pull problem!
    echo   Do NOT panic. Just write to Claude in chat:
    echo   "pull conflict, rozruly bud laska"
    echo ============================================
    pause
    exit /b 1
)
echo.

echo [5/5] Pushing to GitHub...
git push origin %BRANCH%
if errorlevel 1 ( echo ERROR: git push failed! & pause & exit /b 1 )
echo.

echo ============================================
echo   DONE! GitHub is now up to date.
echo ============================================
echo.
pause
