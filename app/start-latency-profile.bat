@echo off
setlocal

echo ============================================================
echo   Perfil latencia ASR (tiny-en) - My Personal English Teacher
echo ============================================================
echo.
echo   El default de entrega sigue siendo whisper-small.en.
echo   Este script solo abre el perfil de demo rapido.
echo.

cd /d "%~dp0"

where pnpm >nul 2>nul
if not errorlevel 1 goto pnpm_ready

if exist "%LOCALAPPDATA%\pnpm\pnpm.exe" (
    set "PATH=%LOCALAPPDATA%\pnpm;%PATH%"
    goto pnpm_ready
)

echo ERROR: pnpm no esta disponible. Ejecuta setup-windows.bat primero.
pause
exit /b 1

:pnpm_ready
echo Arrancando pnpm dev:latency ...
echo Cuando este listo, abre http://localhost:5173
echo.
call pnpm dev:latency

echo.
pause
exit /b 0
