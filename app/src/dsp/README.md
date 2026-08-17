# dsp/

Núcleo de **dominio puro** de procesamiento de señales digitales. Todo lo que
vive aquí son funciones puras (mismas entradas, mismas salidas, sin efectos
secundarios, sin acceso a APIs del navegador ni al DOM), lo que las hace
triviales de testear con Vitest y reutilizables desde un Web Worker.

Esta capa no depende de ninguna otra capa del proyecto: es el centro de la
arquitectura. `audio/` le entrega muestras ya capturadas y `ia/` puede apoyarse
en estas funciones para pre-procesar audio antes de pasarlo a los modelos.

Implementado:

- `signal-energy.ts`: dominio puro de energía y gate de habla usable:
  - `computeRootMeanSquareEnergy`, `computePeakAmplitude`
  - umbrales `MINIMUM_CAPTURE_ENERGY_RMS`, `MINIMUM_CAPTURE_PEAK`,
    `MINIMUM_CAPTURE_DURATION_SECONDS`
  - `hasUsableSpeechEnergy` — la sesión de UI lo usa **después** de detener
    la captura, para no mandar silencio/ruido a Whisper
  - tests en `signal-energy.test.ts`
  - base del futuro VAD en vivo (aún no corta la captura automáticamente)

- `pitch-detection-yin.ts`: estimación de tono fundamental (F0) con **YIN**
  (de Cheveigné & Kawahara, 2002), dominio puro:
  - `estimatePitchWithYin(samples, sampleRate)` — un frame → F0 o unvoiced
  - `extractPitchContourWithYin` — contorno frame a frame (hop por defecto 10 ms)
  - `computeMeanVoicedPitchInHertz` — media de frames voiced
  - defaults de habla: 70–400 Hz, umbral absoluto 0.1, frame ~40 ms
  - pasos: función de diferencia → media acumulada normalizada → umbral
    absoluto → interpolación parabólica del período
  - tests en `pitch-detection-yin.test.ts` (senos sintéticos 16 kHz / 48 kHz)
  - **aún no cableado a la UI** (panel de pitch + score con DTW)

