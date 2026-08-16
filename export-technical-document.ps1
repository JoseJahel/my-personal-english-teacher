# Exporta el documento técnico (+ matriz de trazabilidad + reporte de
# verificación) a un PDF único de entrega, en Windows.
#
# Requisitos: ver README.md en esta misma carpeta (Python, pandoc, una
# distribución LaTeX con xelatex -- MiKTeX recomendado --, Node.js y
# @mermaid-js/mermaid-cli).
#
# Uso (PowerShell):
#   cd "Documentacion general\scripts"
#   .\export-technical-document.ps1
#
# Este script solo valida que las herramientas necesarias estén instaladas
# y delega la generación en export-technical-document.py, para no mantener
# dos implementaciones del mismo pipeline en paralelo.

$ErrorActionPreference = "Stop"

function Test-CommandExists {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

$missing = @()

$pythonCmd = $null
foreach ($candidate in @("python", "python3", "py")) {
    if (Test-CommandExists $candidate) {
        $pythonCmd = $candidate
        break
    }
}
if (-not $pythonCmd) { $missing += "python (python.org o 'winget install Python.Python.3.12')" }

if (-not (Test-CommandExists "pandoc")) { $missing += "pandoc (https://pandoc.org/installing.html)" }

$hasLatex = (Test-CommandExists "xelatex") -or (Test-CommandExists "pdflatex")
if (-not $hasLatex) { $missing += "xelatex/pdflatex (instala MiKTeX: https://miktex.org/download)" }

if (-not (Test-CommandExists "mmdc")) {
    $missing += "mmdc (npm install -g @mermaid-js/mermaid-cli; requiere Node.js)"
}

if ($missing.Count -gt 0) {
    Write-Host "Faltan herramientas requeridas:" -ForegroundColor Red
    foreach ($item in $missing) { Write-Host "  - $item" }
    Write-Host "`nVer README.md en esta carpeta para instrucciones de instalación en Windows."
    exit 1
}

Write-Host "Generando PDF de entrega..." -ForegroundColor Cyan
& $pythonCmd (Join-Path $PSScriptRoot "export-technical-document.py")

if ($LASTEXITCODE -ne 0) {
    Write-Host "La exportación falló (código $LASTEXITCODE). Revisa el mensaje de error de arriba." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Listo: Documentacion general\entregas\documento-tecnico-entrega-final.pdf" -ForegroundColor Green
