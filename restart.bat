@echo off
cd /d E:\Github\finfast-ua
echo ============================================
echo   FinFast UA - Update and Start
echo ============================================
echo.

echo [1/4] Pulling latest changes...
git pull origin claude/monobank-finances-app-FO9hQ
if errorlevel 1 (
    echo ERROR: git pull failed!
    pause
    exit /b 1
)
echo.

echo [2/4] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)
echo.

echo [3/4] Generating Prisma client...
call npx prisma generate
if errorlevel 1 (
    echo ERROR: prisma generate failed!
    pause
    exit /b 1
)
REM NOTE: no "prisma db push" / "prisma migrate" here. dev.db is SQLCipher-
REM encrypted, so the Prisma CLI cannot open it (it errors with "not a database
REM file"). The app owns the schema: the first-run /setup flow creates and
REM migrates the encrypted DB, and the runtime migrator applies any pending
REM migrations through a keyed connection on startup.
echo.

echo [4/4] Starting dev server...
echo.
echo Close this window to stop the server.
echo.

REM Wait for server to be ready, then open browser
start "" powershell -WindowStyle Hidden -Command "do { Start-Sleep -Seconds 2; try { $r = Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue } catch { $r = $null } } while (-not $r); Start-Process 'http://localhost:3000/dashboard'"

call npm run dev
pause
