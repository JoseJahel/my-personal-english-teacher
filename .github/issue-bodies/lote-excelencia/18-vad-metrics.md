## 0. Metadatos
- **Hito:** Entrega Final
- **Capa principal:** dsp
- **Requisito:** RF-20 VAD; § verificación con métricas
- **Tipo:** story
- **Asignado (reparto equitativo):** César (@cesarubau-droid) — tercer ticket del lote excelencia; VAD ya cableado en sesión de mic
- **Rama:** `cesar-frontend`
- **Prioridad:** P1

## 1–2. Contexto / problema
Existe `voice-activity-detection.ts` y auto-stop, con tests de comportamiento. Faltan **métricas de borde** publicables: error de inicio/fin de habla en ms sobre señales sintéticas (silencio–tono–silencio) y, si aplica, % de frames no enviados al ASR.

## 3. Objetivo
Extender tests del VAD con señales sintéticas etiquetadas; reportar en `reporte-verificacion.md` adelanto/atraso de detección en ms y criterio de aceptación.

## 4–5. Por qué / para qué
Convierte el VAD de “feature UX” a “módulo de señales medido”.

## 6. Alcance
### Incluye
- Generadores de PCM sintético en test.
- Métricas start/end error.
- Fila en reporte + estado RF-20 si aplica.
### No incluye
- Redes neuronales de VAD.
- Cambiar hangover salvo que los tests lo justifiquen (documentar).

## 7. Mapa
- `dsp/voice-activity-detection.ts` + test
- `ui/use-home-microphone-session.ts` (consumo)

## 12. Criterios
- [ ] Tests con error de borde medido
- [ ] Números en reporte de verificación
- [ ] Auto-stop real no regresa
- [ ] lint/test/build

## 14. DoD
PR mergeado.

**Labels:** `entrega-final`, `type:story`, `layer:dsp`, `person:cesar`
