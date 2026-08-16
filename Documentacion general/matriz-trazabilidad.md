# Matriz de trazabilidad de requerimientos

> **Proyecto:** My Personal English Teacher — PWA offline de práctica de inglés
> (curso Señales y Sistemas).
> **Alcance de estados:** honestos respecto a la rama `main` tras la
> integración del Avance 2 (`feat: integrate Avance 2 practice stack into
> main (#38)` y posteriores). Última verificación de CI: verde
> (lint + typecheck + tests + build).
> **Documento relacionado:** [Documento técnico](./documento-tecnico.md) ·
> [Reporte de verificación](./reporte-verificacion.md).

Esta matriz vincula cada requerimiento del enunciado del curso y de las
decisiones de producto del equipo con el módulo que lo implementa, su estado
real en el código, las pruebas que lo verifican y la métrica asociada. Es la
sección 6 exigida por la estructura obligatoria del documento técnico.

## Leyenda

- **Prioridad:** `Alta` (core del enunciado / bloqueante de demo) · `Media`
  (funcionalidad esperada, no bloqueante) · `Baja` (innovación / extensión).
- **Fuente:** `Curso` (enunciado del proyecto) · `Equipo` (decisión de
  producto/arquitectura) · `Usuario` (necesidad del hispanohablante que
  aprende inglés).
- **Estado:**
  - `Implementado` — presente y cableado de punta a punta en `main`.
  - `Parcial` — funciona un núcleo, pero falta calibración, endurecimiento o
    parte del alcance del enunciado.
  - `Pendiente` — decidido/diseñado, aún no en código.
  - `Descartado` — excluido explícitamente por una decisión documentada.
- **Módulo:** capa de `app/src/` (`ui/`, `ia/`, `dsp/`, `audio/`, `storage/`)
  y archivo(s) principal(es).

## Requerimientos funcionales (core del enunciado)

