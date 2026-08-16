# Exportación del documento técnico a PDF (issue #62)

Genera un PDF único de entrega a partir de `documento-tecnico.md`,
`matriz-trazabilidad.md` y `reporte-verificacion.md`, con los diagramas
Mermaid pre-renderizados como imágenes (pandoc no renderiza Mermaid de forma
nativa) y las ecuaciones LaTeX/KaTeX tipografiadas por un motor LaTeX real.

**Salida:** `Documentacion general/entregas/documento-tecnico-entrega-final.pdf`

## Requisitos

| Herramienta | Uso | Instalación |
|-------------|-----|-------------|
| Python 3.9+ | Orquesta el pipeline | Ya viene en la mayoría de sistemas; en Windows, [python.org](https://www.python.org/downloads/) o `winget install Python.Python.3.12` |
| `pandoc` | Markdown → LaTeX/PDF | [pandoc.org/installing.html](https://pandoc.org/installing.html) |
| Una distribución LaTeX con `xelatex` (recomendado) | Motor de PDF, tablas e hyphenation en español | Linux: `sudo apt install texlive-full` (o al menos `texlive-xetex texlive-lang-spanish texlive-latex-extra`). macOS: [MacTeX](https://tug.org/mactex/). **Windows:** [MiKTeX](https://miktex.org/download) (instala paquetes faltantes automáticamente la primera vez que se usan) |
| Node.js 18+ | Para `mmdc` | [nodejs.org](https://nodejs.org/) |
| `@mermaid-js/mermaid-cli` | Pre-renderiza los diagramas Mermaid | `npm install -g @mermaid-js/mermaid-cli` |
| Chrome/Chromium | `mmdc` lo usa para renderizar los diagramas | Si `mmdc` no lo encuentra, instala Google Chrome o corre `npx puppeteer browsers install chrome` |

## Uso (Linux / macOS)

```bash
cd "Documentacion general/scripts"
python3 export-technical-document.py
```

## Uso (Windows / PowerShell)

```powershell
cd "Documentacion general\scripts"
.\export-technical-document.ps1
```

El script de PowerShell solo verifica que las herramientas estén instaladas
y delega en el mismo `export-technical-document.py` (evita mantener dos
implementaciones del pipeline). Ver
[`export-technical-document.ps1`](./export-technical-document.ps1).

## Qué hace el script

1. Por cada bloque ` ```mermaid ` en `documento-tecnico.md`, extrae el
   diagrama y lo renderiza a PNG con `mmdc`.
2. Sustituye esos bloques por la imagen correspondiente.
3. Normaliza un par de emoji sin glifo garantizado en las fuentes LaTeX por
   defecto (solo en el PDF generado; los `.md` fuente no cambian).
4. Concatena `documento-tecnico.md` + `matriz-trazabilidad.md` +
   `reporte-verificacion.md` con saltos de página entre cada uno.
5. Convierte a `.tex` con pandoc (TOC, `lang=es`, fuente `DejaVu Sans` para
   cubrir símbolos como ≤ ≥ ≈).
6. Las tablas muy anchas de la matriz y el reporte se tipografían en
   **landscape** (`pdflscape`) con letra más pequeña, para que las columnas
   no se encimen en tamaño carta.
7. Compila el `.tex` con `xelatex` (dos pasadas, para la tabla de
   contenidos).

## Problemas comunes

- **`! LaTeX Error: File 'lmodern.sty' not found.`** — falta el paquete
  `lmodern`. En Debian/Ubuntu: `sudo apt install lmodern`. En MiKTeX se
  instala solo la primera vez que se necesita.
- **Palabras en español que no cortan de línea y desbordan una columna de
  tabla** — falta el paquete de hyphenation en español. Debian/Ubuntu:
  `sudo apt install texlive-lang-spanish`. MiKTeX/MacTeX ya lo incluyen.
- **`mmdc` no encuentra Chrome** — instala Google Chrome, o corre
  `npx puppeteer browsers install chrome` y vuelve a intentar. En un
  entorno sin Chrome del sistema también puedes apuntar
  `PUPPETEER_EXECUTABLE_PATH` a un binario de Chromium ya instalado antes
  de correr el script.
- **Símbolos matemáticos faltantes en el PDF** (recuadros vacíos) — revisa
  que la fuente `mainfont` configurada en el script (`DejaVu Sans`) esté
  instalada; en Windows viene con el sistema, en Linux
  `sudo apt install fonts-dejavu`.

## No incluye

Este pipeline no reescribe el contenido de los documentos ni implementa
funcionalidad de la aplicación: solo exporta lo que ya existe en
`Documentacion general/*.md` a PDF, de forma reproducible.