- `mfcc-extraction.ts`: **MFCC de implementación propia** (sin Meyda en runtime):
  - defaults del diseño: Hann **25 ms**, hop **10 ms**, **13** coeficientes, **40** filtros mel
  - pre-énfasis 0.97 → ventana Hann → FFT potencia-de-2 → banco mel → log → DCT-II
  - `extractMfccSequence`, `createMelFilterbank`, `hertzToMel` / `melToHertz`
  - `computeMfccVectorEuclideanDistance` (coste local; DTW también expone el genérico)
  - tests en `mfcc-extraction.test.ts` (escala mel, forma del banco, tonos vs ruido)
  - **vectores dorados** (issue #67): `mfcc-golden-vectors.json` +
    `mfcc-golden-vectors.test.ts`. Recetas en `mfcc-golden-signals.ts`.
    c0 se compara con la misma cota que c1–c12 (amplitud fijada). Regenerar:
    `pnpm exec jiti src/dsp/write-mfcc-golden-vectors.ts` desde `app/`.
  - **Convención HTK (issue #94):** escala mel `2595·log10(1+f/700)`, 40
    triángulos de 0 Hz a Nyquist (8 kHz a 16 kHz), **sin** normalizar a
    energía igual (Slaney). Espectro de potencia `|X[k]|²` **sin** `1/N²` ni
    `log10` (eso es el espectrograma de UI). `log` natural de la energía
    mel, piso `1e-10`. DCT-II sin normalizar; **c0 se conserva**. Invariante
    de encadenado: `mfcc-chain-audit.ts` + `mfcc-chain-invariants.json`.

- `dynamic-time-warping.ts`: **DTW + distancia euclidiana** (dominio puro):
  - `computeDynamicTimeWarping(query, reference)` → distancia total, normalizada y path
  - banda opcional Sakoe–Chiba; coste local L2 frame a frame
  - `zScoreNormalizeFeatureSequence` (normalización por locutor / enunciado)
  - `centerVoicedPitchContourInHertz` + `pitchContourToFeatureFrames` (pitch relativo)
  - `convertDtwDistanceToPronunciationScore` → puntuación 0–100 (calibrable)
  - tests en `dynamic-time-warping.test.ts` (estiramiento temporal, MFCC mismo tono vs distinto)
- `pronunciation-score.ts`: **score de pronunciación** (dominio puro):
  - `scorePronunciationFromMonoPcm(user, reference, sampleRate)`
  - MFCC + pitch + **energía** (log-RMS + DTW) + **formantes** (mediana F1–F3
    log-Hz); pesos 0.68 / 0.18 / 0.07 / 0.07 (issue #58). Rama nula →
    redistribución (`combine-pronunciation-branch-scores.ts`).
  - defaults calibrados MFCC/pitch (issue #29): `pronunciation-score-calibration-constants.ts`
  - protocolo multi-hablante + fit: `run-pronunciation-score-calibration.ts`
  - tests en `pronunciation-score.test.ts`, `score-energy-contour.test.ts`,
    `score-formant-distance.test.ts`
  - **Sesgo locutor (issue #95, re-medido #58):** `measure-speaker-bias.ts` +
    `synthetic-voiced-phrase.ts`. Δlocutor **11.3** ≳ Δerror **9.9**
    (ratio **1.14**) → 0–100 solo en drill. Invariantes:
    `speaker-bias-invariants.ts`.
  - Orquestación UI: `ui/run-pronunciation-scoring.ts` (cadena #73 + score)
  - Doc: `Documentacion general/calibracion-score-pronunciacion.md`

- `polyphase-resample.ts` + `design-linear-phase-lowpass-fir.ts` (issue #92):
  remuestreo **FIR de fase lineal** a 16 kHz. 48 kHz = decimación ×3;
  44.1 kHz = racional 160/441 (no se aproxima a 48). Corte 7.2 kHz, Hann,
  $N=93$ a la tasa de entrada. Un tono de 12 kHz mide ~85 dB de rechazo
  (umbral exportado 50 dB). Coste polifásico: 31 MAC/entrada a 48 kHz, 93
  MAC/salida a 44.1 kHz. Cableado en `audio/audio-resampler.ts` (lineal solo
  si la tasa no es 44.1/48). Tests: `polyphase-resample.test.ts`.

- `radix2-forward-fft.ts`: **FFT radix-2** Cooley–Tukey in-place (Float32 o
  Float64). Única implementación usada por espectrograma y MFCC.
  Verificada contra la DFT O(N²) (`dft-reference.ts`, solo tests): error
  máximo absoluto &lt; 1e-10 en Float64. tests en `radix2-forward-fft.test.ts`
  (impulso, bin exacto, Parseval).

- `spectrogram.ts`: **espectrograma** log-magnitud (STFT Hann 25 ms / hop 10 ms):
  - `computeLogMagnitudeSpectrogram`, `computeSpectrogramValueRange`
  - tests en `spectrogram.test.ts` (tono 1 kHz en el bin analítico; primer
    frame vs DFT del frame con Hann)
  - dibujo en UI: `ui/utterance-signal-canvas.ts` + `update-utterance-signal-views.ts`
  - **en vivo (issue #93):** `analyze-live-pcm-frame.ts` + acumulador
    `pcm-frame-accumulator.ts` (hop 10 ms, ventana 25 ms, **sin** zero-pad).
    Misma STFT que post-stop. Coste por trama documentado en el reporte §5.4.

- `biquad-voice-bandpass.ts`: **pasa-banda de voz** (issue #73), Butterworth
  2.º orden (biquad RBJ) en cascada HP **80 Hz** + LP **7.5 kHz**. Una sola
  pasada causal (no `filtfilt`). Medido a 16 kHz: −3.01 dB en ambos cortes,
  0.00 dB a 1 kHz, −24.1 dB a 20 Hz. Tests: `biquad-voice-bandpass.test.ts`.
  La cadena compartida user/ref vive en `audio/prepare-speech-pcm.ts`.

- `voice-activity-detection.ts`: **VAD por energía** (estado + hangover de silencio):
  - `createEnergyVoiceActivityDetector` → auto-stop de captura en la UI
  - tests en `voice-activity-detection.test.ts`
  - cableado en `use-home-screen-session` vía medidores del Analyser

- `word-pronunciation-highlights.ts`: **highlights por palabra** desde costes
  locales del path DTW (reparto proporcional por letras); bandas good/medium/poor.
  Integrado en `pronunciation-score` cuando hay texto de referencia.

- `formant-estimation.ts`: **formantes F1/F2/F3** vía LPC (Levinson–Durbin) +
  picos de la envolvente; mediana por utterance en la UI.
  tests en `formant-estimation.test.ts`.

Archivos previstos a futuro (fuera de A2 / final):

- IndexedDB de sesiones.
