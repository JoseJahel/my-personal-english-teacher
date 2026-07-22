# audio/

Capa de **infraestructura de audio**: todo el código que toca APIs del navegador
(Web Audio API, `MediaDevices.getUserMedia`) vive aquí. Es la única capa que sabe
cómo capturar sonido del micrófono, convertirlo a la tasa de muestreo que espera
el resto del sistema (16 kHz mono) y exponerlo como datos crudos (`Float32Array`).

No contiene lógica de análisis de señal ni de modelos: solo captura y adaptación.
Depende únicamente hacia adentro (`dsp/`), nunca al revés.

**Estado actual:** la migración desde `App.tsx` ya se hizo. `App.tsx` ahora
solo presenta (dibuja el waveform en canvas a partir del `AnalyserNode` que
expone esta capa); toda la apertura de micrófono y el manejo del grafo de Web
Audio vive aquí.

Implementado:

- `microphone-capture.ts`: apertura del micrófono (`getUserMedia`, mono) y
  armado del grafo de Web Audio — expone un `AnalyserNode` a tasa nativa para
  visualización y una rama de frames crudos vía `AudioWorkletNode`
  (`subscribeToAudioFrames`), con `stop()` idempotente y errores de primera
  clase (`MicrophoneCaptureError`, con motivo `'permission-denied'` o
  `'unknown'`).
- `audio-resampler.ts`: resampleo por interpolación lineal de la tasa nativa
  a 16 kHz mono, la tasa que exige Whisper (`resampleAudioSamples`,
  `resampleToWhisperRate`), con tests en `audio-resampler.test.ts`.

Archivos previstos a futuro:

- `voice-activity-monitor.ts`: adaptador que conecta la captura en vivo con el
  detector de actividad de voz definido en `dsp/`.
