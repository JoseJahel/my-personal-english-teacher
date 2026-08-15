## 0. Metadatos
- **Hito:** Entrega Final
- **Capa principal:** dsp
- **Capas secundarias:** ui, repo/docs
- **Requisito matriz / enunciado:** RF-09, RF-10, RE-04; enunciado: comparación acústica vs referencia
- **Tipo:** story
- **Asignado (reparto equitativo):** Jahel (@JoseJahel) — lote de laboratorio y defensa A2/Final pedido por Jahel; no redistribuye #57–#79
- **Rama de trabajo:** `jahel-frontend`
- **Prioridad rúbrica:** P0 (honestidad del 0–100 en conversación)

## 1. Contexto del producto (para IA y humanos)
El score compara PCM del usuario contra TTS de la frase **corregida** (MFCC z-score + pitch relativo + DTW). Hay calibración de umbrales (#29) y drill contra la línea del tutor (#68). En conversación libre **sí** mostramos 0–100. #75 ya evita puntuar si el ASR no trajo habla útil.

## 2. Problema u oportunidad
- Un score vs TTS puede medir **quién habla** más que **cómo pronuncia** (tracto, F0 medio).
- #29 ajustó `distanceAtHalfScore` con un panel sintético. No publicó Δ(distancia) de “cambiar de locutor” vs “pronunciar mal”.
- Tenemos formantes y z-score: herramientas que un score “a ciegas” no tenía. Si tras medir el locutor sigue ganando, la política de UI debe ser tan honesta como #75.

## 3. Objetivo
Cuando esté cerrado, el repo tiene **cifras propias** (locutor vs error) sobre *nuestro* `scorePronunciationFromMonoPcm`, y una política de UI/docs coherente: o el 0–100 de conversación se sostiene, o se degrada a secundario / solo drill, con copy que no acuse.

## 4. Por qué importa
- Si el profesor pregunta “¿cómo saben que no miden timbre?”, hoy no hay número.
- El experimento da cifras propias. Si hace falta, se usan **formantes + z-score + drill** en vez de apagar el score.

## 5. Para qué
Estudiante: un número que no lo castiga por no ser el vocoder. Evaluador: evidencia RE-04 / RF-10 honesta.

## 6. Alcance
### Incluye
- Protocolo reproducible en `dsp/` (extender `run-pronunciation-score-calibration.ts` o hermano): al menos 2 perfiles de F0 (ya hay A ~120 Hz / B ~210 Hz) × misma frase × “bien” vs “mal” (par mínimo o degradación documentada).
- Métricas publicadas: Δ distancia / Δ score por cambio de locutor vs por error. Constante o tabla en `calibracion-score-pronunciacion.md` + reporte.
- Decisión de producto **escrita** en README/matriz RF-10:
  - si locutor ≪ error: el 0–100 de conversación se queda, con la cifra;
  - si locutor ≳ error: conversación muestra el acústico como secundario o `not-evaluated` salvo drill (#68); copy estilo #75 (“no pude comparar”, no “lo dijiste mal”).
- Tests del protocolo (sintéticos; no subir WAV al repo).

### No incluye
- Corpus de voces reales en Git.
- Cambiar el default ASR.
- Cerrar #58 (energía/formantes en el score): **sí se puede usar** formantes si ya están; no implementar #58 aquí si no está.
- Adoptar una política de score sin las cifras de *este* protocolo.

## 7. Estado actual en el código (mapa para investigar)
- `app/src/dsp/pronunciation-score.ts` — `scorePronunciationFromMonoPcm`
- `app/src/dsp/pronunciation-score-calibration-constants.ts`
- `app/src/dsp/run-pronunciation-score-calibration.ts` + tests
- `app/src/dsp/dynamic-time-warping.ts` — z-score, pitch relativo
- `app/src/ui/pronunciation-score-eligibility.ts` (#75)
- `app/src/ui/use-drill-repetition.ts` (#68)
- `Documentacion general/calibracion-score-pronunciacion.md`

## 8. Dónde investigar la causa / el diseño actual
1. Leer calibración #29 y el mapeo exp(−ln2 · d / d½).
2. Correr tests de calibración.
3. Añadir pares “mismo contenido, distinto F0/formantes sintéticos” vs “mismo locutor, vocal cambiada”.
4. Contrastar con RF-10 y con #75.

## 9. Enfoques de solución aceptables
1. **Recomendado:** medir → decidir. Si hay sesgo, ponderar formantes (#58 si existe) y/o hacer del drill la señal principal.
2. Aceptable: dejar conversación con 0–100 **solo** si las cifras lo respaldan.
3. Prohibido: inventar Δ; apagar el score sin protocolo; audio de personas en el repo.

## 10. Documentación y referencias
- RF-09, RF-10, RE-04
- `calibracion-score-pronunciacion.md`, #29, #68, #75, #58
- `REGLAS-DE-CODIGO.md`

## 11. Plan de implementación sugerido (pasos)
- [ ] Extender protocolo + tests sintéticos
- [ ] Tabla locutor vs error
- [ ] Política UI + textos en `interface-texts.ts`
- [ ] Matriz / README / reporte
- [ ] `cd app; pnpm lint; pnpm test; pnpm build`

## 12. Criterios de aceptación
- [ ] Δ locutor y Δ error publicados (números, no adjetivos)
- [ ] Política RF-10 actualizada y coherente con la UI
- [ ] #75 sigue vigente (sin habla útil no hay 0–100)
- [ ] lint + test + build
- [ ] PR `jahel-frontend` → `main`

## 13. Pruebas
Sintéticas en Vitest. Manual: un drill y un turno de conversación según la política elegida.

## 14. Definición de hecho (DoD)
En `main`. Comentario con la tabla y la decisión (se queda / secundario / solo drill).
