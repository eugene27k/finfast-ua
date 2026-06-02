@echo off
chcp 65001 >nul
cd /d E:\Github\finfast-ua

set BRANCH=claude/monobank-finances-app-FO9hQ
set "STEP=start"

echo ============================================
echo   FinFast UA - Save to GitHub
echo ============================================
echo.

REM --- Show what changed ---
echo [1/5] Changes to be saved:
echo.
git status --short
echo.

REM --- Is there anything to commit? ---
git status --porcelain | findstr "." >nul
if errorlevel 1 (
    echo Nothing new to save locally - will still sync with GitHub.
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
set "STEP=git add (staging)"
git add -A
if errorlevel 1 goto fail
echo    OK
echo.

echo [3/5] Committing locally...
set "STEP=git commit"
git commit -m "%MSG%"
if errorlevel 1 goto fail
echo    OK
echo.

:sync
echo [4/5] Pulling latest from GitHub...
set "STEP=git pull (someone changed GitHub - possible conflict)"
git pull --no-edit origin %BRANCH%
if errorlevel 1 goto fail
echo    OK
echo.

echo [5/5] Pushing to GitHub...
set "STEP=git push"
git push origin %BRANCH%
if errorlevel 1 goto fail
echo    OK
echo.

REM ====================  SUCCESS  ====================
echo ============================================
echo   SUCCESS! GitHub is now up to date.
echo ============================================
echo.
echo Current state:
git log --oneline -3
echo.
git status --short
echo.
echo ----------------------------------------------
echo Press any key to close this window...
pause >nul
exit /b 0

REM ====================  FAILURE  ====================
:fail
echo.
echo ============================================
echo   PROBLEM during: %STEP%
echo ============================================
echo.
echo Nothing was lost. If this mentions a CONFLICT,
echo just write to Claude in chat:
echo     "pull conflict, розрули будь ласка"
echo.
echo Current state:
git status --short
echo.
echo ----------------------------------------------
echo Press any key to close this window...
pause >nul
exit /b 1
