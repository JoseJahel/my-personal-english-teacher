/**
 * All user-visible Spanish copy for the home screen.
 * Components must import strings from here — never hardcode product text in JSX.
 */
export const homeScreenInterfaceTexts = {
  applicationTitle: 'My Personal English Teacher',
  applicationSubtitle:
    'Practica inglés sin conexión: pronunciación, gramática y conversación con inteligencia artificial que corre en tu propio navegador.',
  projectPhaseBadgeLabel: 'Fase: Avance 1 — Procesamiento de señales',
  startMicrophoneButtonLabel: 'Iniciar micrófono',
  stopMicrophoneButtonLabel: 'Detener micrófono',
  statusFieldLabel: 'Estado',
  microphoneStatusMessages: {
    idle: 'Esperando interacción...',
    starting: 'Solicitando acceso al micrófono...',
    listening: 'Escuchando… la barra de nivel y la onda deben reaccionar cuando hables.',
    stopped: 'Captura detenida.',
    permissionDenied:
      'Permiso de micrófono denegado. Habilítalo en la configuración del navegador para poder practicar.',
    genericError: 'No fue posible acceder al micrófono por un error inesperado.',
    detailedError: (detail: string) =>
      `No fue posible acceder al micrófono. Detalle: ${detail}`,
  },
  inputLevelLabel: 'Nivel de entrada',
  inputLevelHintSilent:
    'Pico casi 0: no llega señal del mic. Revisa dispositivo de Windows y permisos de Chrome.',
  inputLevelHintActive: 'Habla y calla: el % y los números RMS/pico deben cambiar contigo.',
  inputLevelMeters: (rms: number, peak: number) =>
    `RMS ${rms.toFixed(4)} · pico ${peak.toFixed(4)}`,
  activeMicrophoneLabel: (deviceLabel: string) =>
    `Micrófono en uso: ${deviceLabel || 'desconocido (revisa la entrada de Windows)'}`,
  environmentDiagnostics: (nativeGum: boolean, devicesSummary: string) =>
    `Entorno: getUserMedia nativo ${nativeGum ? 'SÍ' : 'NO (hay un mock/parche)'}. ${devicesSummary}`,
  transcriptionPanelLabel: 'Transcripción',
  transcriptionStatusMessages: {
    idle: 'Detén el micrófono para transcribir lo que dijiste.',
    noAudioEmptyRecording:
      'La grabación salió vacía: el navegador no recibió muestras del micrófono. Revisa el micrófono predeterminado de Windows y el permiso del sitio.',
    noAudioLowEnergy: (rmsEnergy: number, peakAmplitude: number, deviceLabel: string) =>
      `La señal es demasiado débil para ser habla clara (RMS ${rmsEnergy.toFixed(4)}, pico ${peakAmplitude.toFixed(4)}, mic: "${deviceLabel || 'desconocido'}"). Acércate al micrófono, habla más alto 3–5 segundos en inglés y revisa el dispositivo de entrada de Windows.`,
    noAudioNonSpeech: (whisperRawText: string) =>
      `El modelo oyó audio pero no lo interpretó como habla en inglés (respondió: "${whisperRawText}"). Suele pasar con ruido/ambiente o si la voz llega muy distorsionada. Habla más cerca, en inglés, 3–5 segundos, sin música de fondo.`,
    noAudioCaptured:
      'No se reconoció habla clara en inglés. Habla cerca del micrófono (comprueba que Windows use el micrófono correcto y que no esté silenciado) e inténtalo de nuevo.',
    modelLoadingProgressMessage: (progressPercent: number) =>
      `Descargando el modelo de reconocimiento de voz... ${progressPercent}%`,
    transcribing: 'Transcribiendo audio...',
    done: 'Transcripción lista.',
  },
  /** Technical capture stats shown under the transcription panel when capture fails. */
  captureDiagnosticsLabel: 'Diagnóstico de captura',
  captureDiagnosticsMessage: (details: {
    sampleCount: number
    durationSeconds: number
    rmsEnergy: number
    peakAmplitude: number
    deviceLabel: string
    source: string
    mediaRecorderBlobBytes: number
    trackReadyState: string
    trackMuted: boolean
    audioContextState: string
  }) =>
    `${details.sampleCount} muestras · ${details.durationSeconds.toFixed(2)} s · RMS ${details.rmsEnergy.toFixed(5)} · pico ${details.peakAmplitude.toFixed(5)} · fuente ${details.source} · blob ${details.mediaRecorderBlobBytes} B · track ${details.trackReadyState}${details.trackMuted ? ' (muted)' : ''} · ctx ${details.audioContextState} · mic "${details.deviceLabel || 'desconocido'}"`,
  transcriptionErrorMessages: {
    invalidSampleRate: 'El audio capturado no está a la tasa que espera el modelo de voz.',
    modelLoadFailed: 'No fue posible descargar o inicializar el modelo de reconocimiento de voz.',
    transcriptionFailed: 'No fue posible transcribir el audio capturado.',
    workerUnavailable: 'El proceso de reconocimiento de voz dejó de responder inesperadamente.',
  },
  grammarCorrectionPanelLabel: 'Corrección gramatical',
  modelDisplayNames: {
    automaticSpeechRecognition: 'reconocimiento de voz',
    grammarCorrection: 'corrección gramatical',
    textToSpeech: 'síntesis de voz',
    textToSpeechVocoder: 'síntesis de voz',
    conversationSuggestions: 'sugerencias de conversación',
  },
  grammarCorrectionStatusMessages: {
    idle: 'Esperando la transcripción para corregir la gramática.',
    modelLoadingProgressMessage: (modelDisplayName: string, progressPercent: number) =>
      `Descargando el modelo de ${modelDisplayName}... ${progressPercent}%`,
    correcting: 'Corrigiendo gramática...',
    done: 'Corrección lista.',
    noCorrectionsNeeded:
      'No se encontraron correcciones: la oración ya es gramaticalmente correcta.',
  },
  grammarCorrectionErrorMessages: {
    modelLoadFailed: 'No fue posible descargar o inicializar el modelo de corrección gramatical.',
    correctionFailed: 'No fue posible corregir la gramática del texto transcrito.',
    workerUnavailable: 'El proceso de corrección gramatical dejó de responder inesperadamente.',
  },
} as const
