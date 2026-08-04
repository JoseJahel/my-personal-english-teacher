# Plan y reporte de verificación

> **Proyecto:** My Personal English Teacher — PWA offline de práctica de inglés
> (curso Señales y Sistemas).
> **Sección del documento técnico:** 7 (Etapa de desarrollo y verificación).
> **Documentos relacionados:** [Documento técnico](./documento-tecnico.md) ·
> [Matriz de trazabilidad](./matriz-trazabilidad.md).

Esta sección reporta la verificación de funcionalidades exigida por el
enunciado: casos de prueba unitarios/integración, métricas cuantitativas (WER
para ASR, latencia), edge cases, y conclusiones/limitaciones.

## 1. Metodología de verificación

El proyecto sigue una metodología **iterativa (Agile-like)** alineada a los
tres hitos del curso (Avance 1 / Avance 2 / Entrega Final). La verificación se
apoya en tres niveles complementarios:

1. **Pruebas automatizadas (Vitest).** Suite unitaria y de integración sobre el
   dominio puro (`dsp/`, `ia/`, `audio/`, `storage/`) y la orquestación de UI
   (`ui/`). El dominio no depende de React ni del DOM, lo que permite probar la
   lógica de señales e inferencia sin navegador.
2. **Integración continua (GitHub Actions).** Cada push a `main` y cada Pull
   Request ejecuta el pipeline `ci`: `pnpm lint` → `pnpm exec tsc --noEmit` →
   `pnpm test` → `pnpm build`. Un cambio no se integra si cualquiera de las
   cuatro etapas falla.
3. **Banco de pruebas ASR (solo desarrollo).** Pantalla `#asr-benchmark` que
   graba fixtures de voz propias, corre los candidatos Whisper contra los
   backends WASM y WebGPU y mide **WER** y **latencia** por combinación, con
   export a CSV/JSON. Es la fuente de la decisión del modelo ASR de producción.

> **Nota de reproducibilidad de este reporte.** Las cifras de la suite provienen
> de la enumeración estática de los archivos `*.test.ts` del repositorio y de la
> **última corrida verde del CI sobre `main`** (workflow `ci`, corrida
> `#30869773890`, commit `#42` *pin HF model SHAs and sync README*,
> 2026-08-04, duración 57 s, resultado **success**). Las cifras de WER y
> latencia por modelo corresponden al **banco de pruebas del 2026-07-29** sobre
> la máquina de referencia; no se re-ejecutaron para este documento porque el
> banco requiere navegador con micrófono y las fixtures de voz nunca se
> versionan en Git. Cualquier re-medición en el hardware de demo debe rehacerse
> con `#asr-benchmark` y actualizar la tabla de la §4.

## 2. Cobertura de pruebas automatizadas

La suite Vitest cuenta con **44 archivos de prueba** y **280 casos**
(`it`/`test`), distribuidos por capa:

| Capa | Archivos de prueba | Casos | Qué verifica |
|------|:------------------:|:-----:|--------------|
| `dsp/` | 9 | 72 | Energía/gate, YIN, MFCC, DTW, score, espectrograma, VAD, formantes, highlights |
| `ia/` | 12 | 92 | ASR, gramática, TTS, tutor, worker/cliente, registro de modelos, device policy, WER |
| `audio/` | 5 | 23 | Resample, mono, normalización, trim de silencio, frame buffer |
| `storage/` | 4 | 12 | Schema IndexedDB, tipos de sesión, store de fixtures del banco |
| `ui/` | 13 | 79 | Orquestación de turno, estados de pantalla, chat, tutor, canvas, banco ASR |
| raíz | 1 (+`theme`) | 4 | Ruteo (`app-routing`), freeze-guard de paleta (`theme-tokens`) |
| **Total** | **44** | **280** | — |

### 2.1 Casos por módulo crítico (extracto)

