# Calibración del score de pronunciación 0–100 (issue #29)

> **Proyecto:** My Personal English Teacher  
> **Módulos:** `app/src/dsp/pronunciation-score*.ts`,  
> `fit-pronunciation-score-calibration.ts`,  
> `run-pronunciation-score-calibration.ts`,  
> `word-pronunciation-highlights.ts`  
> **Documento relacionado:** [Reporte de verificación](./reporte-verificacion.md) ·  
> [Matriz de trazabilidad](./matriz-trazabilidad.md)

## 1. Objetivo

Ajustar los umbrales del mapeo distancia DTW → score 0–100 (MFCC + pitch) y
las bandas de highlights por palabra (`good` / `medium` / `poor`) con un
**protocolo multi-frase y multi-hablante**, de forma reproducible y documentada
para la entrega final.

Modelo de score (exponencial, dominio puro):

```text
score = 100 * exp( -ln(2) * distance / distanceAtHalfScore )
```

## 2. Protocolo de prueba

| Parámetro | Valor |
|-----------|--------|
| Frases (N) | **8** (banco en `CALIBRATION_PHRASE_BANK_EN`) |
| Hablantes | **2** perfiles (Speaker A ~120 Hz, Speaker B ~210 Hz) |
| Niveles de calidad (rúbrica humana) | **4** — excellent / good / fair / poor |
| Pares etiquetados | **64** (= 8 × 2 × 4) por rama (MFCC y pitch) |
| Sample rate de referencia | 16 kHz mono |
| Mínimo de muestras para el fit | 3 (en la práctica se usan las 64) |

> **Nota — la tasa de trabajo de 16 kHz es una condición de validez, no un
> detalle de implementación.** Estas constantes se ajustaron sobre distancias
> MFCC/pitch calculadas a 16 kHz. Por eso la cadena de scoring (
> `run-pronunciation-scoring.ts`) fija esa tasa de forma explícita en vez de
> heredarla del sintetizador, y remuestrea la referencia del TTS (44.1 kHz en
> Supertonic) a 16 kHz con el FIR de fase lineal ya existente antes de
> comparar. El motivo técnico: a 44.1 kHz el banco de 40 filtros mel se
> reparte hasta 22.05 kHz mientras el pasa-banda corta en 7.5 kHz, dejando
> banda mel por encima del corte pegada al suelo logarítmico y desplazando
> los coeficientes MFCC que estas constantes calibraron.

### 2.1 Banco de frases

1. I would like a glass of water, please.  
2. Where is gate B twelve for my flight?  
3. My name is Ana and I am a software engineer.  
4. Can I have the bill with a card, please?  
5. I need to check in and print my boarding pass.  
6. Could you recommend a vegetarian main course?  
7. I solved a hard project deadline with my team.  
8. Would you like coffee or tea with that order?

### 2.2 Rúbrica humana (0–100)

| Tier | Score de panel | Criterio |
|------|:--------------:|----------|
| excellent | 95 | Misma frase y timing que la referencia (casi nativo) |
| good | 78 | Mismas palabras, cambio leve de velocidad |
| fair | 55 | Desajuste notable de pitch / identidad |
| poor | 28 | Banda incorrecta + ruido — claramente fuera de objetivo |

Los evaluadores pueden ajustar ±5 en casos límite. En el panel offline del
repositorio se aplica un *nudge* determinista de rater (± ~2.4) por índice.

### 2.3 Cómo re-calibrar con hablantes reales

1. Grabar las 8 frases con **≥2 hablantes** en habitación silenciosa (16 kHz mono).  
2. Para cada frase, sintetizar la referencia con el TTS de la app (o una
   referencia nativa fijada).  
3. Medir `mfccNormalizedDistance` / `pitchNormalizedDistance` con
   `scorePronunciationFromMonoPcm`.  
4. Asignar score humano según la rúbrica.  
5. Sustituir `OFFLINE_MULTI_SPEAKER_MFCC_PANEL` /
   `OFFLINE_MULTI_SPEAKER_PITCH_PANEL` en
   `run-pronunciation-score-calibration.ts`.  
6. Ejecutar `runPronunciationScoreCalibration()` y actualizar
   `pronunciation-score-calibration-constants.ts`.  
7. Correr `pnpm test` (el test de alineación de constantes fallará si no se
   actualizan a propósito).
8. Cualquier cambio de motor de voz (TTS) o de tasa de trabajo del score
   obliga a revisar estas constantes: están calibradas para la tasa fijada
   en `run-pronunciation-scoring.ts` (16 kHz), no para la tasa nativa que
   emita el sintetizador de turno.

## 3. Ajustes aplicados al código (justificación)

