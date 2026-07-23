# ia/

Capa de **dominio y orquestación de modelos de inteligencia artificial**. Define
qué modelos existen, con qué identificadores del Hub se cargan y en qué orden se
encadenan dentro del pipeline de práctica: reconocimiento de voz (ASR) →
corrección gramatical → sugerencias de conversación → síntesis de voz (TTS).

Toda la ejecución pesada de `transformers.js` corre dentro de un Web Worker
dedicado (el "orquestador de inferencia") para no bloquear el hilo principal
de la interfaz. Esta capa **no** depende de `ui/`. El pre-proceso de audio
(energía, resample) lo aplican hoy `ui/` y `audio/` / `dsp/` antes de llamar al
cliente de inferencia; `ia/` solo recibe PCM ya a 16 kHz y texto.

Implementado:

- `model-registry.ts`: catálogo tipado de modelos e IDs del Hub (ASR y
  gramática en uso; TTS y sugerencias registrados para avances futuros).
- `automatic-speech-recognition.ts`: adaptador ASR Whisper. Por defecto
  **WASM + q8** (fiable); WebGPU solo con `VITE_INFERENCE_DEVICE=webgpu` y
  entonces **fp32** (q8+WebGPU produjo basura tipo bucles de tokens).
  `max_new_tokens` acotado por duración del audio.
- `grammar-correction.ts`: adaptador T5 con el mismo criterio de device/dtype.
  Si la salida es degenerada, devuelve el texto original.
- `transcription-text.ts`: filtra tags no-habla y texto degenerado (bucles).
- `model-download-progress.ts`: agrega el progreso **por archivo** de
  transformers.js a un % global monotónico (evita 30% → 18% → 45%).
- `resolve-inference-device.ts`: elige WebGPU vs WASM una sola vez.
- `inference-worker-protocol.ts`: mensajes
  - entradas: `'transcribe'`, `'correct-grammar'`, `'preload-models'`
  - salidas: progreso, `model-ready`, resultados/errores ASR y gramática,
    resultado/error de preload.
- `inference-worker.ts`: orquestador; carga memoizada; preload en serie
  (Whisper luego T5); progreso agregado por modelo.
- `inference-client.ts`: API de hilo principal (`transcribe`,
  `correctGrammar`, `preloadModels`) + listeners de progreso/ready.
- `transcription-text.ts`: helpers puros post-ASR (p. ej.
  `isNonSpeechTranscript` para descartar etiquetas tipo `[Music]` /
  `(dramatic music)` que Whisper inventa sin habla real). La UI no muestra
  el tag ni encadena gramática si el texto es no-habla.

Archivos previstos a futuro:

- `conversation-suggestions.ts`, `text-to-speech-synthesis.ts`: adaptadores
  de las etapas restantes del pipeline sobre `transformers.js`.
