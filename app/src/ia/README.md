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

- `model-registry.ts`: catálogo tipado de modelos e IDs del Hub (ASR, gramática,
  TTS y **SmolLM2** en uso).
- `automatic-speech-recognition.ts`: adaptador ASR Whisper. Por defecto
  **WASM + q8** (fiable); WebGPU solo con `VITE_INFERENCE_DEVICE=webgpu` y
  entonces **fp32** (q8+WebGPU produjo basura tipo bucles de tokens).
  `max_new_tokens` acotado por duración del audio.
- `grammar-correction.ts`: adaptador T5 con el mismo criterio de device/dtype.
  Si la salida es degenerada, devuelve el texto original.
- `text-to-speech-synthesis.ts`: **SpeechT5** (`Xenova/speecht5_tts`, dtype
  **fp32**), vocoder HiFi-GAN por defecto del pipeline, speaker embedding
  Xenova demo; `synthesizeSpeechFromText` → PCM + sample rate.
- `conversation-suggestions.ts`: utilidades + **filtro de calidad** para un
  posible LLM; el diálogo en UI usa **guiones multi-turno curados**
  (`practice-scenarios`) para coherencia y latencia.
- `transcription-text.ts`: filtra tags no-habla y texto degenerado (bucles).
- `model-download-progress.ts`: agrega el progreso **por archivo** de
  transformers.js a un % global monotónico (evita 30% → 18% → 45%).
- `resolve-inference-device.ts`: elige WebGPU vs WASM una sola vez.
- `inference-worker-protocol.ts`: mensajes
  - entradas: `'transcribe'`, `'correct-grammar'`, `'preload-models'`,
    `'synthesize-speech'`, `'generate-tutor-reply'`
  - salidas: progreso, `model-ready`, ASR/gramática/TTS/tutor result|error.
- `inference-worker.ts`: orquestador; preload Whisper+T5; TTS y SmolLM2 on demand.
- `inference-client.ts`: `transcribe`, `correctGrammar`, `synthesizeSpeech`,
  `generateTutorReply`, `preloadModels` + listeners.
