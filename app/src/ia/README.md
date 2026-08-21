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
  TTS y **SmolLM2** en uso) con **revisiones ancladas a SHA** del Hub. ASR
  cataloga 4 candidatos Whisper (`tiny-en`, `base-en`, `distil-small-en`,
  **`small-en` default de producción**); override `VITE_ASR_MODEL` o perfil
  `VITE_ASR_PROFILE=latency` (`tiny-en`, issue #61).
- `keyed-async-cache.ts`: memoización de promesas por clave; el worker la usa
  para mantener un pipeline Whisper cargado por candidato ASR sin relanzar una
  carga ya en curso.
- `automatic-speech-recognition.ts` + `resolve-inference-device.ts`: ASR usa
  el candidato activo y **auto-detecta WebGPU** (latencia viable de small-en);
  fallback WASM. En WebGPU el dtype es **fp32** (q8+WebGPU produce basura).
  Gramática/TTS/SmolLM2 se fuerzan a WASM. `max_new_tokens` acotado por audio.

- `grammar-correction.ts`: adaptador T5 con el mismo criterio de device/dtype.
  Si la salida es degenerada, devuelve el texto original.
- `text-to-speech-synthesis.ts`: **Supertonic** (`onnx-community/Supertonic-TTS-ONNX`,
  revisión anclada por SHA, dtype **fp32** — no hay variantes cuantizadas
  publicadas). Sin vocoder separado: son 3 sesiones ONNX encadenadas
  (`text_encoder` → `latent_denoiser` → `voice_decoder`) y el propio modelo
  decodifica la forma de onda. Voz fija **F1**: no una red ni un x-vector por
  locutor, sino un vector de estilo precomputado (`voices/F1.bin`) que se
  descarga del propio repo del modelo en el Hub. Ese fetch de
  `speaker_embeddings` lo resuelve internamente transformers.js con un
  `fetch()` crudo que no pasa por `getModelFile`/`hub.js` (no hay progreso ni
  caché de pesos), así que `preloadTutorVoiceEmbeddings` lo descarga aparte
  durante el warm preload, lo persiste en el mismo bucket `transformers-cache`
  de Cache Storage y guarda el `Float32Array` decodificado en memoria para que
  `synthesizeSpeechFromText` se lo pase directo al pipeline; si esa precarga
  falla, cae de vuelta al fetch original de la librería y la app sigue sin
  romper el turno. `synthesizeSpeechFromText` → PCM (44.100 Hz) + sample rate.
- `conversation-suggestions.ts`: genera la **respuesta principal** del tutor
  con SmolLM2 (memoria de hasta 4 turnos previos) + filtro de plausibilidad
  (`isPlausibleTutorReply`). La orquestación del timeout (10 s) y el respaldo
  veraz al guion por escenario viven en `ui/tutor-reply-orchestration.ts` +
  `ui/tutor-reply-engine.ts`, no en esta capa. Distinto de
  `communication-suggestions.ts` (abajo): este módulo decide qué contesta el
  tutor, no las fichas de coaching sobre lo que dijo el alumno.
- `communication-suggestions.ts`: ensambla hasta 3 tarjetas de coaching
  deterministas para el último turno del alumno (`buildCommunicationSuggestions`):
  **vocabulario**, **naturalidad** y **fluidez**, deduplicadas por tipo y
  citando siempre la frase real dicha (`youSaidEn`) y la reescritura sugerida
  (`tryThisEn`) en vez de rotar líneas genéricas de escenario. No confundir
  con `conversation-suggestions.ts` (arriba), que genera la respuesta
  principal del tutor; este módulo alimenta la pestaña Sugerencias del panel
  de feedback.
- `communication-suggestion-analysis.ts`: parseo puro de un turno de práctica
  (`analyzePracticeUtterance`) — intención (`order`, `request`, `question`,
  `thanks`, `introduction`, `experience`, `agreement`, `statement`),
  complemento extraído por patrón (qué pidió, de qué habló), detección de
  modal de cortesía (`hasPoliteModal`) y el diff palabra a palabra entre lo
  dicho y lo corregido por gramática (vía `diffEnglishWords`, de
  `grammar-correction-diff.ts`) para listar sustituciones, palabras añadidas
  y eliminadas.
- `communication-suggestion-rewrites.ts`: reescrituras deterministas
  construidas sobre ese análisis, no una tabla de frases fija —
  `rewriteAsNative` (pedidos cortos → «Could I have…, please?», preguntas
  conocidas reformuladas por clase gramatical: «who is X» → «Sorry, I didn't
  catch X's name», «where is X» → «Could you tell me where X is?») y
  `expandForFluency` (alarga turnos cortos con un detalle concreto, p. ej.
  experiencia laboral). Nunca devuelve una línea de escenario genérica si el
  alumno dijo otra cosa.
- `communication-coaching-generation.ts`: pasada opcional con SmolLM2 sobre
  el último turno del alumno — pide al modelo exactamente dos líneas
  (`TRY:` / `WHY:`), acotada a **72 tokens nuevos**
  (`DEFAULT_COACHING_MAX_NEW_TOKENS`) con timeout de **8 s**
  (`COMMUNICATION_COACHING_TIMEOUT_MS`, corre en carrera contra la
  generación vía `resolveDynamicCommunicationSuggestions`). El borrador pasa
  por `isAcceptableCoachingDraft` (longitud 8–180 caracteres, proporción
  mínima de letras, no puede ser eco literal de lo que dijo el alumno, el
  «why» no puede repetir el «try», y debe citar una palabra de contenido del
  turno original o responder al tipo de pregunta hecha) antes de aceptarse;
  si falla la generación o la validación, respalda a las tarjetas
  estructurales de `communication-suggestions.ts` sin bloquear el turno.
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
    `'generate-communication-coaching'`, `'preload-conversation-model'`,
    `'set-preferred-device'` (solo banco de pruebas, sin respuesta);
    `'transcribe'` y `'preload-models'` aceptan un `asrCandidateId` opcional
    (solo banco de pruebas; el flujo normal de la app lo omite y usa el
    candidato activo).
  - salidas: progreso, `model-ready`, ASR/gramática/TTS/tutor/coaching
    result|error.
- `inference-worker.ts`: orquestador; **preload en paralelo** Whisper+T5+Supertonic
  + fichero de voz F1 (`warm-model-preload.ts`, `Promise.allSettled`: un fallo
  en la voz no bloquea a los demás modelos); SmolLM2 al elegir escenario;
  cachea un pipeline Whisper por candidato ASR (`KeyedAsyncCache`) y aplica
  `set-preferred-device` antes de procesar cualquier otro mensaje.
- `inference-client.ts`: `transcribe`, `correctGrammar`, `synthesizeSpeech`,
  `generateTutorReply`, `generateCommunicationCoaching`, `preloadModels`,
  `preloadConversationModel` + listeners; builders puros de mensajes;
  `forcedDevice` opcional al crear el cliente (solo banco de pruebas) para
  fijar el backend sin depender del override de entorno.
