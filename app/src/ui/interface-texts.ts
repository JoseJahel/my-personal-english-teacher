/**
 * Textos de interfaz de la pantalla inicial de la aplicación.
 *
 * Este es el ÚNICO lugar del código donde deben vivir cadenas de texto
 * visibles para la persona usuaria. Ningún componente de `ui/` debería
 * escribir texto en español directamente en su JSX: en su lugar, importa
 * los valores de este objeto. Esto facilita mantener el idioma consistente
 * y, más adelante, extraer estos textos a un sistema de traducción si hiciera falta.
 */
export const homeScreenInterfaceTexts = {
  applicationTitle: 'My Personal English Teacher',
  applicationSubtitle:
    'Practica inglés sin conexión: pronunciación, gramática y conversación con inteligencia artificial que corre en tu propio navegador.',
  projectPhaseBadgeLabel: 'Fase: Avance 1 — Procesamiento de señales',
  startMicrophoneButtonLabel: 'Iniciar micrófono',
  stopMicrophoneButtonLabel: 'Detener micrófono',
  statusFieldLabel: 'Estado',
  /**
   * Mensajes de estado de la captura de micrófono, uno por cada valor posible
   * del estado de la interfaz (esperando / arrancando / escuchando / detenido
   * / permiso denegado / error genérico).
   */
  microphoneStatusMessages: {
    idle: 'Esperando interacción...',
    starting: 'Solicitando acceso al micrófono...',
    listening: 'Escuchando voz y procesando señal en tiempo real...',
    stopped: 'Captura detenida.',
    permissionDenied:
      'Permiso de micrófono denegado. Habilítalo en la configuración del navegador para poder practicar.',
    genericError: 'No fue posible acceder al micrófono por un error inesperado.',
  },
  /** Etiqueta del panel que muestra el resultado de la transcripción (ASR). */
  transcriptionPanelLabel: 'Transcripción',
  /**
   * Mensajes de estado de la transcripción, uno por cada valor posible del
   * estado de la interfaz (esperando / descargando modelo / transcribiendo /
   * lista / error). `modelLoadingProgressMessage` es una función en vez de un
   * texto fijo porque necesita interpolar el porcentaje de descarga que
   * reenvía `inference-worker.ts`; sigue centralizando aquí la parte fija del
   * mensaje, como exige la convención del proyecto para los textos visibles.
   */
  transcriptionStatusMessages: {
    idle: 'Detén el micrófono para transcribir lo que dijiste.',
    modelLoadingProgressMessage: (progressPercent: number) =>
      `Descargando el modelo de reconocimiento de voz... ${progressPercent}%`,
    transcribing: 'Transcribiendo audio...',
    done: 'Transcripción lista.',
  },
  /**
   * Mensajes de error de la transcripción, uno por cada motivo tipado de
   * `InferenceClientErrorReason` (`ia/inference-client.ts`).
   */
  transcriptionErrorMessages: {
    invalidSampleRate: 'El audio capturado no está a la tasa que espera el modelo de voz.',
    modelLoadFailed: 'No fue posible descargar o inicializar el modelo de reconocimiento de voz.',
    transcriptionFailed: 'No fue posible transcribir el audio capturado.',
    workerUnavailable: 'El proceso de reconocimiento de voz dejó de responder inesperadamente.',
  },
  /** Etiqueta del panel que muestra el resultado de la corrección gramatical (T5). */
  grammarCorrectionPanelLabel: 'Corrección gramatical',
  /**
   * Nombres legibles de cada modelo del registro (`ia/model-registry.ts`),
   * para interpolar en el mensaje de progreso de descarga
   * (`modelLoadingProgressMessage`) y que la persona usuaria sepa qué se está
   * descargando, en vez de un mensaje genérico igual para todos los modelos.
   */
  modelDisplayNames: {
    automaticSpeechRecognition: 'reconocimiento de voz',
    grammarCorrection: 'corrección gramatical',
    textToSpeech: 'síntesis de voz',
    textToSpeechVocoder: 'síntesis de voz',
    conversationSuggestions: 'sugerencias de conversación',
  },
  /**
   * Mensajes de estado de la corrección gramatical, uno por cada valor
   * posible del estado de la interfaz (esperando / descargando modelo /
   * corrigiendo / lista / sin correcciones / error). Mismo espíritu que
   * `transcriptionStatusMessages`: `modelLoadingProgressMessage` interpola el
   * nombre del modelo (`modelDisplayNames`) y el porcentaje de descarga.
   */
  grammarCorrectionStatusMessages: {
    idle: 'Esperando la transcripción para corregir la gramática.',
    modelLoadingProgressMessage: (modelDisplayName: string, progressPercent: number) =>
      `Descargando el modelo de ${modelDisplayName}... ${progressPercent}%`,
    correcting: 'Corrigiendo gramática...',
    done: 'Corrección lista.',
    noCorrectionsNeeded:
      'No se encontraron correcciones: la oración ya es gramaticalmente correcta.',
  },
  /**
   * Mensajes de error de la corrección gramatical, uno por cada motivo
   * tipado de `InferenceClientErrorReason` que puede surgir en esta etapa
   * del pipeline (`ia/inference-client.ts`).
   */
  grammarCorrectionErrorMessages: {
    modelLoadFailed: 'No fue posible descargar o inicializar el modelo de corrección gramatical.',
    correctionFailed: 'No fue posible corregir la gramática del texto transcrito.',
    workerUnavailable: 'El proceso de corrección gramatical dejó de responder inesperadamente.',
  },
} as const
