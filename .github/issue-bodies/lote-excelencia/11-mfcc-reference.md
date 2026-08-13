## 0. Metadatos
- **Hito:** Entrega Final
- **Capa principal:** dsp
- **Requisito:** RF-15 MFCC propios; calidad técnica 40 %
- **Tipo:** story
- **Asignado (reparto equitativo):** Jahel (@JoseJahel)
- **Rama:** `jahel-frontend`
- **Prioridad:** P0 diferenciación

## 1–2. Contexto / problema
MFCC es nuclear del curso. Hay implementación y tests sintéticos, pero **no hay fixture de referencia cruzada** (p. ej. vector MFCC esperado generado offline y versionado en JSON) ni error máximo documentado vs referencia.

## 3. Objetivo
Añadir validación reproducible de `extractMfccSequence` contra fixture de referencia (generado offline una vez; **sin** dependencia runtime de librosa/Python en la app). Publicar error máximo en el reporte.

## 4–5. Por qué / para qué
Demuestra que “MFCC propios” no es caja negra improvisada; sube nota técnica y confianza del score.

## 6. Alcance
### Incluye
- Script o instrucciones **opcionales** en docs para regenerar fixture (Python/librosa) — el fixture JSON **sí** va al repo.
- Test Vitest que compare coeficientes (c1–c12 o política documentada sobre c0) con tolerancia.
- Fila en reporte de verificación.
### No incluye
- Dependencia Python en CI obligatoria (solo fixture estático).
- Meyda en runtime.

## 7. Mapa
- `app/src/dsp/mfcc-extraction.ts` + `.test.ts`
- `pronunciation-score.ts` (consumidor)

## 8–9.
Investigar parámetros (25 ms, hop 10 ms, 40 mel, pre-énfasis 0.97) y alinear fixture.  
Enfoque: JSON de señal corta + MFCC esperados.

## 12. Criterios
- [ ] Fixture versionado
- [ ] Test falla si se rompe el MFCC
- [ ] Error máx documentado
- [ ] CI verde

## 14. DoD
PR mergeado.

**Labels:** `entrega-final`, `type:story`, `layer:dsp`, `person:jahel`
