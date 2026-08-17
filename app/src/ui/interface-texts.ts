import type { AsrModelCandidateId } from '../ia/model-registry'
import { formatPronunciationScoreDetail } from './format-pronunciation-score-detail'

/**
 * All user-visible Spanish copy for the home screen.
 * Components must import strings from here — never hardcode product text in JSX.
 */
export const homeScreenInterfaceTexts = {
  applicationTitle: 'My Personal English Teacher',
  /** Short product mark for the rail. Visible name of the tutor product. */
  brandMarkLetter: 'T',
  brandShortName: 'Teacher',
  brandProductLine: 'inglés personal',
  asrDemoProfile: {
    precisionRailLabel: 'Perfil precisión · small-en',
    latencyRailLabel: 'Perfil latencia · tiny-en',
    precisionTitle:
      'Default de entrega (Whisper small-en). El presupuesto de 2 s es el tramo ASR + gramática, no el tutor.',
    latencyTitle:
      'Perfil latencia (Whisper tiny-en). No afirma < 2 s hasta re-medir en #asr-benchmark. El default de entrega sigue siendo small-en.',
  },
  applicationSubtitle:
    'Practica inglés sin conexión: pronunciación, gramática y conversación con inteligencia artificial que corre en tu propio navegador.',
  /** Shorter hero copy for product UX (subtitle kept for docs/PWA). */
  productLead:
    'Habla en inglés, recibe corrección y practica una conversación — todo en tu navegador.',
  projectPhaseBadgeLabel: 'Fase: Avance 2 — Conversación + señales (visual)',
  startMicrophoneButtonLabel: 'Hablar',
  listeningButtonLabel: 'Escuchando…',
  stopMicrophoneButtonLabel: 'Detener',
  micHelperHint:
    'Pulsa Hablar, di una frase en inglés y para al terminar (o espera el auto-corte al silencio).',
  tutorSpeakingHint: 'El tutor está hablando… espera a que termine para poder hablar tú.',
  modelsWarmingUpMessage:
    'Preparando los modelos de voz en segundo plano… La primera frase puede tardar un poco más.',
  practiceMockBanner:
    'Modo ensayo: no hay micrófono real ni modelos. Hablar/Detener no graba tu voz; cada parada inserta el mismo turno de ejemplo (restaurante). Para practicar de verdad, sal de este modo.',
  practiceMockExitLabel: 'Salir al micrófono real',
  practiceMockGateTitle: 'Esto no es el micrófono real',
  practiceMockGateBody:
    'Llegaste a una ruta de ensayo de interfaz. No se abre el micrófono y cada Detener inventa el mismo turno de restaurante. Si quieres practicar o probar la captura, entra a la práctica real.',
  practiceMockGateRealLabel: 'Ir a la práctica real',
  practiceMockGateEnterLabel: 'Entrar al ensayo (sin mic)',
  offlineReadiness: {
    noneCached:
      'Primera vez en este navegador: se descargarán más de 1 GB de modelos. Necesitas conexión ahora; después podrás practicar sin internet.',
    partiallyCached:
      'Algunos modelos ya están guardados en este navegador. Los que falten se descargarán la primera vez que se usen.',
    fullyCached:
      'Todos los modelos están guardados en este navegador. Ya puedes practicar sin conexión.',
  },
  /** Compact offline line for the rail footer. */
  offlineReadinessCompact: {
    noneCached: 'Pendiente de descarga',
    partiallyCached: 'Parcialmente listo',
    fullyCached: 'Listo sin conexión',
  },
  resultsSectionTitle: 'Tu turno',
  signalLabTitle: 'Laboratorio de señales (espectrograma, pitch, formantes)',
  technicalDetailsTitle: 'Detalles técnicos del pipeline',
  /** Atelier shell navigation and feedback panel (issue #81). */
  shell: {
    navPractice: 'Práctica',
    navHistory: 'Historial',
    navSignals: 'Señales',
    scenarioLabel: 'Escenario',
    modeLabel: 'Modo',
    modeConversation: 'Conversar',
    modeDrill: 'Repetir',
    modeDrillUnavailableTitle: 'El modo Repetir se activa en el issue de drill (#68).',
    centerSubtitle: 'Conversación guiada · responde en inglés',
    feedbackToggle: 'Feedback',
    feedbackPanelTitle: 'Feedback del turno',
    closePanelAria: 'Cerrar panel de feedback',
    backToPractice: 'Volver a práctica',
    historyOverlayTitle: 'Historial local',
    signalsOverlayTitle: 'Laboratorio de señales',
    signalsOverlayHint:
      'En vivo mientras hablas (STFT/YIN sobre PCM de una pista clonada). Al detener, la utterance completa.',
    tabTurn: 'Turno',
    tabSuggest: 'Sugerencias',
    tabSignals: 'Señales',
    tabTech: 'Técnico',
    emptyPanelTitle: 'Aún no hay turno',
    emptyPanelDescription:
      'Cuando hables, aquí verás transcripción, gramática, puntuación y palabras marcadas — como el panel de artefacto en un chat de escritorio.',
    suggestionsEmpty: 'Las sugerencias de comunicación aparecerán aquí tras un turno (issue #60).',
    suggestionsPlaceholderHint:
      'Por ahora el tutor responde en el chat; el panel dedicado de sugerencias es el siguiente paso de producto.',
    scoreBlockLabel: 'Pronunciación',
    breakdownTitle: 'Desglose',
    metricMfcc: 'MFCC',
    metricPitch: 'Pitch',
    metricEnergy: 'Energía',
    metricFormants: 'Formantes',
    metricUnavailable: '—',
    techMicLabel: 'Mic',
    techAsrLabel: 'ASR',
    techGrammarLabel: 'Gramática',
    techTutorLabel: 'Tutor',
    techTtsLabel: 'TTS',
    techScoreLabel: 'Score',
    techAsrValue: 'whisper-small.en',
    techGrammarValue: 'T5 · WASM',
    techTutorValue: 'SmolLM2 + reglas',
    techTtsValue: 'SpeechT5',
    techScoreValue: 'MFCC · YIN · DTW',
    techMicInactive: 'inactivo',
    techMicListening: 'escuchando',
    techMicStarting: 'iniciando',
    techMicStopped: 'detenido',
    noCaptureYet: 'Sin captura.',
    processingPipelineLabel: 'Procesando…',
  },
  inputLevelHintSilentShort: 'Casi no llega señal',
  inputLevelHintActiveShort: 'Señal OK — habla con naturalidad',
  liveMetersDetail: (rms: number, peak: number) =>
    `Medidores en vivo: RMS ${rms.toFixed(4)} · pico ${peak.toFixed(4)}`,
  practiceScenarios: {
    sectionTitle: '1. Elige un escenario',
    sectionHint:
      'Luego pulsa Hablar y responde en inglés sobre el escenario. El tutor reacciona a lo que dices.',
    sectionAriaLabel: 'Selector de escenario de práctica',
    lockedWhileListening: 'No puedes cambiar de escenario mientras el micrófono está activo.',
    byId: {
      restaurant: {
        title: 'Restaurante',
        description: 'Pedir comida o bebida con un camarero.',
      },
      airport: {
        title: 'Aeropuerto',
        description: 'Hablar en el mostrador de la aerolínea.',
      },
      'job-interview': {
        title: 'Entrevista de trabajo',
        description: 'Presentarte y responder al entrevistador.',
      },
    },
  },
  practiceChat: {
    sectionTitle: '2. Conversación',
    sectionAriaLabel: 'Historial de la conversación de práctica',
    turnHintLabel: 'Pista',
    userRoleLabel: 'Tú',
    tutorRoleLabel: 'Tutor',
    generatedBadge: 'SmolLM2',
    fallbackBadge: 'respuesta de respaldo del escenario',
    grammarCorrectionInlineLabel: 'Mejor gramática',
    tutorTypingLabel: 'Escribiendo…',
  },
  tutorGeneration: {
    panelLabel: 'Respuesta del tutor',
    statusIdle:
      'El tutor sigue un guion del escenario (rápido y coherente) y te responde en inglés.',
    statusPreparingModel: (progressPercent: number) =>
      `Preparando tutor conversacional… ${progressPercent}%`,
    statusGenerating: 'El tutor está escribiendo…',
    statusDoneGenerated: 'Respuesta del tutor lista (generada por IA).',
    statusDoneFallback: 'Respuesta del tutor (línea de respaldo del escenario).',
    statusError: 'No se pudo preparar la respuesta del tutor.',
  },
  statusFieldLabel: 'Estado',
  microphoneStatusMessages: {
    idle: 'Esperando interacción...',
    starting: 'Solicitando acceso al micrófono...',
    listening:
      'Escuchando… habla en inglés; al callarte ~1 s se detiene sola (VAD por energía). También puedes pulsar Detener.',
    stopped: 'Captura detenida.',
    permissionDenied:
      'Permiso de micrófono denegado. Habilítalo en la configuración del navegador para poder practicar.',
    genericError: 'No fue posible acceder al micrófono por un error inesperado.',
    detailedError: (detail: string) => `No fue posible acceder al micrófono. Detalle: ${detail}`,
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
    noAudioDegenerate: (previewText: string) =>
      `El motor de voz produjo texto inválido (alucinación), no una frase en inglés. Vista previa: "${previewText}…". Recarga la página y vuelve a intentar hablando claro 3–5 s en inglés. Si se repite, borra los datos del sitio en Chrome (caché de modelos) y recarga.`,
    noAudioCaptured:
      'No se reconoció habla clara en inglés. Habla cerca del micrófono (comprueba que Windows use el micrófono correcto y que no esté silenciado) e inténtalo de nuevo.',
    modelLoadingProgressMessage: (progressPercent: number, approxDownloadMb: number) =>
      `Preparando reconocimiento de voz (~${approxDownloadMb} MB, solo la primera vez; luego queda en caché del navegador)... ${progressPercent}%`,
    transcribing: 'Transcribiendo audio (modelo ya cargado)...',
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
  asrCandidateDisplayNames: {
    'tiny-en': 'Whisper tiny (inglés, rápido)',
    'base-en': 'Whisper base (inglés)',
    'distil-small-en': 'Distil-Whisper small (inglés)',
    'small-en': 'Whisper small (inglés, más preciso)',
  } satisfies Record<AsrModelCandidateId, string>,
  grammarCorrectionStatusMessages: {
    idle: 'Esperando la transcripción para corregir la gramática.',
    modelLoadingProgressMessage: (modelDisplayName: string, progressPercent: number) =>
      `Preparando ${modelDisplayName} (solo la primera vez o al actualizar el modelo)... ${progressPercent}%`,
    correcting: 'Corrigiendo gramática (modelo ya cargado)...',
    done: 'Corrección lista.',
    noCorrectionsNeeded:
      'No se encontraron correcciones: la oración ya es gramaticalmente correcta.',
  },
  grammarCorrectionDiff: {
    hint: 'Verde = palabra añadida · rojo = palabra eliminada · ámbar = palabra sustituida.',
    legendAdded: 'Añadido',
    legendRemoved: 'Eliminado',
    legendSubstituted: 'Sustituido',
  },
  grammarCorrectionErrorMessages: {
    modelLoadFailed: 'No fue posible descargar o inicializar el modelo de corrección gramatical.',
    correctionFailed: 'No fue posible corregir la gramática del texto transcrito.',
    workerUnavailable: 'El proceso de corrección gramatical dejó de responder inesperadamente.',
  },
  speechSynthesisPanelLabel: 'Voz del tutor (TTS)',
  speechSynthesisStatusMessages: {
    idle: 'La voz del tutor se genera la primera vez que hay una respuesta para reproducir.',
    modelLoadingProgressMessage: (modelDisplayName: string, progressPercent: number) =>
      `Preparando ${modelDisplayName} (solo la primera vez)... ${progressPercent}%`,
    synthesizing: 'Generando voz del tutor...',
    playing: 'Reproduciendo la respuesta del tutor...',
    done: 'Reproducción de la voz del tutor lista.',
  },
  speechSynthesisErrorMessages: {
    modelLoadFailed: 'No fue posible descargar o inicializar el modelo de síntesis de voz.',
    synthesisFailed: 'No fue posible generar el audio de la respuesta del tutor.',
    emptyText: 'No hay texto para sintetizar en voz.',
    workerUnavailable: 'El proceso de síntesis de voz dejó de responder inesperadamente.',
  },
  liveWaveformLabel: 'Onda en vivo (tiempo)',
  spectrogramPanelLabel: 'Espectrograma STFT (en vivo y última utterance)',
  spectrogramPanelHint:
    'STFT propia (radix-2), no el FFT del Analyser. En vivo mientras hablas; al detener, la utterance completa.',
  pitchTrackPanelLabel: 'Pitch YIN (en vivo y última utterance)',
  pitchTrackPanelHint:
    'YIN propio ~70–400 Hz sobre PCM real. En vivo mientras hablas; al detener, el contorno completo.',
  formantsPanelLabel: 'Formantes (LPC, mediana de la utterance)',
  formantsPanelHint:
    'F1/F2/F3 estimados por envolvente LPC + picos; útiles para vocales (aproximación educativa).',
  formantsUnavailable: 'Sin formantes fiables (silencio o frames inestables).',
  formantsSummary: (f1: string, f2: string, f3: string) =>
    `F1 ≈ ${f1} Hz · F2 ≈ ${f2} Hz · F3 ≈ ${f3} Hz`,
  practiceHistory: {
    sectionTitle: 'Historial local (IndexedDB)',
    sectionAriaLabel: 'Historial de turnos de práctica guardados en el navegador',
    emptyState: 'Aún no hay turnos guardados en este navegador.',
    statusReady: 'Progreso guardado solo en este dispositivo (sin audio crudo).',
    statusUnavailable: 'IndexedDB no disponible; la práctica sigue, pero no se guarda historial.',
    statusError: 'No se pudo leer o escribir el historial local.',
    youLabel: 'Tú',
    tutorLabel: 'Tutor',
    scenarioLabel: (scenarioId: string) => {
      switch (scenarioId) {
        case 'restaurant':
          return 'Restaurante'
        case 'airport':
          return 'Aeropuerto'
        case 'job-interview':
          return 'Entrevista'
        default:
          return scenarioId
      }
    },
    formatTime: (iso: string) => {
      try {
        return new Date(iso).toLocaleString('es', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      } catch {
        return iso
      }
    },
    scoreLabel: (score: number | null) =>
      score === null ? 'Sin score' : `Score ${score.toFixed(1)}`,
    trendSectionLabel: 'Tendencia de pronunciación',
    averageScoreLabel: (average: number | null) =>
      average === null
        ? 'Aún no hay suficientes turnos con puntuación para calcular un promedio.'
        : `Promedio de la sesión: ${average.toFixed(1)} / 100`,
    trendBarTooltip: (turnIndex: number, score: number) =>
      `Turno ${turnIndex}: ${score.toFixed(1)} / 100`,
  },
  pronunciationPanelLabel: 'Pronunciación (señales)',
  communicationSuggestions: {
    panelTitle: 'Sugerencias para comunicarte mejor',
    panelHint: 'Ideas offline para sonar más natural — no reemplazan al tutor.',
    typeLabels: {
      vocabulario: 'Vocabulario',
      fluidez: 'Fluidez',
      naturalidad: 'Naturalidad',
    },
  },
  pronunciationWordHighlights: {
    title: 'Palabras (aproximación por alineamiento DTW)',
    hint: 'Verde ≈ cerca de la referencia · ámbar ≈ regular · rojo ≈ más lejos. No es alineamiento fonético perfecto.',
    legendGood: 'Bien',
    legendMedium: 'Regular',
    legendPoor: 'Revisar',
    wordTooltip: (score0to100: number, band: string) =>
      `Puntuación local ${score0to100.toFixed(1)} / 100 (${band})`,
  },
  pronunciationStatusMessages: {
    idle: 'En conversación no hay 0–100 contra el TTS (el locutor sintético mueve el score tanto o más que un error de vocal). El 0–100 está en modo Repetir.',
    scoring: 'Calculando puntuación de pronunciación (MFCC / pitch / energía / formantes)...',
    done: (score0to100: number) =>
      `Puntuación de pronunciación: ${score0to100.toFixed(1)} / 100 (mayor = más cerca de la referencia).`,
    unavailable: 'No se pudo calcular la puntuación de pronunciación para este turno.',
    notEvaluated:
      'No se evaluó la pronunciación: no hubo habla clara en inglés. No es una mala nota. Intenta de nuevo más cerca del micrófono y con más volumen.',
    deferredToDrill:
      'No hay 0–100 en este turno de conversación: cambiar de locutor sintético (120→210 Hz) mueve ~11.3 puntos y pronunciar otras vocales ~9.9 (ratio 1.14). No es que lo hayas dicho mal. Practica la frase del tutor en Repetir.',
    detail: (details: {
      mfccScore: number
      pitchScore: number | null
      energyScore: number | null
      formantScore: number | null
      userFrames: number
      referenceFrames: number
    }) => formatPronunciationScoreDetail(details),
  },
  drill: {
    panelTitle: 'Repetir la última frase del tutor',
    panelHint: 'Practica repitiendo exactamente lo que dijo el tutor y recibe tu puntuación.',
    repeatButtonLabel: 'Repetir esta frase',
    listeningButtonLabel: 'Escuchando…',
    noTutorLineMessage: 'Todavía no hay ninguna frase del tutor para repetir.',
    statusIdle: 'Pulsa "Repetir esta frase" para practicar la última línea del tutor.',
    statusListening: 'Escuchando tu repetición… habla y pulsa Detener al terminar.',
    statusScoring: 'Calculando tu puntuación de repetición…',
    statusDone: (score0to100: number) =>
      `Puntuación de repetición: ${score0to100.toFixed(1)} / 100.`,
    statusUnavailable: 'No se pudo calcular la puntuación de esta repetición.',
    stopButtonLabel: 'Detener',
  },
  asrBenchmark: {
    pageTitle: 'Banco de pruebas ASR (solo desarrollo)',
    pageHint:
      'Graba fixtures de referencia, corre modelos × backend y compara WER y latencia antes de fijar el modelo de producción.',
    fixturesSectionTitle: 'Fixtures de referencia',
    fixtureReferenceTextLabel: 'Texto de referencia (inglés)',
    fixtureReferenceTextPlaceholder: 'Ej: Where is gate B10?',
    recordFixtureButtonLabel: 'Grabar fixture',
    recordingFixtureButtonLabel: 'Grabando… pulsa para detener',
    saveFixtureButtonLabel: 'Guardar fixture',
    deleteFixtureButtonLabel: 'Borrar',
    noFixturesMessage: 'Aún no hay fixtures grabados en este navegador.',
    microphoneErrorMessage: 'No se pudo acceder al micrófono. Revisa el permiso del navegador.',
    fixtureDraftErrorMessages: {
      missingReferenceText: 'Escribe el texto de referencia en inglés antes de guardar.',
      emptyRecording: 'La grabación salió vacía. Vuelve a grabar la frase.',
      tooShort: 'La grabación es demasiado corta para ser un fixture útil (mínimo 0.5 s).',
      tooLong: 'La grabación es demasiado larga para un fixture (máximo 30 s).',
    },
    runSectionTitle: 'Corrida',
    candidatesLabel: 'Modelos a evaluar',
    devicesLabel: 'Backends a evaluar',
    deviceLabels: {
      wasm: 'WASM (q8)',
      webgpu: 'WebGPU (fp32)',
    },
    runBenchmarkButtonLabel: 'Correr benchmark',
    runningBenchmarkLabel: (current: number, total: number) => `Corriendo ${current} / ${total}…`,
    resultsSectionTitle: 'Resultados',
    noResultsMessage: 'Corre el benchmark para ver la tabla comparativa.',
    resultsTableHeaders: {
      candidate: 'Modelo',
      device: 'Backend',
      fixtureCount: 'Fixtures',
      averageWer: 'WER promedio',
      averageLatency: 'Latencia media (ms)',
      modelLoad: 'Carga inicial (ms)',
    },
    exportFixturesJsonButtonLabel: 'Exportar fixtures (JSON)',
    importFixturesJsonButtonLabel: 'Importar fixtures (JSON)',
    exportResultsJsonButtonLabel: 'Exportar resultados (JSON)',
    exportResultsCsvButtonLabel: 'Exportar resultados (CSV)',
    storageUnavailableMessage:
      'IndexedDB no disponible: no se pueden guardar fixtures en este navegador.',
    importErrorMessage:
      'No se pudo importar el archivo: revisa que sea un export de fixtures válido.',
  },
} as const