| ID | Descripción | Prioridad | Fuente | Módulo / Funcionalidad | Estado | Pruebas de verificación | Métrica |
|----|-------------|-----------|--------|------------------------|--------|-------------------------|---------|
| RF-01 | Interfaz tipo chat con botón de micrófono y feedback visual | Alta | Curso | `ui/HomeScreen.tsx`, `ui/PracticeChatPanel.tsx`, `ui/ScenarioPicker.tsx` | Implementado | `ui/practice-chat-messages.test.ts`, `ui/home-screen-status.test.ts` | Flujo escenario→chat operativo |
| RF-02 | Visualización de waveform / nivel en tiempo real | Alta | Curso | `ui/waveform-canvas.ts`, `ui/utterance-signal-canvas.ts` (Analyser) | Implementado | `ui/waveform-canvas.test.ts`, `ui/utterance-signal-canvas.test.ts` | Render en vivo del Analyser |
| RF-03 | Visualización de espectrograma (STFT log-magnitud) | Alta | Curso | `dsp/spectrogram.ts` + canvas UI; FFT radix-2 verificada vs DFT (`radix2-forward-fft.ts`, issue #66) | Implementado | `dsp/spectrogram.test.ts`, `dsp/radix2-forward-fft.test.ts` | STFT por utterance; error FFT vs DFT &lt; 1e-10 (Float64) |
| RF-04 | Pitch tracking (contorno F0 por frame) | Alta | Curso | `dsp/pitch-detection-yin.ts` + canvas pitch | Implementado | `dsp/pitch-detection-yin.test.ts` | F0 70–400 Hz, media voiced |
| RF-05 | Feedback visual con colores en palabras | Media | Curso | `dsp/word-pronunciation-highlights.ts`, `ui/PronunciationWordHighlights.tsx` | Implementado | `dsp/word-pronunciation-highlights.test.ts` | Clases good/medium/poor |
| RF-06 | Captura de micrófono (Web Audio API + MediaStream) | Alta | Curso | `audio/open-microphone-stream.ts`, `audio/microphone-capture.ts`, `audio/media-recorder-utterance.ts` | Implementado | `audio/*` + `CAPTURE-INVARIANTS.md` | `getUserMedia` + MediaRecorder |
| RF-07 | ASR client-side (Whisper) → transcripción | Alta | Curso | `ia/automatic-speech-recognition.ts`, `ia/inference-worker.ts`, `ia/model-registry.ts` | Implementado | `ia/automatic-speech-recognition.test.ts`, `ia/transcription-text.test.ts`, `ia/model-registry.test.ts` | WER (ver reporte); default `whisper-small.en` |
| RF-08 | Corrección gramatical post-utterance (T5) | Alta | Curso | `ia/grammar-correction.ts` | Implementado | `ia/grammar-correction.test.ts` | Corrige texto de la utterance |
| RF-09 | Análisis acústico comparativo vs referencia (pitch/energía/MFCC/formantes) | Alta | Curso | `dsp/pronunciation-score.ts`, `dsp/mfcc-extraction.ts`, `dsp/dynamic-time-warping.ts` | Implementado | `dsp/pronunciation-score.test.ts`, `dsp/mfcc-extraction.test.ts`, `dsp/dynamic-time-warping.test.ts` | Distancia MFCC+pitch sobre DTW |
| RF-10 | Puntaje de pronunciación 0–100 | Alta | Curso | `dsp/pronunciation-score.ts`, `ui/run-pronunciation-scoring.ts`, calibración (#29), sesgo locutor (`measure-speaker-bias.ts`, issue #95) | Implementado | `dsp/pronunciation-score.test.ts`, `dsp/measure-speaker-bias.test.ts`, `ui/pronunciation-score-eligibility.test.ts` | 0–100 en **Repetir**; conversación no califica (Δlocutor 11.4 ≳ Δerror 9.2, ratio 1.23) |
| RF-11 | Highlights en palabras problemáticas | Media | Curso | `dsp/word-pronunciation-highlights.ts` (path DTW) | Implementado | `dsp/word-pronunciation-highlights.test.ts` | Aproximación temporal por letras |
| RF-12 | Respuesta conversacional generada del tutor | Alta | Curso | `ia/conversation-suggestions.ts`, `ui/tutor-reply-orchestration.ts`, `ui/tutor-reply-engine.ts` | Implementado | `ui/tutor-reply-orchestration.test.ts`, `ui/tutor-reply-engine.test.ts`, `ia/conversation-suggestions.test.ts` | SmolLM2 + respaldo reglas, timeout 10 s |
| RF-13 | Respuesta hablada del tutor (TTS SpeechT5) | Alta | Curso | `ia/text-to-speech-synthesis.ts`, `audio/play-pcm-mono.ts` | Implementado | `ia/text-to-speech-synthesis.test.ts` | Síntesis + reproducción |
| RF-14 | Sugerencias de comunicación (vocabulario / fluidez / naturalidad) como salida diferenciada | Media | Curso | `ia/conversation-suggestions.ts` (dentro del turno del tutor) | Parcial | `ia/conversation-suggestions.test.ts` | Van embebidas en la respuesta; sin panel propio de sugerencias |

## Requerimientos de procesamiento de señales (DSP)

| ID | Descripción | Prioridad | Fuente | Módulo / Funcionalidad | Estado | Pruebas de verificación | Métrica |
|----|-------------|-----------|--------|------------------------|--------|-------------------------|---------|
| RF-15 | Extracción de MFCC de implementación propia | Alta | Curso | `dsp/mfcc-extraction.ts` (FFT + banco mel + DCT-II); ancla JSON issue #67 | Implementado | `dsp/mfcc-extraction.test.ts`, `dsp/mfcc-golden-vectors.test.ts` | Hann 25 ms, hop 10 ms, 13 MFCC, 40 mel; error vs dorados &lt; 1e-5 |
| RF-16 | Detección de pitch con YIN | Alta | Curso | `dsp/pitch-detection-yin.ts` | Implementado | `dsp/pitch-detection-yin.test.ts` | Diferencia normalizada acumulada |
| RF-17 | Estimación de formantes F1/F2/F3 | Media | Curso | `dsp/formant-estimation.ts` (LPC + picos) | Implementado | `dsp/formant-estimation.test.ts` | Mediana por utterance |
| RF-18 | Alineación temporal DTW + distancia euclidiana | Alta | Curso | `dsp/dynamic-time-warping.ts` | Implementado | `dsp/dynamic-time-warping.test.ts` | Path DTW + distancia L2 |
| RF-19 | Gate de energía/pico/duración (no enviar silencio a Whisper) | Alta | Equipo | `dsp/signal-energy.ts` | Implementado | `dsp/signal-energy.test.ts` | RMS/pico + umbral de duración |
| RF-20 | VAD para auto-stop de captura al silencio de fin de frase | Media | Equipo | `dsp/voice-activity-detection.ts` | Implementado | `dsp/voice-activity-detection.test.ts` | Hangover ~0.9 s |
| RF-21 | Preprocesamiento robusto: normalización, trim, resample a 16 kHz | Alta | Curso | `audio/normalize-peak.ts`, `audio/trim-speech-silence.ts`, `audio/audio-resampler.ts`, `audio/mix-to-mono.ts`, `dsp/polyphase-resample.ts`, `dsp/design-linear-phase-lowpass-fir.ts` | Implementado | `audio/audio-resampler.test.ts`, `dsp/polyphase-resample.test.ts`, `dsp/design-linear-phase-lowpass-fir.test.ts` | FIR 44.1/48 → 16 kHz; lineal solo como fallback; ≥ 50 dB de alias (issue #92) |
| RF-22 | Robustez a ruido / edge cases (acento fuerte, ruido, frases largas) | Media | Curso | `audio/capture-diagnostics.ts`, preproceso `audio/*` + issues #30/#31 | Implementado | `audio/*test.ts` | Preproceso endurecido; filtrado adaptativo sigue como extensión (RF-23) |
| RF-23 | Filtrado adaptativo de ruido | Baja | Curso | — (planificado) | Pendiente | — | Extensión de innovación |

## Requerimientos no funcionales y de plataforma

| ID | Descripción | Prioridad | Fuente | Módulo / Funcionalidad | Estado | Pruebas de verificación | Métrica |
|----|-------------|-----------|--------|------------------------|--------|-------------------------|---------|
| RNF-01 | IA 100% client-side (edge AI, sin backend) | Alta | Curso | `ia/inference-worker.ts` (Web Worker, transformers.js/ONNX) | Implementado | `ia/inference-worker.test.ts`, `ia/inference-client.test.ts` | Inferencia en el navegador |
| RNF-02 | PWA instalable y funcional offline tras cargar modelos | Alta | Curso | `vite-plugin-pwa` (app shell) + Cache API | Implementado | Build de CI genera SW; verificación manual offline | App shell precacheado |
| RNF-03 | Caché de modelos (Cache API) + datos consultables (IndexedDB) | Alta | Equipo | Cache API (transformers.js) + `storage/database-schema.ts` | Implementado | `storage/database-schema.test.ts` | Caché híbrida |
| RNF-04 | Persistencia de sesiones y turnos (sin audio crudo) | Media | Equipo | `storage/session-repository.ts`, `storage/practice-session-types.ts` | Implementado | `storage/practice-session-types.test.ts`, `ui/use-practice-history-bootstrap.ts` | Schema v1 IndexedDB |
| RNF-05 | Modelos HF compatibles con browser (ONNX/quantized), anclados a SHA | Alta | Curso | `ia/model-registry.ts`, `ia/onnx-dtype.ts`, `ia/resolve-inference-device.ts` | Implementado | `ia/model-registry.test.ts`, `ia/resolve-inference-device.test.ts` | Revisiones ancladas a commit SHA |
| RNF-06 | Latencia de respuesta < 2 s donde aplique | Media | Curso | Presupuesto de 2 s = **feedback ASR+T5** (issue #96), no el turno tutor/TTS. DSP local &lt; 2 s; ASR precisión `small-en` ~3.4 s; perfil latencia `tiny-en` vía `pnpm dev:latency` (issue #61) | Parcial | Bench 2026-07-29; `ia/model-registry.test.ts`; `ui/progressive-tutor-turn.test.ts` | Precisión no cumple 2 s en ASR; el chat ya no espera al tutor; cifra `tiny-en` **no medida** |
| RNF-07 | Navegador objetivo Chrome/Chromium con WebGPU→WASM fallback | Media | Equipo | `ia/resolve-inference-device.ts` | Implementado | `ia/resolve-inference-device.test.ts` | Auto-detección de adapter |
| RNF-08 | Sin servicios en la nube para el producto (local-only) | Alta | Equipo | Todo el runtime; CI solo para calidad | Implementado | `docs/local-only-constraints` + `CONTRIBUTING.md` §Constraints | Demo en `localhost` |
| RNF-09 | Interfaz, instrucciones y correcciones en español | Media | Usuario | `ui/interface-texts.ts` | Implementado | Textos centralizados | Sin toggle bilingüe |
| RNF-10 | Half-duplex: bloquear mic mientras el tutor habla (TTS) | Media | Equipo | Sesión de UI + abort TTS con `cutoffMs` | Implementado | `ui/use-home-microphone-session.ts`, `audio/play-pcm-mono.test.ts` | Mic deshabilitado en UI; barge-in registra `spoken_progress` (issue #46) |
| RNF-11 | Barge-in / interrupción mid-utterance sin perder contexto de escena | Media | Equipo | `ui/spoken-progress.ts`, `interruption-turn-classifier.ts`, `interruption-resume-bridges.ts`, `storage` pending | Implementado | `ui/spoken-progress.test.ts`, `interruption-*.test.ts`, `storage/session-repository.test.ts` | Casos A/B/C/D issue #46; `spoken_progress` en turno + sesión |

## Extensiones de innovación (evaluación 10%)

| ID | Descripción | Prioridad | Fuente | Módulo / Funcionalidad | Estado | Pruebas de verificación | Métrica |
|----|-------------|-----------|--------|------------------------|--------|-------------------------|---------|
| RE-01 | Historial de práctica persistente | Baja | Equipo | `ui/PracticeHistoryPanel.tsx`, `storage/session-repository.ts` | Implementado | `ui/home-session-helpers.test.ts` | Turnos con score/texto |
| RE-02 | Tendencia / evolución de scores por sesión (UX de progreso) | Baja | Curso | — (planificado, issue #27) | Pendiente | — | Gráfica de tendencia |
| RE-03 | Banco de pruebas ASR con WER (solo desarrollo) | Baja | Equipo | `ui/AsrBenchmarkScreen.tsx`, `ui/use-asr-benchmark.ts`, `ia/word-error-rate.ts`, `storage/benchmark-fixture-store.ts` | Implementado | `ia/word-error-rate.test.ts`, `ui/asr-benchmark-results.test.ts`, `storage/benchmark-fixture-store.test.ts` | WER (Levenshtein) por candidato × backend |
| RE-04 | Calibración fina del score con hablantes reales | Baja | Equipo | `dsp/pronunciation-score.ts` (#29), `dsp/measure-speaker-bias.ts` (#95) | Parcial | `dsp/run-pronunciation-score-calibration.test.ts`, `dsp/measure-speaker-bias.test.ts` | Umbrales #29 + Δ locutor/error sintético; corpus real sigue fuera de Git |
| RE-05 | Soporte multi-idioma | Baja | Curso | — | Descartado | — | Solo variantes `.en`; excluido por decisión documentada |

## Resumen de cobertura

| Estado | Funcionales + DSP | No funcionales | Extensiones | Total |
|--------|:-----------------:|:--------------:|:-----------:|:-----:|
| Implementado | 18 | 8 | 2 | 28 |
| Parcial | 3 | 2 | 1 | 6 |
| Pendiente | 1 | 0 | 1 | 2 |
| Descartado | 0 | 0 | 1 | 1 |

**Lectura honesta del estado:** el núcleo funcional exigido por el enunciado
(ASR, gramática, análisis DSP de pronunciación con MFCC/YIN/DTW/formantes,
score 0–100, tutor conversacional, TTS, visualizaciones y offline real) está
**implementado y verificado por la suite de pruebas y el CI**. Los puntos
`Parcial` son de calibración/endurecimiento, no de ausencia: sugerencias como
salida diferenciada (RF-14), robustez a ruido (RF-22), latencia < 2 s (RNF-06,
limitada por el costo de `small-en`), half-duplex estricto (RNF-10) y
calibración del score (RE-04). Los `Pendiente` (filtrado adaptativo RF-23,
tendencia de scores RE-02) son extensiones de innovación fuera del core. El
detalle cuantitativo (WER, latencia, casos de prueba) está en el
[reporte de verificación](./reporte-verificacion.md).
