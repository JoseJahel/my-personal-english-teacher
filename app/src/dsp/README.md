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

Archivos previstos a futuro:

- `pitch-detection-yin.ts`: estimación de tono con el algoritmo YIN.
- `mfcc-extraction.ts`: extracción de coeficientes cepstrales (MFCC).
- `dynamic-time-warping.ts`: comparación de contornos de pronunciación en el tiempo.
- Lógica de VAD en vivo (frames) reutilizable desde un monitor en `audio/`.
