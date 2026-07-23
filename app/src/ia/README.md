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
- `automatic-speech-recognition.ts`: adaptador del pipeline ASR de
  `transformers.js` sobre el modelo Whisper de `model-registry.ts`, con
  WebGPU oportunista y fallback automático a WASM. Pensado para ejecutarse
  dentro del worker.
- `grammar-correction.ts`: adaptador del pipeline `text2text-generation` de
  `transformers.js` sobre el modelo T5 de `model-registry.ts`
  (`Xenova/t5-base-grammar-correction`), segunda etapa del pipeline
  (ASR → gramática). Mismo patrón WebGPU→WASM que el ASR. Expone
  `buildGrammarCorrectionInput` (función pura que antepone el prefijo
  `'grammar: '` que exige el modelo) y `grammarCorrectionMadeNoChanges`
  (función pura que compara, normalizada, el texto transcrito contra el
  corregido, para que `ui/` sepa cuándo mostrar "sin correcciones
  necesarias").
- `inference-worker-protocol.ts`: tipos de los mensajes que intercambian el
  hilo principal y el worker:
  - entradas: `'transcribe'`, `'correct-grammar'`
  - salidas: `'model-loading-progress'`, `'model-ready'`,
    `'transcription-result'`, `'transcription-error'`,
    `'grammar-correction-result'`, `'grammar-correction-error'`
- `inference-worker.ts`: Web Worker orquestador. Cubre ASR y corrección
  gramatical (carga perezosa y memoizada por separado de cada pipeline, en
  su primer mensaje respectivo, reutilizados después); emite `model-ready`
  al terminar cada carga. Sugerencias → TTS se integran sobre este mismo
  worker en avances futuros.
- `inference-client.ts`: cliente del worker para el hilo principal (sin
  React), con correlación de solicitudes por `requestId`, progreso de
  descarga por modelo (`modelKey`), evento `model-ready` y errores tipados
  (`InferenceClientError`). Expone `transcribe` y `correctGrammar`.
- `transcription-text.ts`: helpers puros post-ASR (p. ej.
  `isNonSpeechTranscript` para descartar etiquetas tipo `[Music]` /
  `(dramatic music)` que Whisper inventa sin habla real). La UI no muestra
  el tag ni encadena gramática si el texto es no-habla.

Archivos previstos a futuro:

- `conversation-suggestions.ts`, `text-to-speech-synthesis.ts`: adaptadores
  de las etapas restantes del pipeline sobre `transformers.js`.
