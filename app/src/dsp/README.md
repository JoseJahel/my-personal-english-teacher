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

- `dynamic-time-warping.ts`: **DTW + distancia euclidiana** (dominio puro):
  - `computeDynamicTimeWarping(query, reference)` → distancia total, normalizada y path
  - banda opcional Sakoe–Chiba; coste local L2 frame a frame
  - `zScoreNormalizeFeatureSequence` (normalización por locutor / enunciado)
  - `centerVoicedPitchContourInHertz` + `pitchContourToFeatureFrames` (pitch relativo)
  - `convertDtwDistanceToPronunciationScore` → puntuación 0–100 (calibrable)
  - tests en `dynamic-time-warping.test.ts` (estiramiento temporal, MFCC mismo tono vs distinto)
- `pronunciation-score.ts`: **score de pronunciación** (dominio puro):
  - `scorePronunciationFromMonoPcm(user, reference, sampleRate)`
  - MFCC (z-score) + DTW; pitch relativo (YIN) opcional → score 0–100
  - defaults calibrados (issue #29): `pronunciation-score-calibration-constants.ts`
  - protocolo multi-hablante + fit: `run-pronunciation-score-calibration.ts`
  - tests en `pronunciation-score.test.ts`, `run-pronunciation-score-calibration.test.ts`
  - Orquestación UI: `ui/run-pronunciation-scoring.ts` (resample + TTS ref + score)
  - Doc: `Documentacion general/calibracion-score-pronunciacion.md`

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
