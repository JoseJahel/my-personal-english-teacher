## 0. Metadatos
- **Hito:** Entrega Final
- **Capa principal:** repo/docs
- **Requisito:** documento técnico § verificación + anexos; 30 % documento
- **Tipo:** docs
- **Asignado (reparto equitativo):** Saúl (@SaulitoRamirezz) — docs; ya en #57/#62
- **Rama:** `saul-frontend`
- **Prioridad:** P0 documental (evidencias medibles)

## 1–2. Contexto / problema
El curso premia trazabilidad y verificación con **métricas**. Tenemos matriz y reporte, pero falta un **registro vivo de decisiones técnicas con evidencia numérica** y una carpeta de evidencias por tema (resample, YIN, MFCC, WER, latencia, calibración score) enlazada desde el documento técnico.

## 3. Objetivo
Crear:
1. `Documentacion general/bitacora-decisiones.md` (o similar) con 8–15 decisiones: contexto → opciones → decisión → métrica → enlace a test/PR.
2. `Documentacion general/evidencias/` con notas cortas (MD) que apunten a tests y resultados (WER bench, dB anti-alias cuando existan, half-score calibración, etc.).
3. Enlaces desde `documento-tecnico.md` y `reporte-verificacion.md`.

## 4–5. Por qué / para qué
El evaluador encuentra en 2 minutos “número + prueba”; sube seriedad del 30 % documento y del 40 % técnico.

## 6. Alcance
### Incluye
- Estructura de carpetas y plantilla de evidencia (1 página máx por nota).
- Popular con lo **ya medido** (bench ASR 2026-07-29, calibración #29, suite Vitest counts).
- Huecos marcados “pendiente de issue #…” (FIR, FFT, MFCC ref) sin inventar números.
### No incluye
- Reescribir todo el marco teórico.
- Datos falsos.

## 7. Mapa
- `Documentacion general/*`
- `calibracion-score-pronunciacion.md`
- `reporte-verificacion.md`

## 9. Enfoque
Plantilla fija por decisión/evidencia; IDs D-01… y E-01…

## 12. Criterios
- [ ] Bitácora con ≥8 decisiones reales del proyecto
- [ ] ≥5 notas de evidencia enlazadas a tests o benches existentes
- [ ] documento-técnico enlaza la bitácora
- [ ] Sin referencias a proyectos ajenos

## 14. DoD
PR mergeado.

**Labels:** `entrega-final`, `type:docs`, `layer:repo`, `person:saul`, `documentation`
