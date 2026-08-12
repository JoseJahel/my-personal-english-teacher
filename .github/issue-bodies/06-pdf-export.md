## 0. Metadatos
- **Hito:** Avance 2 (paquete documental) / Entrega Final
- **Capa principal:** repo/docs
- **Requisito matriz / enunciado:** *Cada avance y la entrega final incluyen: Documento técnico (PDF o .docx)*
- **Tipo:** docs
- **Asignado (reparto equitativo):** Saúl (@SaulitoRamirezz) — segundo ticket del lote (docs); dueño de #32 MD
- **Rama de trabajo:** `saul-frontend`
- **Prioridad rúbrica:** P0 (artefacto de entrega ausente en el repo pese a MD)

## 1. Contexto del producto (para IA y humanos)
El documento técnico vive en Markdown versionable (`documento-tecnico.md` + matriz + reporte). El curso exige entrega en **PDF o .docx**. El issue #32 se cerró sobre el contenido MD; **no hay PDF de entrega versionado** en el árbol del proyecto.

## 2. Problema u oportunidad
Sin PDF/.docx, el entregable formal del 30 % Documento no está completo aunque el contenido exista.

## 3. Objetivo
Generar y versionar (o adjuntar en la ruta acordada del repo) un **PDF de entrega** del documento técnico completo, con estructura del enunciado, y un procedimiento reproducible de export (pandoc u otra herramienta documentada).

## 4. Por qué importa
- Requisito explícito por avance y final.
- Evita entrega de última hora improvisada.

## 5. Para qué
Subida a la plataforma del curso y revisión del profesor sin depender de render GitHub.

## 6. Alcance
### Incluye
- Pipeline documentado: MD → PDF (p. ej. pandoc + motor PDF; Mermaid pre-render o figuras exportadas).
- PDF resultante en ruta clara, p. ej. `Documentacion general/entregas/` o similar.
- Incluir o enlazar matriz y verificación (un PDF unificado o paquete de PDFs).
- README corto de cómo regenerar el PDF en Windows.

### No incluye
- Reescribir todo el marco teórico.
- Implementar features de la app.
- Hosting del PDF en la nube como “app”.

## 7. Estado actual
- `Documentacion general/documento-tecnico.md`
- `Documentacion general/matriz-trazabilidad.md`
- `Documentacion general/reporte-verificacion.md`
- Issue #32 cerrado (contenido MD)

## 8. Dónde investigar
1. Leer índice del documento técnico vs estructura obligatoria del enunciado.
2. Probar export local (pandoc / VS Code / Word).
3. Resolver ecuaciones KaTeX y diagramas Mermaid (export a PNG si el PDF no renderiza Mermaid).
4. Coordinar con issue de sync de docs para no exportar estados viejos (dependencia: preferible mergear sync antes).

## 9. Enfoques aceptables
1. **Recomendado:** pandoc → PDF + script `docs/export-technical-document.ps1` o instrucciones en MD.
2. Export manual Word → PDF con el mismo contenido (aceptable si se documenta y el PDF se versiona).
Prohibido: entregar solo enlace a raw markdown como “PDF”.

## 10. Referencias
- Enunciado § Estructura de Entregas + estructura del documento.
- `documento-tecnico.md` cabecera (ya menciona Markdown→PDF).
- `GUIA-CREACION-ISSUES.md`

## 11. Plan
1. Esperar o incorporar sync de estados.
2. Definir herramienta de export.
3. Generar PDF.
4. Añadir instrucciones de regeneración.
5. PR.

## 12. Criterios de aceptación
- [ ] Existe al menos un archivo PDF (o .docx) de documento técnico de entrega en el repo
- [ ] Cubre las secciones obligatorias del enunciado (aunque matriz/verificación sean anexos)
- [ ] Procedimiento de regeneración documentado
- [ ] No secretos ni `_private/`

## 13. Pruebas
- Abrir el PDF en un lector y comprobar índice y legibilidad de ecuaciones/diagramas.
- Otra persona del equipo verifica que se puede regenerar siguiendo las instrucciones.

## 14. Definición de hecho
- PR mergeado; PDF en ruta acordada; issue cerrado con ruta del archivo.

**Labels sugeridos:** `entrega-final`, `avance-2`, `type:docs`, `layer:repo`, `person:saul`, `documentation`
