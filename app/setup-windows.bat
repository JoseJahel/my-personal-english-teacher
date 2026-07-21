@echo off
setlocal

echo ============================================================
echo   Configuracion inicial - My Personal English Teacher
echo ============================================================
echo.

cd /d "%~dp0"

echo Verificando si Node.js esta instalado...
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo ============================================================
    echo   ERROR: Node.js no esta instalado
    echo ============================================================
    echo.
    echo Node.js no esta instalado. Descarga la version 22 LTS desde
    echo https://nodejs.org e instalala, luego vuelve a ejecutar este script.
    echo.
    pause
    exit /b 1
)

echo Node.js encontrado. Version instalada:
echo.
node -v
echo.

for /f "delims=" %%v in ('node -v') do set "NODE_VERSION=%%v"
echo %NODE_VERSION% | findstr /b /c:"v22" >nul
if errorlevel 1 (
    echo ------------------------------------------------------------
    echo   ADVERTENCIA: se esperaba Node.js v22.x y se detecto %NODE_VERSION%
    echo   El proyecto puede no funcionar correctamente con otra version.
    echo   Se recomienda instalar Node 22 LTS desde https://nodejs.org
    echo ------------------------------------------------------------
    echo.
)

:resolve_pnpm
echo ============================================================
echo   Verificando si pnpm esta disponible...
echo ============================================================
echo.

where pnpm >nul 2>nul
if not errorlevel 1 goto pnpm_ready

if exist "%LOCALAPPDATA%\pnpm\pnpm.exe" (
    set "PATH=%LOCALAPPDATA%\pnpm;%PATH%"
    goto pnpm_ready
)

where corepack >nul 2>nul
if errorlevel 1 goto install_pnpm_standalone

echo Corepack encontrado. Intentando habilitar pnpm con corepack...
echo.
call corepack enable

where pnpm >nul 2>nul
if not errorlevel 1 goto pnpm_ready

:install_pnpm_standalone
echo ============================================================
echo   Instalando pnpm
echo ============================================================
echo.
echo pnpm no esta instalado. Instalando pnpm con el instalador oficial (sin npm)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr https://get.pnpm.io/install.ps1 -useb | iex"
if errorlevel 1 (
    echo.
    echo ============================================================
    echo   ERROR: no se pudo instalar pnpm
    echo ============================================================
    echo.
    echo El instalador oficial de pnpm fallo. Verifica tu conexion a
    echo internet e intenta de nuevo. Tambien puedes instalar pnpm de
    echo forma manual siguiendo las instrucciones de https://pnpm.io/installation
    echo.
    pause
    exit /b 1
)

set "PATH=%LOCALAPPDATA%\pnpm;%PATH%"

where pnpm >nul 2>nul
if not errorlevel 1 goto pnpm_ready
if exist "%LOCALAPPDATA%\pnpm\pnpm.exe" goto pnpm_ready

echo.
echo ============================================================
echo   Reinicio de terminal necesario
echo ============================================================
echo.
echo pnpm se instalo pero la terminal necesita refrescar el PATH.
echo Cierra esta ventana y vuelve a ejecutar setup-windows.bat.
echo.
pause
exit /b 1

:pnpm_ready
echo pnpm encontrado.
echo.

:install_dependencies
echo ============================================================
echo   Instalando dependencias con pnpm...
echo ============================================================
echo.
echo Nota: pnpm usara automaticamente la version de pnpm fijada en el
echo campo "packageManager" de package.json, sin pasos adicionales.
echo.
call pnpm install
if errorlevel 1 (
    echo.
    echo ============================================================
    echo   ERROR: fallo "pnpm install"
    echo ============================================================
    echo.
    echo Revisa los mensajes de error de arriba e intenta de nuevo.
    echo Si el problema persiste, borra la carpeta node_modules y reintenta.
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   Listo
echo ============================================================
echo.
echo Listo. Para arrancar la app ejecuta:
echo   pnpm dev
echo (o usa start-development-server.bat)
echo y abre http://localhost:5173
echo.
pause
exit /b 0