| Módulo | Archivo de prueba | Casos | Foco de verificación |
|--------|-------------------|:-----:|----------------------|
| DTW | `dsp/dynamic-time-warping.test.ts` | 14 | Alineación monótona, distancia L2 acumulada, secuencias de distinto largo |
| Signal energy / gate | `dsp/signal-energy.test.ts` | 11 | RMS/pico, umbral de duración, rechazo de silencio |
| MFCC | `dsp/mfcc-extraction.test.ts` | 10 | Banco mel, DCT-II, dimensiones (13 coef), pre-énfasis |
| YIN | `dsp/pitch-detection-yin.test.ts` | 10 | F0 en banda 70–400 Hz, frames no sonoros, contorno |
| Device policy | `ia/resolve-inference-device.test.ts` | 14 | WebGPU→WASM fallback, política por modelo |
| Gramática | `ia/grammar-correction.test.ts` | 13 | Corrección post-utterance, casos límite de texto |
| Tutor (reglas) | `ui/tutor-reply-engine.test.ts` | 18 | Respaldo determinista por escenario, insignia honesta |
| Sugerencias | `ia/conversation-suggestions.test.ts` | 12 | Generación, memoria de turnos, saneo |
| WER | `ia/word-error-rate.test.ts` | 7 | Levenshtein por palabra, S/D/I, normalización |
| Transcripción | `ia/transcription-text.test.ts` | 9 | Filtro de etiquetas no-habla (p. ej. `[Music]`) |

**Resultado:** las 280 pruebas pasan en el CI (etapa *Ejecutar pruebas* en
verde en la última corrida de `main`). No hay pruebas marcadas como `skip` ni
`todo` en el pipeline de integración.

## 3. Métrica WER: metodología

El WER se calcula en `ia/word-error-rate.ts` sin dependencias de navegador:

- Ambas cadenas (referencia e hipótesis) se **normalizan**: minúsculas, se
  elimina puntuación conservando letras/dígitos Unicode, se colapsan espacios y
  se parte en palabras.
- Se alinea con **distancia de edición de Levenshtein a nivel de palabra** y se
  retrocede la matriz para contar **sustituciones (S)**, **eliminaciones (D)** e
  **inserciones (I)** por separado.
- **WER = (S + D + I) / N**, con `N` = número de palabras de la referencia.

Esta métrica es la que usa el banco `#asr-benchmark` para comparar candidatos.

## 4. Resultados del banco ASR (bench 2026-07-29)

Catálogo de candidatos Whisper evaluados (revisiones ancladas a SHA en
`ia/model-registry.ts`), sobre backends **WASM (q8)** y **WebGPU (fp32)**:

| Candidato | Modelo HF | Descarga aprox. | WER (fixtures ref.) | Latencia WebGPU | Latencia WASM | Veredicto |
|-----------|-----------|:---------------:|:-------------------:|:---------------:|:-------------:|-----------|
| `tiny-en` | `Xenova/whisper-tiny.en` | ~40 MB | — (base A1, mayor error) | rápida | rápida | Descartado por precisión |
| `base-en` | `Xenova/whisper-base.en` | ~75 MB | — | media | media | Catálogo |
| `distil-small-en` | `onnx-community/distil-small.en` | ~170 MB | — | media | alta | Catálogo |
| **`small-en`** ✅ | `Xenova/whisper-small.en` | ~250 MB | **0.000** | **~3.4 s/frase** | ~11 s/frase | **Default de producción** |

**Decisión de modelo:** `whisper-small.en` es el default de producción por
**mejor WER (0.000 en las fixtures de referencia)**. Requiere **WebGPU** para
una latencia de demo viable (~3.4 s/frase); en WASM puro ronda ~11 s/frase y
**no es viable**. Por eso el device policy (`ia/resolve-inference-device.ts`)
auto-detecta WebGPU para ASR y cae a WASM solo si no hay adapter. Gramática,
TTS y SmolLM2 corren siempre en WASM.

> Las celdas de WER de los candidatos no ganadores quedan a re-medir en el
> hardware de demo con `#asr-benchmark`; el default se fijó por el WER de
> `small-en` frente al resto en la corrida de referencia.

## 5. Latencia (criterio del enunciado: < 2 s donde aplique)

| Etapa del pipeline | Backend | Latencia observada | Cumple < 2 s |
|--------------------|---------|:------------------:|:------------:|
| ASR (`small-en`) | WebGPU | ~3.4 s/frase | No (ver limitación L-1) |
| ASR (`small-en`) | WASM | ~11 s/frase | No |
| Gate de energía + espectrograma + pitch | CPU (dominio puro) | < 100 ms | Sí |
| Gramática (T5) | WASM | dependiente de frase | Parcial |
| Score de pronunciación (MFCC+DTW) | CPU | < 200 ms | Sí |
| Tutor híbrido (SmolLM2) | WASM | timeout de 10 s + respaldo de reglas | Acotado por diseño |

