## 0. Metadatos
- **Hito:** Avance 2
- **Capa principal:** repo/docs (artefacto de presentación)
- **Capas secundarias:** ui (capturas)
- **Requisito matriz / enunciado:** *Cada avance incluye presentación de simulación (PowerPoint o similar, 10–15 minutos + demo en vivo)*; rúbrica Presentación 20 %
- **Tipo:** docs
- **Asignado (reparto equitativo):** César (@cesarubau-droid) — segundo ticket del lote; #28 fue presentación Final genérica y no hay `.pptx` de A2 en el repo
- **Rama de trabajo:** `cesar-frontend`
- **Prioridad rúbrica:** P0 para la ventana A2 (17–22/08/2026)

## 1. Contexto del producto
En la ventana de Avance 2 el curso evalúa conversación integrada, pronunciación con señales, sugerencias y mejoras, más la **presentación + demo**. El código de A2 ya está en gran parte en `main`; falta el artefacto de presentación alineado al estado real (y a los gaps que se estén cerrando en paralelo).

## 2. Problema
No hay en el repositorio un deck (`.pptx` / PDF de slides) específico de **Avance 2** listo para 10–15 minutos. El issue #28 se orientó a Final y no deja un archivo de slides versionado visible.

## 3. Objetivo
Entregar una presentación de **10–15 min** para Avance 2 con guion de demo en vivo localhost, capturas actualizadas, y mención honesta de lo implementado vs limitaciones (latencia, sugerencias si aún en PR, etc.).

## 4. Por qué importa
- 20 % de la rúbrica.
- Fecha A2 cercana; sin deck se improvisa y se pierde claridad.

## 5. Para qué
Defensa oral del equipo ante el profesor con estructura profesional.

## 6. Alcance
### Incluye
- Archivo de presentación en el repo, p. ej. `Documentacion general/entregas/avance-2-presentacion.pptx` (o PDF de slides).
- Estructura sugerida:
  1. Problema y justificación (2 min)
  2. Arquitectura de capas (2 min)
  3. Pipeline demo en vivo (5–7 min)
  4. DSP (YIN, MFCC, DTW, score) (2–3 min)
  5. Limitaciones y trabajo hacia Final (1–2 min)
- Capturas reales de la app (home, chat, score, visualizaciones).
- Checklist de demo: `pnpm build && pnpm preview`, modelos precargados, Chromium.

### No incluye
- Implementar features de código (salvo capturas tras merge de otros issues).
- Video largo obligatorio (opcional).

## 7. Estado actual
- `app/README.md` checklist offline
- `_claude/artifacts/screenshots/` (pueden servir de base; verificar que no estén obsoletas)
- Issue #28 (Final) — referencia de alcance, no sustituye A2

## 8. Investigación
1. Releer enunciado § Avance 2 y criterios de evaluación.
2. Correr la app y capturar pantallas actuales.
3. Alinear mensajes con matriz/README post-sync.
4. Ensayar tiempo 10–15 min.

## 9. Enfoques aceptables
1. **Recomendado:** PowerPoint/Google Slides exportado a `.pptx` versionado en el repo.
2. PDF de diapositivas.
Prohibido: solo un documento de texto sin estructura de presentación.

## 10. Referencias
- Enunciado estructura de entregas.
- `README.md` Estado y flujo de demo.
- `documento-tecnico.md` arquitectura.
- `GUIA-CREACION-ISSUES.md`

## 11. Plan
1. Outline de slides.
2. Capturas.
3. Armar deck.
4. Ensayo de tiempos.
5. PR con el archivo.

## 12. Criterios de aceptación
- [ ] Archivo de presentación en el repo
- [ ] Cubrae conversación + pronunciación/DSP + demo plan
- [ ] Duración pensada 10–15 min (notas del presentador o comentario en PR)
- [ ] Limitaciones honestas (latencia ASR, etc.)
- [ ] Sin secretos

## 13. Pruebas
- Ensayo oral del equipo (al menos una pasada).
- Abrir el archivo en PowerPoint/LibreOffice.

## 14. DoD
- PR mergeado; ruta del deck en el comentario de cierre; issue cerrado.

**Labels sugeridos:** `avance-2`, `type:docs`, `layer:repo`, `layer:ui`, `person:cesar`, `documentation`
