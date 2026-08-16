#!/usr/bin/env python3
"""Exporta el documento técnico (+ matriz de trazabilidad + reporte de
verificación) a un PDF único de entrega.

Requisitos (ver instrucciones de instalación en el README de esta carpeta):
  - pandoc
  - un motor LaTeX (xelatex recomendado; pdflatex también funciona), con
    soporte de hyphenation en español (p. ej. `texlive-lang-spanish` en
    Debian/Ubuntu; MiKTeX/TeX Live completos en Windows ya lo incluyen) y el
    paquete `pdflscape` (incluido en cualquier instalación "full"/"recommended"
    de TeX Live o MiKTeX).
  - Node.js + @mermaid-js/mermaid-cli (`npm install -g @mermaid-js/mermaid-cli`)
    para pre-renderizar los diagramas Mermaid a imágenes, porque pandoc no
    renderiza Mermaid de forma nativa.

Uso:
    python3 export-technical-document.py

Genera:
    Documentacion general/entregas/documento-tecnico-entrega-final.pdf
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCS_DIR = REPO_ROOT / "Documentacion general"
OUTPUT_DIR = DOCS_DIR / "entregas"
OUTPUT_PDF = OUTPUT_DIR / "documento-tecnico-entrega-final.pdf"

SOURCE_FILES = [
    DOCS_DIR / "documento-tecnico.md",
    DOCS_DIR / "matriz-trazabilidad.md",
    DOCS_DIR / "reporte-verificacion.md",
]

MERMAID_BLOCK_RE = re.compile(r"```mermaid\n(.*?)\n```", re.S)
# Emoji sin glifo garantizado en las fuentes LaTeX por defecto (p. ej. ➡️).
# Estos reemplazos solo afectan al PDF generado; los .md fuente conservan el
# emoji original para el render en GitHub.
EMOJI_REPLACEMENTS = {
    "➡️": "→",
    "✅": "",
}

# Documentos con tablas muy anchas (muchas columnas de texto denso): se
# tipografían en landscape + letra más pequeña para que las columnas no se
# encimen en tamaño carta/portrait. Se marcan con centinelas de texto plano
# (no LaTeX crudo: si se envuelve markdown directamente en
# \begin{landscape}...\end{landscape} en la fuente, pandoc con la extensión
# raw_tex trata ese bloque como LaTeX opaco y deja de parsear las tablas
# dentro — por eso el intercambio landscape se hace después, a nivel .tex).
WIDE_TABLE_DOCS = {"matriz-trazabilidad", "reporte-verificacion"}
LANDSCAPE_START_MARKER = "ZZPDLANDSCAPESTARTZZ"
LANDSCAPE_END_MARKER = "ZZPDLANDSCAPEENDZZ"


def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        sys.exit(
            f"Error: no se encontró '{name}' en PATH. Revisa "
            f"'Documentacion general/scripts/README.md' para instrucciones "
            f"de instalación."
        )


def render_mermaid_diagrams(markdown_text: str, build_dir: Path, doc_stem: str) -> str:
    """Reemplaza cada bloque ```mermaid por una imagen PNG pre-renderizada."""

    puppeteer_config = build_dir / "puppeteer-config.json"
    if not puppeteer_config.exists():
        # Configuración mínima; en CI/Linux sin Chrome del sistema puede
        # hacer falta apuntar executablePath a un Chromium instalado (ver
        # README de esta carpeta) vía la variable de entorno
        # PUPPETEER_EXECUTABLE_PATH.
        puppeteer_config.write_text(
            '{"args": ["--no-sandbox", "--disable-setuid-sandbox"]}',
            encoding="utf-8",
        )

    counter = 0

    def _replace(match: re.Match) -> str:
        nonlocal counter
        counter += 1
        mmd_path = build_dir / f"{doc_stem}-diagram-{counter}.mmd"
        png_path = build_dir / f"{doc_stem}-diagram-{counter}.png"
        mmd_path.write_text(match.group(1), encoding="utf-8")
        subprocess.run(
            [
                "mmdc",
                "-i",
                str(mmd_path),
                "-o",
                str(png_path),
                "-b",
                "white",
                "-w",
                "1400",
                "--scale",
                "2",
                "-p",
                str(puppeteer_config),
            ],
            check=True,
        )
        return f"![]({png_path.as_posix()})"

    return MERMAID_BLOCK_RE.sub(_replace, markdown_text)


def sanitize_emoji(markdown_text: str) -> str:
    for emoji, replacement in EMOJI_REPLACEMENTS.items():
        markdown_text = markdown_text.replace(emoji, replacement)
    return markdown_text


def build_combined_markdown(build_dir: Path) -> Path:
    parts = []
    for i, source in enumerate(SOURCE_FILES):
        text = source.read_text(encoding="utf-8")
        text = render_mermaid_diagrams(text, build_dir, source.stem)
        text = sanitize_emoji(text)
        if i > 0:
            # Salto de página antes de cada documento adicional.
            parts.append("\n\n\\newpage\n\n")
        if source.stem in WIDE_TABLE_DOCS:
            parts.append(f"\n\n{LANDSCAPE_START_MARKER}\n\n")
            parts.append(text)
            parts.append(f"\n\n{LANDSCAPE_END_MARKER}\n\n")
        else:
            parts.append(text)

    combined = "\n".join(parts)
    combined_path = build_dir / "combined.md"
    combined_path.write_text(combined, encoding="utf-8")
    return combined_path


def apply_landscape_swap(tex_path: Path) -> None:
    """Post-procesa el .tex: cambia los centinelas de texto plano por los
    comandos LaTeX de landscape + letra pequeña. Se hace a nivel .tex (no en
    el markdown) para no romper el parseo de las tablas."""

    tex = tex_path.read_text(encoding="utf-8")
    tex = tex.replace(
        LANDSCAPE_START_MARKER,
        "\\begin{landscape}\n\\footnotesize\n"
        "\\setlength{\\tabcolsep}{8pt}\n"
        "\\renewcommand{\\arraystretch}{1.2}\n",
    )
    tex = tex.replace(
        LANDSCAPE_END_MARKER, "\n\\normalsize\n\\end{landscape}\n"
    )
    tex_path.write_text(tex, encoding="utf-8")


def main() -> None:
    require_tool("pandoc")
    require_tool("mmdc")
    if shutil.which("xelatex") is None and shutil.which("pdflatex") is None:
        sys.exit(
            "Error: no se encontró xelatex ni pdflatex. Instala una "
            "distribución LaTeX (ver README de esta carpeta)."
        )
    pdf_engine = "xelatex" if shutil.which("xelatex") else "pdflatex"

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="mpet-pdf-build-") as tmp:
        build_dir = Path(tmp)
        combined_md = build_combined_markdown(build_dir)
        tex_path = build_dir / "combined.tex"

        # 1) Markdown -> .tex standalone (sin compilar todavía).
        to_tex_cmd = [
            "pandoc",
            str(combined_md),
            "-s",
            "-o",
            str(tex_path),
            f"--pdf-engine={pdf_engine}",
            "--toc",
            "--toc-depth=2",
            "-V",
            "geometry:margin=2cm",
            "-V",
            "fontsize=10pt",
            "-V",
            "colorlinks=true",
            "-V",
            "lang=es",
            "-V",
            "mainfont=DejaVu Sans",
            "-V",
            "monofont=DejaVu Sans Mono",
            "-V",
            "header-includes=\\usepackage{pdflscape}",
            "--metadata",
            "title=My Personal English Teacher — Documento técnico de entrega",
            "--metadata",
            "date=Entrega Final",
        ]
        subprocess.run(to_tex_cmd, check=True, cwd=build_dir)

        # 2) Reemplazar los centinelas por los comandos landscape reales.
        apply_landscape_swap(tex_path)

        # 3) Compilar el .tex ya parcheado (dos pasadas para la TOC).
        for _ in range(2):
            subprocess.run(
                [pdf_engine, "-interaction=nonstopmode", tex_path.name],
                check=True,
                cwd=build_dir,
            )

        built_pdf = tex_path.with_suffix(".pdf")
        shutil.copy(built_pdf, OUTPUT_PDF)

    print(f"PDF generado en: {OUTPUT_PDF}")


if __name__ == "__main__":
    main()