El DSP local (visualizaciones, gate, score) es holgadamente sub-2 s. El costo
está en la inferencia de los modelos; ver limitaciones.

## 6. Casos de prueba y edge cases

| # | Caso | Entrada | Resultado esperado | Cobertura |
|---|------|---------|--------------------|-----------|
| CP-01 | Habla válida en escenario | Utterance con voz | ASR→gramática→tutor→score→TTS completo | `ui/tutor-reply-orchestration.test.ts`, integración |
| CP-02 | Silencio / no-habla | Audio bajo umbral | Gate corta antes de Whisper; mensaje honesto | `dsp/signal-energy.test.ts` |
| CP-03 | Etiqueta no-habla inventada por Whisper | `[Music]`, `[Applause]` | Se filtra; no se corrige ni puntúa | `ia/transcription-text.test.ts` |
| CP-04 | Frase larga | Utterance extensa | DTW alinea secuencias de distinto largo sin castigar ritmo | `dsp/dynamic-time-warping.test.ts` |
| CP-05 | Fin de frase (VAD) | Pausa ~0.9 s | Auto-stop de captura por VAD de energía | `dsp/voice-activity-detection.test.ts` |
| CP-06 | Tutor no responde a tiempo | SmolLM2 > 10 s o basura | Respaldo determinista por escenario con insignia honesta | `ui/tutor-reply-engine.test.ts`, `ui/await-with-timeout.test.ts` |
| CP-07 | Sin adapter WebGPU | Entorno solo WASM | ASR cae a WASM (más lento pero funcional) | `ia/resolve-inference-device.test.ts` |
| CP-08 | Comparación de pronunciación | User PCM vs TTS de la frase corregida | Score 0–100 con desglose MFCC/pitch | `dsp/pronunciation-score.test.ts` |
| CP-09 | Precisión ASR (WER) | Fixture de referencia | WER 0.000 con `small-en` | banco `#asr-benchmark` (2026-07-29) |
| CP-10 | Persistencia de turno | Turno con score/texto | Se guarda en IndexedDB sin audio crudo | `storage/practice-session-types.test.ts` |

**Edge cases del enunciado:** el ruido ambiental y el acento fuerte se abordan
hoy con el gate de energía/pico/duración y los diagnósticos de captura
(`audio/capture-diagnostics.ts`); el **filtrado adaptativo de ruido** queda como
extensión pendiente (issue #30). Las **frases largas** están cubiertas por la
alineación DTW (CP-04).

## 7. Conclusiones

- El **núcleo funcional exigido por el enunciado está implementado y
  verificado**: ASR client-side, corrección gramatical, análisis DSP de
  pronunciación (MFCC/YIN/DTW/formantes) con score 0–100, tutor conversacional
  con respaldo honesto, TTS, visualizaciones (waveform/espectrograma/pitch) y
  operación offline.
- La **calidad de ASR** con `whisper-small.en` es la mejor del catálogo
  (WER 0.000 en las fixtures de referencia), a costa de exigir WebGPU.
- La **suite automatizada (280 casos) y el CI en verde** dan una red de
  seguridad reproducible sobre el dominio de señales e inferencia.

## 8. Limitaciones

- **L-1 — Latencia ASR sobre el objetivo de 2 s.** `small-en` ronda ~3.4 s/frase
  en WebGPU y ~11 s en WASM; el criterio "< 2 s" no se cumple para la
  transcripción. Es una decisión consciente que prioriza precisión (WER) sobre
  latencia; `tiny-en`/`base-en` siguen disponibles para escenarios donde la
  latencia pese más.
- **L-2 — WER medido sobre fixtures propias.** Las fixtures del banco son
  grabaciones del equipo, no un corpus estándar; el WER 0.000 debe leerse como
  precisión sobre ese conjunto de referencia, no como métrica generalizable a
  cualquier hablante/acento.
- **L-3 — Calibración del score pendiente.** Los umbrales del score 0–100 aún no
  se calibran con hablantes reales (issue #29).
- **L-4 — Sin re-medición en hardware de demo.** Las latencias dependen de la
  GPU; conviene re-correr `#asr-benchmark` en la máquina de la presentación y
  actualizar la §4/§5.
- **L-5 — Half-duplex mejorable.** El bloqueo del micrófono durante el TTS puede
  endurecerse con abort de tracks (issue #26).
