@echo off
setlocal

echo ============================================================
echo   Servidor de desarrollo - My Personal English Teacher
echo ============================================================
echo.

cd /d "%~dp0"

echo Verificando si pnpm esta disponible...
where pnpm >nul 2>nul
if not errorlevel 1 goto pnpm_ready

if exist "%LOCALAPPDATA%\pnpm\pnpm.exe" (
    set "PATH=%LOCALAPPDATA%\pnpm;%PATH%"
    goto pnpm_ready
)

echo.
echo ============================================================
echo   ERROR: pnpm no esta instalado o no esta disponible
echo ============================================================
echo.
echo Ejecuta primero setup-windows.bat para instalar todo lo
echo necesario, luego vuelve a ejecutar este script.
echo.
pause
exit /b 1

:pnpm_ready
echo pnpm encontrado. Arrancando servidor de desarrollo...
echo Cuando el servidor este listo, abre http://localhost:5173
echo.
call pnpm dev

echo.
echo ============================================================
echo   El servidor de desarrollo se ha detenido
echo ============================================================
echo.
pause
exit /b 0