| Constante | Antes | Después | Justificación |
|-----------|:-----:|:-------:|---------------|
| `DEFAULT_MFCC_DISTANCE_AT_HALF_SCORE` | 18 | **16.5** | Fit LS del panel multi-hablante: la curva pasa por ~50 en d≈16.5 con menor RMSE que 18 |
| `DEFAULT_PITCH_DISTANCE_AT_HALF_SCORE` | 12 | **11.2** | Fit análogo sobre distancias de contorno F0 relativo |
| `DEFAULT_MFCC_SCORE_WEIGHT` | 0.75 | **0.78** | MFCC sigue dominando; pitch como cue secundario tras multi-hablante |
| Highlight `good` | 70 | **72** | Alineado al tier “good” del panel (≥ ~78 humano → banda good en máquina) |
| Highlight `medium` | 45 | **48** | Frontera fair/poor del panel recalibrado |

Fuente de verdad en código:

- `dsp/pronunciation-score-calibration-constants.ts`  
- Consumido por `pronunciation-score.ts` y `word-pronunciation-highlights.ts`

## 4. Tabla de resultados del fit

Corrida: `runPronunciationScoreCalibration()` sobre el panel offline del repo
(64 pares MFCC + 64 pares pitch).

### 4.1 MFCC

| Métrica | Valor |
|---------|------:|
| Muestras usadas | 64 |
| `distanceAtHalfScore` ajustado | ≈ **16.5** (constante de producción) |
| RMSE vs etiquetas humanas (puntos de score) | &lt; 20 (ver test) |
| Score en d = 16.5 | **50** (por construcción del mapeo) |

Distribución de distancias del panel (media por tier):

| Tier | d MFCC (rango aprox.) | Score humano panel |
|------|----------------------:|-------------------:|
| excellent | 1.6 – 2.5 | ~95 |
| good | 6.2 – 7.5 | ~78 |
| fair | 13.5 – 16.2 | ~55 |
| poor | 26.5 – 32.0 | ~28 |

### 4.2 Pitch

| Métrica | Valor |
|---------|------:|
| Muestras usadas | 64 |
| `distanceAtHalfScore` ajustado | ≈ **11.2** |
| Peso en score combinado | 1 − 0.78 = **0.22** |

### 4.3 Highlights por palabra

| Banda | Condición de score de palabra |
|-------|-------------------------------|
| good | score ≥ **72** |
| medium | 48 ≤ score &lt; 72 |
| poor | score &lt; **48** |

## 5. Verificación automatizada

- `dsp/fit-pronunciation-score-calibration.test.ts` — recuperación del parámetro
  en datos sintéticos sin ruido / con ruido.  
- `dsp/run-pronunciation-score-calibration.test.ts` — protocolo 8×2×4, fit del
  panel, alineación de constantes de producción, score≈50 en half-distance.  
- `dsp/pronunciation-score.test.ts` — score relativo matching vs mismatch.
- `dsp/measure-speaker-bias.test.ts` — protocolo locutor vs error (issue #95).

## 6. Sesgo de locutor vs error (issue #95)

Protocolo sintético sobre `scorePronunciationFromMonoPcm` (sin WAV en Git):
misma secuencia de vocales /a i u/ con F0 **120 Hz** (hablante A) vs **210 Hz**
(hablante B), frente a mismo F0 y **otras vocales** (error documentado).

| Condición | Score medio | Δ vs identidad | d MFCC extra |
|-----------|------------:|---------------:|-------------:|
| Mismo locutor, mismas vocales | **100.0** | 0 | 0 |
| Cambio de locutor (120→210 Hz) | **88.7** | **11.3** | **3.24** |
| Error de vocal (mismo F0) | **90.1** | **9.9** | **3.00** |
| Ratio Δlocutor / Δerror | **1.14** | — | — |

**Decisión de producto:** locutor ≳ error. El 0–100 de **conversación se
apaga** (`deferred-to-drill`). La cifra vive en modo **Repetir** (#68). Copy:
no se acusa al estudiante (“no es que lo hayas dicho mal”). Constantes:
`dsp/speaker-bias-invariants.ts`. #75 sigue cortando silencio/`[Music]`.
Tras issue #58 el combinado incluye energía y formantes (pesos provisionales
0.68 / 0.18 / 0.07 / 0.07); las cifras de esta tabla se re-midieron sobre
ese score. No es un re-fit del panel #29.

## 7. Limitaciones

- El panel versionado en el repo es un **corpus de calibración offline**
  multi-condición / multi-hablante; no incluye audio crudo (prohibido por
  diseño).  
- Con hablantes reales en la demo del aula se espera re-medir distancias y
  re-fijar constantes si el RMSE del panel nuevo supera ~15 puntos.  
- El score compara contra **TTS de referencia**, no contra un hablante nativo
  grabado. Issue #95 midió que z-score + pitch relativo **no** bastan: el
  cambio de F0 mueve el 0–100 tanto o más que cambiar las vocales. Por eso
  conversación no muestra esa nota.
