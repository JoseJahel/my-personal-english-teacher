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
- `inference-worker-protocol.ts`: tipos de los mensajes que intercambian el
  hilo principal y el worker (entrada `'transcribe'`; salidas
  `'model-loading-progress'`, `'transcription-result'`,
  `'transcription-error'`), compartidos por ambos extremos sin duplicarlos.
- `inference-worker.ts`: Web Worker orquestador. Por ahora solo cubre ASR
  (carga perezosa del pipeline en el primer `'transcribe'`, reutilizado
  después); gramática → sugerencias → TTS se integran sobre este mismo
  worker en avances futuros.
- `inference-client.ts`: cliente del worker para el hilo principal (sin
  React), con correlación de solicitudes por `requestId`, progreso de
  descarga del modelo y errores tipados (`InferenceClientError`).

Archivos previstos a futuro:

- `grammar-correction.ts`, `conversation-suggestions.ts`,
  `text-to-speech-synthesis.ts`: adaptadores de las etapas restantes del
  pipeline sobre `transformers.js`.
