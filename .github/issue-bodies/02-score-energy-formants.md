## 0. Metadatos
- **Hito:** Avance 2 / Entrega Final
- **Capa principal:** dsp
- **Capas secundarias:** ui (desglose), docs (matriz)
- **Requisito matriz / enunciado:** RF-09 — *Análisis acústico comparativo vs referencia (pitch/energía/MFCC/formantes)*; enunciado: comparación de pitch, energía, formantes vs referencia
- **Tipo:** story
- **Asignado (reparto equitativo):** Luna (@luna0809-oss) — carga media-baja en commits; continuidad con #29/#30 DSP-audio
- **Rama de trabajo:** `luna-frontend`
- **Prioridad rúbrica:** P0 (incumplimiento literal del core de señales)

## 1. Contexto del producto (para IA y humanos)
La evaluación de pronunciación es el corazón de Señales y Sistemas en este proyecto: features acústicas del usuario vs una referencia TTS (SpeechT5), alineadas con DTW. El dominio DSP es **puro** (sin React/DOM). La UI solo muestra resultados.

## 2. Problema u oportunidad
- **Hoy:** `scorePronunciationFromMonoPcm` combina **MFCC + pitch** (YIN). Formantes se estiman (`formant-estimation.ts`) y se muestran en UI (mediana F1–F3) pero **no entran al score**. Energía (`signal-energy.ts`) se usa como **gate** pre-ASR, no como distancia vs referencia.
- **Enunciado (literal):** análisis comparativo de pitch, **energía**, **formantes** (y MFCC en práctica del curso) vs referencia; feedback con puntaje.
- **No cumple estricto:** RF-09 no está cerrado al pie de la letra.

## 3. Objetivo
El score (o un desglose oficial del score) incorpore componentes de **energía** y **formantes** del usuario vs la referencia TTS, con tests deterministas y UI que exponga el desglose.

## 4. Por qué importa
- Calidad técnica 40 %: aplicación correcta de señales.
- Defensa oral: poder señalar “comparamos F1–F3 y energía, no solo MFCC”.
- Cierra el gap de auditoría estricta del Avance 2/Final.

## 5. Para qué
El estudiante ve un feedback de pronunciación alineado con el marco teórico; el evaluador verifica el requisito del enunciado.

## 6. Alcance
### Incluye
- Extender `pronunciation-score.ts` (o módulos puros hermanos) con:
  - Distancia/similitud de **energía** (p. ej. contorno RMS por frames o energía global normalizada) user vs ref.
  - Distancia de **formantes** (p. ej. mediana F1–F2–F3 o contorno suavizado) user vs ref.
- Pesos configurables; defaults documentados (MFCC sigue siendo dominante es aceptable).
- Tests sintéticos (tonos / ruidos / formantes sintéticos) en Vitest.
- Exponer desglose en el tipo de resultado y en UI (`build-home-screen-view-model` / textos ES).
- Actualizar fila RF-09 (y RF-10 si el desglose cambia) en la matriz.

### No incluye
- Reemplazar MFCC/DTW.
- Calibración multi-hablante completa de los nuevos pesos (puede quedar documentada como siguiente paso).
- Filtrado adaptativo de ruido (issue aparte).
- Cambiar modelos HF.

## 7. Estado actual en el código (mapa para investigar)
- `app/src/dsp/pronunciation-score.ts` — `scorePronunciationFromMonoPcm`
- `app/src/dsp/formant-estimation.ts`
- `app/src/dsp/signal-energy.ts`
- `app/src/dsp/dynamic-time-warping.ts`
- `app/src/dsp/pronunciation-score-calibration-constants.ts`
- `app/src/ui/run-pronunciation-scoring.ts`
- `app/src/ui/build-home-screen-view-model.ts` — ya formatea formants summary
- Tests: `pronunciation-score.test.ts`, `formant-estimation.test.ts`, `signal-energy.test.ts`

## 8. Dónde investigar la causa / el diseño actual
1. Leer `pronunciation-score.ts` de arriba abajo: ver ramas MFCC y pitch.
2. Leer cómo la UI llama al score (`run-pronunciation-scoring.ts`).
3. Leer `formant-estimation.ts` API pública (qué devuelve por utterance).
4. Leer `signal-energy.ts` (RMS/pico) y decidir feature comparable frame a frame o global.
5. Revisar `Documentacion general/calibracion-score-pronunciacion.md` para no romper la curva MFCC sin documentarlo.
6. Ejecutar `cd app; pnpm test -- pronunciation-score`

## 9. Enfoques de solución aceptables
1. **Recomendado:** score combinado  
   `w_mfcc*S_mfcc + w_pitch*S_pitch + w_energy*S_energy + w_formant*S_formant`  
   con pesos que sumen 1; si una rama no es usable → redistribuir pesos (como pitch null hoy).
2. Score principal MFCC+pitch + **sub-scores informativos** de energía/formantes siempre visibles (cumple “comparación” si el enunciado se interpreta como análisis+feedback; menos ideal si piden un único score “de señales”).
3. DTW sobre vectores [MFCC | formant proxies | log-energy] — más ambicioso; solo si cabe en ≤400 líneas/archivo.

Prohibido: dependencia runtime Meyda; lógica DSP dentro de JSX; enviar audio a red.

## 10. Documentación y referencias obligatorias
- Enunciado: corrección de pronunciación + features acústicas.
- `app/src/dsp/README.md`
- `Documentacion general/documento-tecnico.md` § marco teórico formantes/energía
- `Documentacion general/REGLAS-DE-CODIGO.md` (archivo ≤400 líneas, dominio puro)
- `Documentacion general/GUIA-CREACION-ISSUES.md`
- Issue #29 (calibración MFCC/pitch)

## 11. Plan de implementación sugerido
1. Funciones puras: distancia energía; distancia formantes.
2. Tests sintéticos.
3. Integrar en `scorePronunciationFromMonoPcm` + tipo de resultado.
4. Cablear desglose en view-model + `interface-texts.ts`.
5. Actualizar matriz RF-09.
6. `pnpm lint` / `test` / `build`.

## 12. Criterios de aceptación
- [ ] Existe comparación numérica user vs ref para **energía** y **formantes**
- [ ] El resultado del score expone esos componentes (no solo logs)
- [ ] UI muestra desglose legible en español
- [ ] Tests Vitest nuevos o extendidos pasan de forma determinista
- [ ] MFCC+pitch existentes no regresan (tests previos verdes)
- [ ] Archivos tocados respetan ≤ ~400 líneas o se parten
- [ ] Matriz RF-09 actualizada
- [ ] CI local: lint + test + build

## 13. Pruebas
- Unitarias: señales sintéticas con formantes/energía controladas.
- Manual: un turno en escenario restaurante; ver score + desglose.
- Smoke: mic sigue funcionando; score no NaN en silencio (gate previo).

## 14. Definición de hecho (DoD)
- PR desde `luna-frontend` → `main` mergeado.
- Comentario con captura o nota del desglose en UI.
- Issue cerrado.

**Labels sugeridos:** `avance-2`, `entrega-final`, `type:story`, `layer:dsp`, `layer:ui`, `person:luna`, `enhancement`
