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
  TTS y **SmolLM2** en uso). ASR además cataloga 4 **candidatos Whisper**
  evaluables (`asrModelCandidates`: tiny-en default, base-en, distil-small-en,
  small-en) con tamaño aproximado de descarga; override de desarrollo
  `VITE_ASR_MODEL`.
- `keyed-async-cache.ts`: memoización de promesas por clave; el worker la usa
  para mantener un pipeline Whisper cargado por candidato ASR sin relanzar una
  carga ya en curso.
- `automatic-speech-recognition.ts`: adaptador ASR Whisper, ahora consciente
  del candidato activo. Por defecto **WASM + q8** (fiable); WebGPU solo con
  `VITE_INFERENCE_DEVICE=webgpu` y entonces **fp32** (q8+WebGPU produjo basura
  tipo bucles de tokens). `max_new_tokens` acotado por duración del audio.
- `grammar-correction.ts`: adaptador T5 con el mismo criterio de device/dtype.
  Si la salida es degenerada, devuelve el texto original.
- `text-to-speech-synthesis.ts`: **SpeechT5** (`Xenova/speecht5_tts`, dtype
  **fp32**), vocoder HiFi-GAN por defecto del pipeline, speaker embedding
  Xenova demo; `synthesizeSpeechFromText` → PCM + sample rate.
- `conversation-suggestions.ts`: genera la **respuesta principal** del tutor
  con SmolLM2 (memoria de hasta 4 turnos previos) + filtro de plausibilidad
  (`isPlausibleTutorReply`). La orquestación del timeout (10 s) y el respaldo
  veraz al guion por escenario viven en `ui/tutor-reply-orchestration.ts` +
  `ui/tutor-reply-engine.ts`, no en esta capa.
- `word-error-rate.ts`: **WER** (Levenshtein a nivel de palabra) para el banco
  de pruebas ASR de desarrollo; no se usa en el pipeline de producción.
- `transcription-text.ts`: filtra tags no-habla y texto degenerado (bucles).
- `model-download-progress.ts`: agrega el progreso **por archivo** de
  transformers.js a un % global monotónico (evita 30% → 18% → 45%).
- `resolve-inference-device.ts`: elige WebGPU vs WASM una sola vez; lee
  `import.meta.env.VITE_INFERENCE_DEVICE` sin cast para que Vite/Vitest lo
  mantengan dinámico en dev/test (un cast previo lo congelaba a un snapshot
  fijo del valor).
- `inference-worker-protocol.ts`: mensajes
  - entradas: `'transcribe'`, `'correct-grammar'`, `'preload-models'`,
    `'synthesize-speech'`, `'generate-tutor-reply'`,
    `'preload-conversation-model'`, `'set-preferred-device'` (solo banco de
    pruebas, sin respuesta); `'transcribe'` y `'preload-models'` aceptan un
    `asrCandidateId` opcional (solo banco de pruebas; el flujo normal de la
    app lo omite y usa el candidato activo).
  - salidas: progreso, `model-ready`, ASR/gramática/TTS/tutor result|error.
- `inference-worker.ts`: orquestador; preload Whisper+T5; TTS y SmolLM2 on
  demand; cachea un pipeline Whisper por candidato ASR (`KeyedAsyncCache`) y
  aplica `set-preferred-device` antes de procesar cualquier otro mensaje.
- `inference-client.ts`: `transcribe`, `correctGrammar`, `synthesizeSpeech`,
  `generateTutorReply`, `preloadModels`, `preloadConversationModel` +
  listeners; builders puros de mensajes; `forcedDevice` opcional al crear el
  cliente (solo banco de pruebas) para fijar el backend sin depender del
  override de entorno.
