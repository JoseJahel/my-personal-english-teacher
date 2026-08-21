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

> **Nota de reproducibilidad de este reporte.** Las cifras de la suite (§2)
> provienen de una **corrida local de `vitest run`** sobre el estado actual del
> árbol de trabajo, no de una corrida de CI concreta: desde la última corrida
> de CI que una revisión anterior de este reporte llegó a documentar (`main`,
> 2026-08-04) se han integrado más de quince Pull Requests adicionales, y no se
> dispone de un identificador de corrida de GitHub Actions posterior que se
> haya verificado para citarlo aquí. El pipeline `ci` (`pnpm lint` →
> `pnpm exec tsc --noEmit` → `pnpm test` → `pnpm build`) sigue siendo la puerta
> de integración en cada push y Pull Request (§1, punto 2); esta revisión
> documenta lo **medido directamente en local**, no una corrida de Actions
> concreta. Las cifras de WER y latencia por modelo corresponden al **banco de
> pruebas del 2026-07-29** sobre la máquina de referencia; no se re-ejecutaron
> para este documento porque el banco requiere navegador con micrófono y las
> fixtures de voz nunca se versionan en Git. Cualquier re-medición en el
> hardware de demo debe rehacerse con `#asr-benchmark` y actualizar la tabla de
> la §4.

## 2. Cobertura de pruebas automatizadas

La suite Vitest cuenta con **120 archivos de prueba** y **761 casos**
(`it`/`test`), distribuidos por capa:

| Capa | Archivos de prueba | Casos | Qué verifica |
|------|:------------------:|:-----:|--------------|
| `dsp/` | 27 | 153 | Energía/gate, YIN, MFCC, DTW, score, espectrograma, VAD, formantes, highlights |
| `ia/` | 20 | 177 | ASR, gramática, TTS (Supertonic), tutor, worker/cliente, registro de modelos, device policy, WER, sugerencias de comunicación |
| `audio/` | 16 | 119 | Resample, mono, normalización, trim de silencio, frame buffer |
| `storage/` | 7 | 48 | Schema IndexedDB, tipos de sesión, store de fixtures del banco, store de documentos de estudio |
| `ui/` | 41 | 186 | Orquestación de turno, estados de pantalla, chat, tutor, canvas, banco ASR, estudio, panel de sugerencias |
| `study/` | 7 | 40 | Parseo de lecciones markdown, banco de práctica, repetición espaciada (SM-2), marcapáginas, dirección de práctica |
| raíz | 2 | 38 | Ruteo (`app-routing`, 18 casos), freeze-guard de paleta (`theme-tokens`, 20 casos) |
| **Total** | **120** | **761** | — |

### 2.1 Casos por módulo crítico (extracto)

| Módulo | Archivo de prueba | Casos | Foco de verificación |
|--------|-------------------|:-----:|----------------------|
| DTW | `dsp/dynamic-time-warping.test.ts` | 14 | Alineación monótona, distancia L2 acumulada, secuencias de distinto largo |
| Signal energy / gate | `dsp/signal-energy.test.ts` | 19 | RMS/pico, umbral de duración, rechazo de silencio |
| MFCC | `dsp/mfcc-extraction.test.ts` | 10 | Banco mel, DCT-II, dimensiones (13 coef), pre-énfasis |
| MFCC dorados | `dsp/mfcc-golden-vectors.test.ts` | 1 | Fixture JSON; c0–c12 vs recetas sintéticas; cota 1e-5 |
| YIN | `dsp/pitch-detection-yin.test.ts` | 10 | F0 en banda 70–400 Hz, frames no sonoros, contorno |
| FFT / STFT | `dsp/radix2-forward-fft.test.ts`, `dsp/spectrogram.test.ts` | 4+ | Error vs DFT O(N²) &lt; 1e-10 (Float64); Parseval; pico en bin; STFT vs DFT |
| Device policy | `ia/resolve-inference-device.test.ts` | 15 | WebGPU→WASM fallback, política por modelo |
| Gramática | `ia/grammar-correction.test.ts` | 13 | Corrección post-utterance, casos límite de texto |
| Tutor (reglas) | `ui/tutor-reply-engine.test.ts` | 18 | Respaldo determinista por escenario, insignia honesta |
| Sugerencias | `ia/conversation-suggestions.test.ts` | 12 | Generación, memoria de turnos, saneo |
| WER | `ia/word-error-rate.test.ts` | 7 | Levenshtein por palabra, S/D/I, normalización |
| Transcripción | `ia/transcription-text.test.ts` | 9 | Filtro de etiquetas no-habla (p. ej. `[Music]`) |

