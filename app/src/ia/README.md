# ia/

Capa de **dominio y orquestación de modelos de inteligencia artificial**. Define
qué modelos existen, con qué identificadores del Hub se cargan y en qué orden se
encadenan dentro del pipeline de práctica: reconocimiento de voz (ASR) →
corrección gramatical → sugerencias de conversación → síntesis de voz (TTS).

Toda la ejecución pesada de `transformers.js` corre dentro de un Web Worker
dedicado (el "orquestador de inferencia") para no bloquear el hilo principal
de la interfaz. Esta capa depende hacia adentro de `dsp/` para pre-procesar
audio, pero nunca depende de `ui/`.

Implementado:

- `model-registry.ts`: catálogo tipado de modelos e IDs del Hub.
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
  hilo principal y el worker (entradas `'transcribe'`, `'correct-grammar'`;
  salidas `'model-loading-progress'`, `'transcription-result'`,
  `'transcription-error'`, `'grammar-correction-result'`,
  `'grammar-correction-error'`), compartidos por ambos extremos sin
  duplicarlos.
- `inference-worker.ts`: Web Worker orquestador. Cubre ASR y corrección
  gramatical (carga perezosa y memoizada por separado de cada pipeline, en
  su primer mensaje respectivo, reutilizados después); sugerencias → TTS se
  integran sobre este mismo worker en avances futuros.
- `inference-client.ts`: cliente del worker para el hilo principal (sin
  React), con correlación de solicitudes por `requestId`, progreso de
  descarga por modelo (`modelKey`) y errores tipados
  (`InferenceClientError`). Expone `transcribe` y `correctGrammar`.

Archivos previstos a futuro:

- `conversation-suggestions.ts`, `text-to-speech-synthesis.ts`: adaptadores
  de las etapas restantes del pipeline sobre `transformers.js`.
