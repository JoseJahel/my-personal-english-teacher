# audio/

Capa de **infraestructura de audio**: todo el código que toca APIs del navegador
(Web Audio API, `MediaDevices.getUserMedia`) vive aquí. Es la única capa que sabe
cómo capturar sonido del micrófono, convertirlo a la tasa de muestreo que espera
el resto del sistema (16 kHz mono) y exponerlo como datos crudos (`Float32Array`).

No contiene lógica de análisis de señal ni de modelos: solo captura y adaptación.
Depende únicamente hacia adentro (`dsp/`), nunca al revés.

Archivos previstos a futuro:

- `microphone-capture.ts`: apertura del micrófono y obtención del stream.
- `audio-resampler.ts`: conversión de la tasa de muestreo nativa del navegador a 16 kHz.
- `voice-activity-monitor.ts`: adaptador que conecta la captura en vivo con el
  detector de actividad de voz definido en `dsp/`.