**Resultado:** las 761 pruebas pasan en una corrida local (`vitest run`) sobre
el árbol de trabajo actual (ver nota de reproducibilidad, §1). No hay pruebas
marcadas como `skip` ni `todo` en la suite. El pipeline de CI (`lint` →
`typecheck` → `test` → `build`) sigue siendo la puerta de integración en cada
push y Pull Request.

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
| ASR perfil **precisión** (`small-en`, default) | WebGPU | ~3.4 s/frase (bench 2026-07-29) | No (L-1) |
| ASR perfil **precisión** (`small-en`) | WASM | ~11 s/frase | No |
| ASR perfil **latencia** (`tiny-en`, `pnpm dev:latency`) | WebGPU / WASM | **No medido** en este hardware (issue #96: no se inventa la cifra; re-medir en `#asr-benchmark`) | No afirmado |
| Gate de energía + espectrograma + pitch | CPU (dominio puro) | < 100 ms | Sí |
| Gramática (T5) | WASM | dependiente de frase | Parcial |
| Score de pronunciación (MFCC+DTW) | CPU | < 200 ms | Sí |
| Tutor híbrido (SmolLM2) | WASM | timeout de 10 s + respaldo de reglas | Acotado por diseño |

**Definición del presupuesto de 2 s (issue #96 / RNF-06).** El enunciado se
aplica al **feedback inmediato** (transcripción Whisper + corrección T5
visible en el chat), no al turno entero con SmolLM2 y Supertonic (motor de
TTS). El chat
publica la burbuja del estudiante en cuanto cierra ASR+T5; el tutor puede
tardar hasta 10 s (o caer al respaldo) **después**. `small-en` sigue sin
cumplir 2 s en el tramo ASR (~3.4 s WebGPU). `tiny-en` **no tiene cifra
nueva**: la fila de arriba queda en “no medido” hasta una corrida de
`#asr-benchmark` en el hardware de aula.

El DSP local (visualizaciones, gate, score) es holgadamente sub-2 s. El costo
está en la inferencia de los modelos. El perfil latencia (`VITE_ASR_PROFILE=latency`
→ `tiny-en`) es el camino soportado para acercarse al objetivo de 2 s **sin**
cambiar el default de entrega; sus milisegundos se rellenan con `#asr-benchmark`
en la máquina de la demo (issue #61). No se inventan cifras para `tiny-en`.

## 5.1 Corrección de FFT/STFT frente a la DFT (issue #66)

La FFT radix-2 de `dsp/radix2-forward-fft.ts` (compartida por espectrograma y
MFCC) se verifica contra la **definición O(N²)** de la DFT
(`dsp/dft-reference.ts`, solo tests; no entra al pipeline de producto):

$$ X[k] = \sum_{n=0}^{N-1} x[n]\, e^{-j\,2\pi kn/N} $$

| Caso | N | Precisión | Métrica | Cota |
|------|:-:|-----------|---------|-------|
| Impulso $x[0]=1$ | 16 | Float64 | $\max_k \|X_{\mathrm{FFT}}-X_{\mathrm{DFT}}\|$ | **&lt; 1e-10** |
| Coseno de bin exacto | 32 | Float64 | misma | **&lt; 1e-10** |
| Parseval $\sum\|x\|^2 = N^{-1}\sum\|X\|^2$ | 32 | Float64 | residual absoluto | **&lt; 1e-10** |
| Primer frame STFT (Hann) vs DFT del frame ventaneado | 400→512 | Float32 vs DFT Float64 | pico en bin analítico; \|Δ\| log-mag en ese bin | **bin exacto; &lt; 1e-5** |

La cota Float64 está exportada como `RADIX2_FFT_MAX_ABSOLUTE_ERROR_VS_DFT`.
Un tono de 1 kHz a 16 kHz concentra el pico del espectrograma a menos de 1.5
bins del bin analítico. No hay dependencia nativa: la FFT es dominio puro.

## 5.2 Vectores dorados MFCC (issue #67)

`extractMfccSequence` queda anclado a un fixture versionado
(`app/src/dsp/mfcc-golden-vectors.json`) generado con señales sintéticas
reproducibles (tono 440 Hz, tono 1000 Hz, dos tonos 220+660 Hz, ruido LCG).
No hay Python/librosa/Meyda en runtime ni en CI: el JSON vive en el repo.

| Política | Valor |
|----------|--------|
| Coeficientes | 13 por frame (c0 … c12) |
| c0 | Se compara: la amplitud está fijada en las recetas; un cambio de energía/pre-énfasis debe fallar |
| c1–c12 | Misma cota absoluta (envolvente / DCT) |
| Cota | `MFCC_GOLDEN_MAX_ABSOLUTE_ERROR` = **1e-5** |
| Error observado al generar el fixture | **&lt; 1e-5** (redondeo a 9 cifras significativas; bit-idéntico en Float32 dentro de esa cota) |

Regenerar el JSON solo si el equipo **decide** cambiar el extractor a propósito:
`pnpm exec jiti src/dsp/write-mfcc-golden-vectors.ts` desde `app/`.

## 5.3 Encadenado MFCC (issue #94)

Los vectores dorados (#67) no cazan un fallo de *acoplamiento*: aplicar al
espectro de potencia la escala de **visualización** (`log10` y/o `1/N²` de
`dsp/spectrogram.ts`) y seguir usando ese vector como entrada del banco
mel. Cada etapa puede seguir “pasando” y las bandas caen al piso
`log(1e-10)`.

| Convención | Valor en este repo |
|------------|--------------------|
| Escala mel | HTK: \(2595\log_{10}(1+f/700)\) (`hertzToMel`) |
| Banco | 40 triángulos, 0 Hz → Nyquist (8 kHz a 16 kHz), **sin** normalizar Slaney |
| Espectro | \(\|X[k]\|^2\) sin \(1/N^2\) ni `log10` |
| Log-mel | \(\ln\max(E_j,\,10^{-10})\) |
| DCT | tipo II sin normalizar; **c0 se conserva** |

Invariante (`dsp/mfcc-chain-audit.test.ts`): tono 1 kHz, amplitud 1, 16 kHz
→ la banda mel de pico no está en el piso; c1–c12 no colapsan a ~0. Si se
inyecta el espectro de UI como si fuera potencia, el número de bandas en el
piso **sube** (≥ 10). Fixture de convención: `dsp/mfcc-chain-invariants.json`
(TS del repo; sin Python en CI). #67 permanece verde.

## 5.4 STFT/YIN en vivo sobre PCM (issues #93 / #59)

Durante la escucha, un AudioWorklet **solo copia** PCM (`audio/pcm-tap-processor.js`)
desde una **pista clonada** (`clone-media-stream-for-analysis.ts`). El análisis
llama a `computeLogMagnitudeSpectrogram` y `estimatePitchWithYin` (las mismas
funciones que post-utterance). No se usa
`AnalyserNode.getFloatFrequencyData` como STFT de curso. El worklet **no** se
conecta al `MediaStreamSource` del Analyser (Realtek lo deja en 0 %).

| Parámetro | Valor |
|-----------|--------|
| Ventana / hop | 25 ms / 10 ms (igual que el espectrograma de utterance) |
| Acumulador | Emite solo ventanas **completas**; no rellena con ceros |
| Presupuesto por trama | &lt; 50 ms en el test de tono 1 kHz (`analyze-live-pcm-frame.test.ts`) |
| ASR | Sigue siendo MediaRecorder sobre el `MediaStream` crudo |

## 5.5 Remuestreo FIR multi-tasa (issue #92 / #65)

El path a 16 kHz de Whisper/MFCC/score **ya no es solo interpolación lineal**.
Diseño: sinc ventaneado con Hann, fase lineal, corte **7.2 kHz** (Nyquist
destino 8 kHz), $N=93$ a la tasa de entrada. Polifase para no convolucionar el
prototipo largo en cada muestra de entrada.

| Ruta | Método | Tono 12 kHz → residual (dB) | Retardo de grupo | Coste |
|------|--------|----------------------------:|------------------|-------|
| 48 kHz → 16 kHz lineal (Avance 1) | interpolación | **0.0** (alias a 4 kHz a plena escala) | 0 | 1 mezcla/salida |
| 48 kHz → 16 kHz FIR | decimación ×3, 3 fases | **85.1** | 46 muestras @ 48 kHz (**0.96 ms**) | 31 MAC/entrada (93/salida) |
| 44.1 kHz → 16 kHz lineal | interpolación | **2.1** | 0 | 1 mezcla/salida |
| 44.1 kHz → 16 kHz FIR | racional **160/441** | **86.6** | 46.5 muestras @ 44.1 kHz (**1.05 ms**) | 93 MAC/salida (no 14 880) |

Cifras de dB: RMS en régimen permanente vs seno de amplitud 1 (`1/√2`),
`dsp/polyphase-resample.test.ts` y `audio/audio-resampler.test.ts`. El umbral
exportado que aserta el test es **`FIR_MIN_ALIAS_ATTENUATION_DB = 50`**.
Otras tasas (p. ej. 32 kHz) siguen el lineal y **no lanzan**. No se fuerza
`sampleRate` en captura.

## 5.6 Sesgo de locutor vs error (issue #95)

Protocolo sintético (fuente armónica + 3 formantes) sobre
`scorePronunciationFromMonoPcm`. Hablantes A/B del protocolo #29 (120 / 210 Hz).

| Condición | Score | Δ | d MFCC extra |
|-----------|------:|--:|-------------:|
| Identidad | 100.0 | 0 | 0 |
| Locutor 120→210 Hz, mismas vocales | 88.7 | **11.3** | 3.24 |
| Error de vocal, mismo F0 | 90.1 | **9.9** | 3.00 |

Ratio Δlocutor/Δerror = **1.14** ≥ 1 → política **`drill-only`**. Conversación
no muestra 0–100 (`deferred-to-drill`). #75 (sin habla útil / `[Music]`) sigue
cortando antes. Tests: `dsp/measure-speaker-bias.test.ts`.

## 5.7 Pasa-banda de voz y cadena compartida (issue #73)

Tras el FIR a 16 kHz, user y referencia TTS pasan por **la misma** función
`prepareSpeechPcmForModels`: resample + un pasa-banda Butterworth 2.º orden
(cascada HP + LP, biquads RBJ, Q = 1/√2). Una sola pasada **causal** (no
`filtfilt` / fase cero): aplicar dos veces no es idempotente; es un 4.º orden.

| Tono de prueba (16 kHz, 1 s, RMS en régimen) | Ganancia |
|----------------------------------------------|---------:|
| 20 Hz (rumble) | **−24.10 dB** |
| 80 Hz (corte HP) | **−3.01 dB** |
| 1 kHz (in-banda) | **0.00 dB** |
| 7.5 kHz (corte LP) | **−3.01 dB** |

Whisper consume esa misma cadena (`use-home-transcription-pipeline.ts`). El
banco `#asr-benchmark` **no** cambia: sigue midiendo candidatos sobre el
resample solo, para no mover el WER de 2026-07-29. El filtrado adaptativo
de ruido sigue en #63.

Tests: `dsp/biquad-voice-bandpass.test.ts`, `audio/prepare-speech-pcm.test.ts`,
`ui/run-pronunciation-scoring.test.ts`.

## 5.8 Energía y formantes en el score (issue #58)

El 0–100 combina cuatro ramas con pesos que suman 1 (MFCC dominante). Si una
rama no es usable, su peso se redistribuye:

| Rama | Default | Señal |
|------|--------:|-------|
| MFCC + DTW | 0.68 | igual que #29 |
| Pitch relativo YIN | 0.18 | igual que #29 |
| Contorno log-RMS (z-score + DTW) | 0.07 | misma grilla 25/10 ms que MFCC |
| Mediana F1–F2–F3 (distancia log-Hz) | 0.07 | exige F1 y F2 en user y ref |

Los pesos de energía/formantes son **provisionales** (no hay re-fit del panel
#29). El desglose se muestra en español en el panel de feedback. Tras meter
las ramas se re-midió #95: Δlocutor **11.3** ≳ Δerror **9.9** (ratio **1.14**);
la política drill-only no cambia.

Tests: `dsp/score-energy-contour.test.ts`, `dsp/score-formant-distance.test.ts`,
`dsp/combine-pronunciation-branch-scores.test.ts`, `dsp/pronunciation-score.test.ts`,
`ui/build-home-screen-view-model.test.ts`.

## 5.9 Bordes del VAD en ms (issue #74)

El auto-stop sigue siendo el VAD de energía de la sesión (`hangover` **1100 ms**,
`minimumSpeech` **380 ms**). #74 no cambia esos umbrales: añade un protocolo
sintético silencio–tono–silencio (hop **16 ms**, como un frame de animación)
que empuja RMS/pico al mismo detector.

Fixture alineada a hops: 320 ms silencio + 800 ms tono 200 Hz + 1920 ms silencio.

| Métrica | Valor | Criterio |
|---------|------:|----------|
| Error de inicio (detectado − etiqueta) | **0 ms** | \|e\| ≤ 20 ms |
| Error de fin de habla (primer `trailing-silence`) | **0 ms** | \|e\| ≤ 20 ms |
| Auto-stop − (fin + hangover) | **+4 ms** | \|e\| ≤ 20 ms |
| Silencio post-frase no enviado a ASR | **816 ms** (42.5 % de 1920 ms) | hangover se captura; el resto se corta |

El +4 ms es cuantización: 1100 no es múltiplo de 16; el primer hop con
`silenceMs ≥ 1100` cae en 2224 ms. No se acortó el hangover (cortaría frases
con pausas reales). Tests: `dsp/measure-vad-edge-metrics.test.ts` + los de
comportamiento previos.

## 5.10 Tasa de trabajo del score fijada a 16 kHz

El score de pronunciación (`ui/run-pronunciation-scoring.ts`) compara la voz
del alumno contra la referencia sintetizada por TTS. La tasa de trabajo del
score se fijó a `WHISPER_SAMPLE_RATE_IN_HERTZ` (**16 000 Hz**, constante de
`audio/audio-resampler.ts`) para ambas señales, en vez de heredarla de
`synthesized.sampleRateInHertz` (la tasa que emite el sintetizador). Con
Supertonic como motor de voz (§5, §7) esa tasa nativa es **44 100 Hz**, muy
distinta de los 16 kHz sobre los que se calibró el score (issue #29,
[documento de calibración](./calibracion-score-pronunciacion.md)); dejar que
`targetRate` siguiera al sintetizador habría movido la comparación fuera de
ese régimen. Usuario y referencia se remuestrean a 16 kHz con la misma rama
FIR de fase lineal del §5.5 (para 44.1→16 kHz: factor racional 160/441,
atenuación de alias medida 86.6 dB) y comparten después el mismo pasa-banda
del §5.7 (`prepareSpeechPcmForModels`, issue #73).

**Por qué importa.** A 44 100 Hz el banco de 40 filtros mel (§5.3) se reparte
de 0 Hz a 22 050 Hz (Nyquist), mientras que el pasa-banda corta a 7.5 kHz
(§5.7): alrededor de una docena de filtros mel quedan por encima de ese
corte, pegados al piso logarítmico (`ln(1e-10)`, §5.3). Como la DCT-II mezcla
todas las bandas al construir los 13 coeficientes MFCC, ese desplazamiento
saca las constantes de calibración del régimen en el que se ajustaron.

**Constantes que siguen vigentes gracias a esta fijación** (issue #29,
[documento de calibración](./calibracion-score-pronunciacion.md)): distancia
MFCC a media escala **16.5**, distancia de pitch relativo a media escala
**11.2**, pesos del score combinado MFCC **0.68** / pitch **0.18** / energía
**0.07** / formantes **0.07** (§5.8). El sesgo de locutor del §5.6 (ratio
Δlocutor/Δerror = 1.14) tampoco cambia: se midió ya sobre esta cadena de 16
kHz compartida.

## 6. Casos de prueba y edge cases

| # | Caso | Entrada | Resultado esperado | Cobertura |
|---|------|---------|--------------------|-----------|
| CP-01 | Habla válida en escenario | Utterance con voz | ASR→gramática→tutor→score→TTS completo | `ui/tutor-reply-orchestration.test.ts`, integración |
| CP-02 | Silencio / no-habla | Audio bajo umbral | Gate corta antes de Whisper; mensaje honesto | `dsp/signal-energy.test.ts` |
| CP-03 | Etiqueta no-habla inventada por Whisper | `[Music]`, `[Applause]` | Se filtra; no se corrige ni puntúa | `ia/transcription-text.test.ts` |
| CP-04 | Frase larga | Utterance extensa | DTW alinea secuencias de distinto largo sin castigar ritmo | `dsp/dynamic-time-warping.test.ts` |
| CP-05 | Fin de frase (VAD) | Pausa ~1.1 s | Auto-stop de captura por VAD de energía | `dsp/voice-activity-detection.test.ts` |
| CP-06 | Tutor no responde a tiempo | SmolLM2 > 10 s o basura | Respaldo determinista por escenario con insignia honesta | `ui/tutor-reply-engine.test.ts`, `ui/await-with-timeout.test.ts` |
| CP-07 | Sin adapter WebGPU | Entorno solo WASM | ASR cae a WASM (más lento pero funcional) | `ia/resolve-inference-device.test.ts` |
| CP-08 | Comparación de pronunciación | User PCM vs TTS de la frase corregida | Score 0–100 con desglose MFCC/pitch | `dsp/pronunciation-score.test.ts` |
| CP-09 | Precisión ASR (WER) | Fixture de referencia | WER 0.000 con `small-en` | banco `#asr-benchmark` (2026-07-29) |
| CP-10 | Persistencia de turno | Turno con score/texto | Se guarda en IndexedDB sin audio crudo | `storage/practice-session-types.test.ts` |
| CP-11 | Calibración score multi-hablante | Panel 8 frases × 2 hablantes × 4 tiers | Fit `distanceAtHalfScore` MFCC≈16.5, pitch≈11.2 | `dsp/run-pronunciation-score-calibration.test.ts` · [doc](./calibracion-score-pronunciacion.md) |
| CP-12 | Barge-in digresión (Case A) | Interrupción + “what does X mean?” | Puente determinista, no avanza escena | `ui/interruption-resume-bridges.test.ts` |
| CP-13 | Barge-in respuesta al fragmento (Case B) | Interrupción + “coffee please” | Avanza escena; no repite lista completa | `ui/interruption-turn-classifier.test.ts` |
| CP-14 | Barge-in corte temprano (Case C) | `cutoffMs` &lt; 250 ms | Reformula frase completa | `ui/spoken-progress.test.ts` |
| CP-15 | Persistencia spoken_progress (Case D) | Pending en sesión + reload | IndexedDB conserva cutoff | `storage/session-repository.test.ts` |
| CP-16 | FFT vs DFT (issue #66) | Impulso / coseno / Parseval / frame STFT | Error acotado &lt; 1e-10 (Float64) y &lt; 1e-5 (log-mag STFT) | `dsp/radix2-forward-fft.test.ts`, `dsp/spectrogram.test.ts` |
| CP-17 | MFCC vectores dorados (issue #67) | Tonos 440/1000, dos tonos, ruido LCG | c0–c12 dentro de 1e-5 del JSON versionado | `dsp/mfcc-golden-vectors.test.ts` |
| CP-18 | Encadenado MFCC (issue #94) | Tono 1 kHz, amplitud 1, 16 kHz | Banda de pico fuera del piso log; c1–c12 no ~0; escala UI (`log10`/`1/N²`) incrementa bandas en el piso | `dsp/mfcc-chain-audit.test.ts` |
| CP-19 | STFT/YIN live PCM (issue #93) | Acumulador + tono 1 kHz / 220 Hz / silencio | Hop sin zero-pad; pico en bin; F0 ~220 Hz; silencio unvoiced; análisis &lt; 50 ms | `dsp/pcm-frame-accumulator.test.ts`, `dsp/analyze-live-pcm-frame.test.ts` |
| CP-20 | FIR anti-alias 44.1 y 48 (issue #92) | Seno 12 kHz; impulso; DC; 32 kHz | ≥ 50 dB vs lineal ~0 dB; retardo de pico = (N−1)/2; 44.1 no es ×3; tasas raras no lanzan | `dsp/polyphase-resample.test.ts`, `audio/audio-resampler.test.ts` |
| CP-21 | Sesgo locutor vs error (issue #95) | Vocales sintéticas 120 vs 210 Hz; mismo F0 otras vocales | Δlocutor 11.3 ≳ Δerror 9.9; ratio 1.14; conversación sin 0–100; drill sí; #75 intacto | `dsp/measure-speaker-bias.test.ts`, `ui/pronunciation-score-eligibility.test.ts` |
| CP-23 | Energía y formantes en el score (issue #58) | AM vs AM; vocales sintéticas /a/ vs /i/; desglose UI | Ramas numéricas en el resultado; UI en español; pesos se redistribuyen si falta una rama | `dsp/score-energy-contour.test.ts`, `dsp/score-formant-distance.test.ts`, `ui/build-home-screen-view-model.test.ts` |
| CP-24 | Bordes VAD en ms (issue #74) | Silencio 320 + tono 800 + silencio 1920, hop 16 ms | Start/end 0 ms; auto-stop +4 ms vs hangover 1100; 42.5 % del silencio final no va a ASR | `dsp/measure-vad-edge-metrics.test.ts` |
| CP-22 | Pasa-banda + misma cadena (issue #73) | Senos 20 / 80 / 1000 / 7500 Hz; user 48 kHz vs ref 16 kHz | −3.01 dB en cortes; −24.1 dB a 20 Hz; score user/ref usa `prepareSpeechPcmForModels` | `dsp/biquad-voice-bandpass.test.ts`, `audio/prepare-speech-pcm.test.ts`, `ui/run-pronunciation-scoring.test.ts` |

**Edge cases del enunciado:** el ruido ambiental y el acento fuerte se abordan
con el gate de energía/pico/duración, el preproceso endurecido (issue #30) y los
diagnósticos de captura. El **filtrado adaptativo de ruido** sigue como
extensión de innovación (RF-23). Las **frases largas** están cubiertas por DTW
(CP-04). La **interrupción mid-utterance del tutor** está cubierta por
`spoken_progress` (CP-12–15, issue #46).

## 7. Conclusiones

- El **núcleo funcional exigido por el enunciado está implementado y
  verificado**: ASR client-side, corrección gramatical, análisis DSP de
  pronunciación (MFCC/YIN/DTW/formantes) con score 0–100, tutor conversacional
  con respaldo honesto, TTS, visualizaciones (waveform/espectrograma/pitch) y
  operación offline.
- La **calidad de ASR** con `whisper-small.en` es la mejor del catálogo
  (WER 0.000 en las fixtures de referencia), a costa de exigir WebGPU.
- La **suite automatizada (120 archivos, 761 casos), en verde en una corrida
  local sobre el árbol de trabajo actual** (§1, §2), da una red de seguridad
  reproducible sobre el dominio de señales e inferencia.

## 8. Limitaciones

- **L-1 — Latencia ASR sobre el objetivo de 2 s.** El perfil **precisión**
  (`small-en`, default) ronda ~3.4 s/frase en WebGPU y ~11 s en WASM; el
  criterio "&lt; 2 s" no se cumple para esa transcripción. Existe un perfil
  **latencia** first-class (`pnpm dev:latency` / `VITE_ASR_PROFILE=latency` →
  `tiny-en`) para la defensa oral; su latencia numérica queda **pendiente de
  re-medir** en el hardware de aula con `#asr-benchmark` (no se afirma &lt; 2 s
  sin esa cifra). `VITE_ASR_MODEL` sigue pudiendo forzar `base-en` u otro
  candidato.
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
- **L-6 — Voz de Supertonic sin validar en el navegador de este proyecto.**
  Nadie del equipo ha validado perceptualmente la voz sintetizada por
  Supertonic (revisión anclada `cff123c84b0655d9d647641f1b532c3cbb8f7faa`)
  dentro del navegador de esta app, y no existe medición de su latencia de
  síntesis sobre WASM en ese entorno. Las únicas cifras de latencia publicadas
  por el autor del modelo corresponden a ejecución nativa CPU/GPU, no a WASM
  en navegador; este reporte no las presenta como si lo fueran.
- **L-7 — Modelo de voz sin mantenimiento activo por parte de su autor.** El 23
  de julio de 2026 Supertone anunció el archivado de su proyecto open source
  Supertonic; su Voice Builder deja de estar accesible después del 31 de
  agosto de 2026. Los pesos que usa este proyecto siguen alojados en el
  espejo `onnx-community/Supertonic-TTS-ONNX` de Hugging Face (hosting de
  Hugging Face, no de Supertone), así que la descarga del modelo no depende de
  esa empresa; pero no habrá más correcciones del autor original ni la
  cuantización (q8/fp16) que había prometido — el proyecto sigue en fp32 puro
  (solo dtype publicado, ~250.7 MB de pesos).
