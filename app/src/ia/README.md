# ia/

Capa de **dominio y orquestación de modelos de inteligencia artificial**. Define
qué modelos existen, con qué identificadores del Hub se cargan y en qué orden se
encadenan dentro del pipeline de práctica: reconocimiento de voz (ASR) →
corrección gramatical → sugerencias de conversación → síntesis de voz (TTS).

Toda la ejecución pesada de `transformers.js` deberá correr dentro de un Web
Worker dedicado (el futuro "orquestador de inferencia") para no bloquear el hilo
principal de la interfaz. Esta capa depende hacia adentro de `dsp/` para
pre-procesar audio, pero nunca depende de `ui/`.

Archivos previstos a futuro:

- `model-registry.ts`: catálogo tipado de modelos e IDs del Hub (ya implementado).
- `inference-worker.ts`: Web Worker orquestador del pipeline ASR → gramática →
  sugerencias → TTS.
- `automatic-speech-recognition.ts`, `grammar-correction.ts`,
  `conversation-suggestions.ts`, `text-to-speech-synthesis.ts`: adaptadores de
  cada etapa del pipeline sobre `transformers.js`.
