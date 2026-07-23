import { useCallback, useEffect, useRef, useState } from 'react'
import { MicrophoneCaptureError, startMicrophoneCapture } from './audio/microphone-capture'
import type { MicrophoneCaptureSession } from './audio/microphone-capture'
import { concatenateAudioFrames } from './audio/audio-frame-buffer'
import { resampleToWhisperRate } from './audio/audio-resampler'
import { computeRootMeanSquareEnergy } from './dsp/signal-energy'
import { createInferenceClient, InferenceClientError } from './ia/inference-client'
import type { InferenceClient, InferenceClientErrorReason } from './ia/inference-client'
import { grammarCorrectionMadeNoChanges } from './ia/grammar-correction'
import { homeScreenInterfaceTexts } from './ui/interface-texts'

/**
 * Estados posibles de la captura de micrófono desde el punto de vista de la
 * interfaz. Cada uno tiene un mensaje propio en
 * `homeScreenInterfaceTexts.microphoneStatusMessages`. `'starting'` cubre la
 * espera de `startMicrophoneCapture()` (incluye el tiempo que el navegador
 * tarda en mostrar y resolver el diálogo de permiso).
 */
type MicrophoneUiStatus =
  'idle' | 'starting' | 'listening' | 'stopped' | 'permission-denied' | 'error'

/**
 * Estados posibles de la transcripción (ASR) desde el punto de vista de la
 * interfaz, independientes del estado del micrófono: la transcripción sigue
 * corriendo en el worker después de que la captura ya se detuvo.
 *
 * - `'idle'`: todavía no se detuvo ninguna captura con audio para transcribir.
 * - `'no-audio'`: la captura se detuvo pero no llegó ninguna muestra útil.
 * - `'loading-model'`: el worker está descargando el modelo de Whisper (solo
 *   ocurre en el primer uso; los siguientes reutilizan el modelo en caché).
 * - `'transcribing'`: el modelo ya está listo y la inferencia está en curso.
 * - `'done'`: la transcripción terminó con éxito (ver `transcribedText`).
 * - `'error'`: la transcripción falló (ver `transcriptionErrorReason`).
 */
type TranscriptionUiStatus =
  | 'idle'
  | 'no-audio'
  | 'loading-model'
  | 'transcribing'
  | 'done'
  | 'error'

/**
 * Estados posibles de la corrección gramatical (segunda etapa del pipeline,
 * post-ASR) desde el punto de vista de la interfaz. Mismo espíritu que
 * `TranscriptionUiStatus`, encadenado automáticamente después de una
 * transcripción exitosa (ver `correctTranscribedGrammar`).
 *
 * - `'idle'`: todavía no hay texto transcrito para corregir.
 * - `'loading-model'`: el worker está descargando el modelo T5 de corrección
 *   gramatical (solo ocurre en el primer uso).
 * - `'correcting-grammar'`: el modelo ya está listo y la corrección está en
 *   curso.
 * - `'done'`: la corrección terminó con éxito (ver `correctedGrammarText`).
 * - `'error'`: la corrección falló (ver `grammarCorrectionErrorReason`); la
 *   transcripción ya mostrada NO se borra por este error.
 */
type GrammarCorrectionUiStatus = 'idle' | 'loading-model' | 'correcting-grammar' | 'done' | 'error'

const WAVEFORM_BACKGROUND_COLOR = '#1e1e1e'
const WAVEFORM_LINE_COLOR = '#2ecc71'
/**
 * Umbral de energía RMS por debajo del cual la captura se considera silencio
 * (mic mudo, AudioContext sin correr, o el usuario no habló). Por debajo de
 * este valor no tiene sentido mandar el audio a Whisper: solo gasta tiempo de
 * descarga/inferencia y devuelve basura tipo "[Music]" o vacío.
 */
const MINIMUM_CAPTURE_ENERGY_RMS = 0.001

/**
 * Traduce el estado de captura al mensaje de estado que debe mostrarse,
 * usando exclusivamente los textos centralizados en `ui/interface-texts.ts`.
 */
function microphoneStatusMessageFor(status: MicrophoneUiStatus): string {
  switch (status) {
    case 'idle':
      return homeScreenInterfaceTexts.microphoneStatusMessages.idle
    case 'starting':
      return homeScreenInterfaceTexts.microphoneStatusMessages.starting
    case 'listening':
      return homeScreenInterfaceTexts.microphoneStatusMessages.listening
    case 'stopped':
      return homeScreenInterfaceTexts.microphoneStatusMessages.stopped
    case 'permission-denied':
      return homeScreenInterfaceTexts.microphoneStatusMessages.permissionDenied
    case 'error':
      return homeScreenInterfaceTexts.microphoneStatusMessages.genericError
  }
}

/**
 * Traduce un motivo de error de transcripción (`InferenceClientErrorReason`)
 * al mensaje correspondiente en `ui/interface-texts.ts`. `null` cubre el caso
 * defensivo en el que el estado es `'error'` pero, por algún motivo, no se
 * registró un motivo tipado; `'correction-failed'` también cae en ese mismo
 * mensaje defensivo, porque no debería surgir nunca de una solicitud de
 * transcripción (solo de una de corrección gramatical).
 */
function transcriptionErrorMessageFor(reason: InferenceClientErrorReason | null): string {
  switch (reason) {
    case 'invalid-sample-rate':
      return homeScreenInterfaceTexts.transcriptionErrorMessages.invalidSampleRate
    case 'model-load-failed':
      return homeScreenInterfaceTexts.transcriptionErrorMessages.modelLoadFailed
    case 'transcription-failed':
      return homeScreenInterfaceTexts.transcriptionErrorMessages.transcriptionFailed
    case 'worker-unavailable':
      return homeScreenInterfaceTexts.transcriptionErrorMessages.workerUnavailable
    case 'correction-failed':
    case null:
      return homeScreenInterfaceTexts.transcriptionErrorMessages.transcriptionFailed
  }
}

/**
 * Traduce el estado de transcripción al mensaje que debe mostrarse en el
 * panel de transcripción.
 */
function transcriptionStatusMessageFor(
  status: TranscriptionUiStatus,
  modelLoadingProgressPercent: number,
  transcriptionErrorReason: InferenceClientErrorReason | null,
): string {
  switch (status) {
    case 'idle':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.idle
    case 'no-audio':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.noAudioCaptured
    case 'loading-model':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.modelLoadingProgressMessage(
        modelLoadingProgressPercent,
      )
    case 'transcribing':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.transcribing
    case 'done':
      return homeScreenInterfaceTexts.transcriptionStatusMessages.done
    case 'error':
      return transcriptionErrorMessageFor(transcriptionErrorReason)
  }
}

/**
 * Traduce un motivo de error de corrección gramatical
 * (`InferenceClientErrorReason`) al mensaje correspondiente en
 * `ui/interface-texts.ts`. `'invalid-sample-rate'`, `'transcription-failed'`
 * y `null` caen en el mismo mensaje defensivo genérico: los dos primeros no
 * deberían surgir nunca de una solicitud de corrección gramatical (solo de
 * una de transcripción).
 */
function grammarCorrectionErrorMessageFor(reason: InferenceClientErrorReason | null): string {
  switch (reason) {
    case 'model-load-failed':
      return homeScreenInterfaceTexts.grammarCorrectionErrorMessages.modelLoadFailed
    case 'correction-failed':
      return homeScreenInterfaceTexts.grammarCorrectionErrorMessages.correctionFailed
    case 'worker-unavailable':
      return homeScreenInterfaceTexts.grammarCorrectionErrorMessages.workerUnavailable
    case 'invalid-sample-rate':
    case 'transcription-failed':
    case null:
      return homeScreenInterfaceTexts.grammarCorrectionErrorMessages.correctionFailed
  }
}

/**
 * Traduce el estado de corrección gramatical al mensaje que debe mostrarse
 * en el panel de gramática. El mensaje de descarga de modelo interpola el
 * nombre legible del modelo T5 (`homeScreenInterfaceTexts.modelDisplayNames`)
 * para que quede claro qué se está descargando, distinto del modelo de ASR.
 */
function grammarCorrectionStatusMessageFor(
  status: GrammarCorrectionUiStatus,
  modelLoadingProgressPercent: number,
  grammarCorrectionErrorReason: InferenceClientErrorReason | null,
): string {
  switch (status) {
    case 'idle':
      return homeScreenInterfaceTexts.grammarCorrectionStatusMessages.idle
    case 'loading-model':
      return homeScreenInterfaceTexts.grammarCorrectionStatusMessages.modelLoadingProgressMessage(
        homeScreenInterfaceTexts.modelDisplayNames.grammarCorrection,
        modelLoadingProgressPercent,
      )
    case 'correcting-grammar':
      return homeScreenInterfaceTexts.grammarCorrectionStatusMessages.correcting
    case 'done':
      return homeScreenInterfaceTexts.grammarCorrectionStatusMessages.done
    case 'error':
      return grammarCorrectionErrorMessageFor(grammarCorrectionErrorReason)
  }
}

export function App() {
  const [microphoneStatus, setMicrophoneStatus] = useState<MicrophoneUiStatus>('idle')
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionUiStatus>('idle')
  const [modelLoadingProgressPercent, setModelLoadingProgressPercent] = useState(0)
  const [transcribedText, setTranscribedText] = useState('')
  const [transcriptionErrorReason, setTranscriptionErrorReason] =
    useState<InferenceClientErrorReason | null>(null)
  const [grammarCorrectionStatus, setGrammarCorrectionStatus] =
    useState<GrammarCorrectionUiStatus>('idle')
  const [grammarModelLoadingProgressPercent, setGrammarModelLoadingProgressPercent] = useState(0)
  const [correctedGrammarText, setCorrectedGrammarText] = useState('')
  const [grammarCorrectionErrorReason, setGrammarCorrectionErrorReason] =
    useState<InferenceClientErrorReason | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const captureSessionRef = useRef<MicrophoneCaptureSession | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  /**
   * Frames crudos de audio (mono, tasa nativa) acumulados mientras dura la
   * captura activa, vía `subscribeToAudioFrames`. Al detener la captura se
   * concatenan (`concatenateAudioFrames`) y se resamplean a 16 kHz
   * (`resampleToWhisperRate`) para transcribirlos.
   */
  const audioFramesRef = useRef<Float32Array[]>([])
  /**
   * Cliente del worker de inferencia, creado perezosamente recién en la
   * primera transcripción (ver `transcribeCapturedAudio`) y liberado al
   * desmontar el componente.
   */
  const inferenceClientRef = useRef<InferenceClient | null>(null)
  /**
   * Contador de generación del intento de arranque en curso. Se incrementa
   * tanto al iniciar un nuevo intento como al detener la captura (incluido el
   * cleanup de desmontaje). Cuando el `await startMicrophoneCapture()` de un
   * intento se resuelve, compara su propia generación contra el valor actual
   * de esta ref: si cambió, significa que hubo un `stop()` (o un nuevo
   * intento) mientras se esperaba el permiso, así que la sesión que llega
   * tarde se cierra de inmediato en vez de adoptarse.
   */
  const captureAttemptGenerationRef = useRef(0)
  /**
   * Contador de generación de la transcripción en curso, con el mismo
   * espíritu que `captureAttemptGenerationRef`: si el usuario detiene una
   * segunda grabación antes de que la transcripción de la primera termine,
   * el resultado (o error) de la primera, que llega tarde, no debe pisar el
   * estado de la segunda. Se reutiliza también para la corrección gramatical
   * encadenada (ver `correctTranscribedGrammar`): ambas etapas pertenecen al
   * mismo intento de "post-utterance" (ASR → gramática, ver "Convenciones y
   * defaults técnicos" en el README raíz), así que comparten el mismo
   * contador de generación.
   */
  const transcriptionAttemptGenerationRef = useRef(0)

  const isStarting = microphoneStatus === 'starting'
  const isListening = microphoneStatus === 'listening'

  /**
   * Dibuja el waveform en el canvas leyendo, cuadro a cuadro, del
   * `analyserNode` de la sesión de captura activa. Es responsabilidad de la
   * capa de presentación: `audio/` solo entrega el `AnalyserNode`, nunca
   * dibuja nada.
   */
  const drawWaveform = useCallback(() => {
    const captureSession = captureSessionRef.current
    const canvas = canvasRef.current
    if (!captureSession || !canvas) {
      return
    }

    const canvasContext = canvas.getContext('2d')
    if (!canvasContext) {
      return
    }

    const { analyserNode } = captureSession
    const timeDomainBufferLength = analyserNode.frequencyBinCount
    const timeDomainData = new Uint8Array(timeDomainBufferLength)

    const renderFrame = () => {
      animationFrameRef.current = requestAnimationFrame(renderFrame)
      analyserNode.getByteTimeDomainData(timeDomainData)

      canvasContext.fillStyle = WAVEFORM_BACKGROUND_COLOR
      canvasContext.fillRect(0, 0, canvas.width, canvas.height)

      canvasContext.lineWidth = 2
      canvasContext.strokeStyle = WAVEFORM_LINE_COLOR
      canvasContext.beginPath()

      const sliceWidth = canvas.width / timeDomainBufferLength
      let xPosition = 0

      for (let sampleIndex = 0; sampleIndex < timeDomainBufferLength; sampleIndex += 1) {
        const normalizedValue = timeDomainData[sampleIndex] / 128.0
        const yPosition = (normalizedValue * canvas.height) / 2

        if (sampleIndex === 0) {
          canvasContext.moveTo(xPosition, yPosition)
        } else {
          canvasContext.lineTo(xPosition, yPosition)
        }

        xPosition += sliceWidth
      }

      canvasContext.lineTo(canvas.width, canvas.height / 2)
      canvasContext.stroke()
    }

    renderFrame()
  }, [])

  const clearWaveformCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const canvasContext = canvas?.getContext('2d')
    if (!canvas || !canvasContext) {
      return
    }

    canvasContext.fillStyle = WAVEFORM_BACKGROUND_COLOR
    canvasContext.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  /**
   * Detiene la sesión de captura activa (si la hay) y cancela cualquier
   * `requestAnimationFrame` pendiente. Es segura de llamar varias veces
   * seguidas (idempotente), incluyendo el doble montaje/desmontaje que
   * StrictMode hace en desarrollo.
   */
  const stopMicrophoneCapture = useCallback(() => {
    // Invalida cualquier intento de arranque pendiente: si su promesa se
    // resuelve después de esto, se detectará como "atrasado" y no se adoptará.
    captureAttemptGenerationRef.current += 1

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    captureSessionRef.current?.stop()
    captureSessionRef.current = null
  }, [])

  /**
   * Corrige la gramática de un texto ya transcrito (segunda etapa del
   * pipeline, encadenada automáticamente por `transcribeCapturedAudio` al
   * terminar la transcripción). `attemptGeneration` es la misma generación
   * de `transcriptionAttemptGenerationRef` capturada por quien llama, para
   * descartar un resultado (o error) que llega tarde de un intento ya
   * superado por uno más nuevo.
   *
   * Un error en esta etapa NO afecta el estado de la transcripción: el texto
   * transcrito y su panel permanecen intactos, y el error se muestra
   * únicamente en el panel de gramática.
   */
  const correctTranscribedGrammar = useCallback(
    async (transcribedTextResult: string, attemptGeneration: number) => {
      if (!transcribedTextResult.trim() || !inferenceClientRef.current) {
        setGrammarCorrectionStatus('idle')
        return
      }

      setGrammarCorrectionStatus('correcting-grammar')
      setGrammarCorrectionErrorReason(null)

      try {
        const correctedText = await inferenceClientRef.current.correctGrammar(transcribedTextResult)
        if (attemptGeneration !== transcriptionAttemptGenerationRef.current) {
          return
        }
        setCorrectedGrammarText(correctedText)
        setGrammarCorrectionStatus('done')
      } catch (error) {
        if (attemptGeneration !== transcriptionAttemptGenerationRef.current) {
          return
        }
        const reason = error instanceof InferenceClientError ? error.reason : 'worker-unavailable'
        setGrammarCorrectionErrorReason(reason)
        setGrammarCorrectionStatus('error')
        console.error(error)
      }
    },
    [],
  )

  /**
   * Transcribe el audio acumulado durante la última captura: lo concatena,
   * lo resamplea a 16 kHz (la tasa que exige Whisper) y lo manda al worker de
   * inferencia a través de `InferenceClient.transcribe`. El cliente de
   * inferencia se crea perezosamente en la primera llamada. Al terminar con
   * éxito, encadena automáticamente la corrección gramatical
   * (`correctTranscribedGrammar`), siguiendo el flujo post-utterance del
   * curso (ASR → gramática).
   *
   * Mientras un modelo se descarga (primer uso), el estado de esa etapa
   * pasa a `'loading-model'` con el progreso de descarga. Cuando el worker
   * termina de cargar el modelo emite `'model-ready'` y la UI vuelve a
   * `'transcribing'` / `'correcting-grammar'` para la inferencia propiamente
   * dicha (ver `subscribeToModelReady` más abajo).
   */
  const transcribeCapturedAudio = useCallback(
    async (frames: Float32Array[], nativeSampleRate: number) => {
      const concatenatedSamples = concatenateAudioFrames(frames)
      const captureEnergyRms = computeRootMeanSquareEnergy(concatenatedSamples)
      if (concatenatedSamples.length === 0 || captureEnergyRms < MINIMUM_CAPTURE_ENERGY_RMS) {
        // Sin muestras o solo silencio (p. ej. AudioContext suspendido antes
        // del fix de resume, mic mudo, o el usuario no habló). No se llama al
        // worker: el mensaje de idle "Detén el micrófono..." ya no aplica.
        setTranscriptionStatus('no-audio')
        setTranscribedText('')
        setTranscriptionErrorReason(null)
        setGrammarCorrectionStatus('idle')
        setCorrectedGrammarText('')
        setGrammarCorrectionErrorReason(null)
        return
      }
      const samples16kHz = resampleToWhisperRate(concatenatedSamples, nativeSampleRate)

      if (!inferenceClientRef.current) {
        const inferenceClient = createInferenceClient()
        inferenceClient.subscribeToModelLoadingProgress((progressMessage) => {
          if (progressMessage.modelKey === 'automaticSpeechRecognition') {
            setTranscriptionStatus('loading-model')
            setModelLoadingProgressPercent(progressMessage.progressPercent)
          } else if (progressMessage.modelKey === 'grammarCorrection') {
            setGrammarCorrectionStatus('loading-model')
            setGrammarModelLoadingProgressPercent(progressMessage.progressPercent)
          }
        })
        // Cuando el worker termina de cargar un modelo, sale de
        // "Descargando... X%" y muestra el estado de inferencia activo.
        // Sin este aviso, la UI se queda en "Descargando... 100%" durante
        // todo el tramo de inferencia (limitación que antes se aceptaba
        // como suficiente para el prototipo).
        inferenceClient.subscribeToModelReady((readyMessage) => {
          // Solo se actualiza si la UI sigue en 'loading-model': evita pisar
          // un 'done'/'error' de un intento más reciente si el aviso de
          // "modelo listo" llega tarde (modelos cacheados o generación nueva).
          if (readyMessage.modelKey === 'automaticSpeechRecognition') {
            setTranscriptionStatus((currentStatus) =>
              currentStatus === 'loading-model' ? 'transcribing' : currentStatus,
            )
          } else if (readyMessage.modelKey === 'grammarCorrection') {
            setGrammarCorrectionStatus((currentStatus) =>
              currentStatus === 'loading-model' ? 'correcting-grammar' : currentStatus,
            )
          }
        })
        inferenceClientRef.current = inferenceClient
      }

      const attemptGeneration = (transcriptionAttemptGenerationRef.current += 1)
      setTranscriptionStatus('transcribing')
      setTranscriptionErrorReason(null)
      setGrammarCorrectionStatus('idle')
      setGrammarCorrectionErrorReason(null)
      setCorrectedGrammarText('')

      try {
        const transcribedTextResult = await inferenceClientRef.current.transcribe(samples16kHz)
        if (attemptGeneration !== transcriptionAttemptGenerationRef.current) {
          return
        }
        setTranscribedText(transcribedTextResult)
        setTranscriptionStatus('done')
        void correctTranscribedGrammar(transcribedTextResult, attemptGeneration)
      } catch (error) {
        if (attemptGeneration !== transcriptionAttemptGenerationRef.current) {
          return
        }
        const reason = error instanceof InferenceClientError ? error.reason : 'worker-unavailable'
        setTranscriptionErrorReason(reason)
        setTranscriptionStatus('error')
        console.error(error)
      }
    },
    [correctTranscribedGrammar],
  )

  const handleStartButtonClick = useCallback(async () => {
    const attemptGeneration = (captureAttemptGenerationRef.current += 1)
    setMicrophoneStatus('starting')
    setTranscriptionStatus('idle')
    setTranscribedText('')
    setTranscriptionErrorReason(null)
    setModelLoadingProgressPercent(0)
    setGrammarCorrectionStatus('idle')
    setCorrectedGrammarText('')
    setGrammarCorrectionErrorReason(null)
    setGrammarModelLoadingProgressPercent(0)

    try {
      const captureSession = await startMicrophoneCapture()

      if (attemptGeneration !== captureAttemptGenerationRef.current) {
        // Este intento llegó tarde: hubo un stop() (detener o desmontaje) o
        // un intento de arranque más nuevo mientras se esperaba el permiso.
        // No se adopta la sesión: se cierra de inmediato para no filtrar el
        // micrófono ni el AudioContext.
        captureSession.stop()
        return
      }

      captureSessionRef.current = captureSession
      audioFramesRef.current = []
      captureSession.subscribeToAudioFrames((frame) => {
        audioFramesRef.current.push(frame)
      })

      setMicrophoneStatus('listening')
      drawWaveform()
    } catch (error) {
      if (attemptGeneration !== captureAttemptGenerationRef.current) {
        return
      }

      const isPermissionDenied =
        error instanceof MicrophoneCaptureError && error.reason === 'permission-denied'
      setMicrophoneStatus(isPermissionDenied ? 'permission-denied' : 'error')
      console.error(error)
    }
  }, [drawWaveform])

  const handleStopButtonClick = useCallback(() => {
    const nativeSampleRate = captureSessionRef.current?.nativeSampleRate
    const capturedFrames = audioFramesRef.current

    stopMicrophoneCapture()
    clearWaveformCanvas()
    setMicrophoneStatus('stopped')

    if (nativeSampleRate !== undefined) {
      void transcribeCapturedAudio(capturedFrames, nativeSampleRate)
    }
  }, [stopMicrophoneCapture, clearWaveformCanvas, transcribeCapturedAudio])

  // Cleanup al desmontar el componente: detiene la sesión de captura y
  // cancela el rAF pendiente, evitando fugas si el usuario navega fuera
  // mientras el micrófono sigue activo.
  useEffect(() => {
    return () => {
      stopMicrophoneCapture()
    }
  }, [stopMicrophoneCapture])

  // Cleanup al desmontar el componente: libera el worker de inferencia (si
  // llegó a crearse) para no dejarlo corriendo en segundo plano.
  useEffect(() => {
    return () => {
      inferenceClientRef.current?.dispose()
      inferenceClientRef.current = null
    }
  }, [])

  const microphoneStatusMessage = microphoneStatusMessageFor(microphoneStatus)
  const transcriptionStatusMessage = transcriptionStatusMessageFor(
    transcriptionStatus,
    modelLoadingProgressPercent,
    transcriptionErrorReason,
  )
  const grammarCorrectionStatusMessage = grammarCorrectionStatusMessageFor(
    grammarCorrectionStatus,
    grammarModelLoadingProgressPercent,
    grammarCorrectionErrorReason,
  )
  /**
   * Solo tiene sentido mostrar el mensaje de "sin correcciones necesarias"
   * cuando la corrección terminó con éxito: si todavía está en curso, falló,
   * o no hay transcripción, no hay nada que comparar todavía.
   */
  const grammarCorrectionMadeNoChangesToTranscription =
    grammarCorrectionStatus === 'done' &&
    grammarCorrectionMadeNoChanges(transcribedText, correctedGrammarText)

  return (
    <div className="mx-auto my-10 max-w-2xl px-5 text-center font-sans">
      <span className="rounded-2xl bg-indigo-100 px-3 py-1 text-sm text-indigo-800">
        {homeScreenInterfaceTexts.projectPhaseBadgeLabel}
      </span>

      <h1 className="mt-4 text-3xl font-bold text-slate-800">
        {homeScreenInterfaceTexts.applicationTitle}
      </h1>
      <p className="text-slate-500">{homeScreenInterfaceTexts.applicationSubtitle}</p>

      <div className="my-6">
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          className="h-[150px] w-full rounded-lg bg-[#1e1e1e]"
        />
      </div>

      <div className="my-6 flex justify-center gap-4">
        <button
          type="button"
          onClick={handleStartButtonClick}
          disabled={isStarting || isListening}
          className="min-w-[200px] justify-center rounded-lg bg-green-800 px-6 py-3 text-base font-bold text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-300 disabled:opacity-70"
        >
          {homeScreenInterfaceTexts.startMicrophoneButtonLabel}
        </button>
        <button
          type="button"
          onClick={handleStopButtonClick}
          disabled={!isListening}
          className="min-w-[200px] justify-center rounded-lg bg-red-700 px-6 py-3 text-base font-bold text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-300 disabled:opacity-70"
        >
          {homeScreenInterfaceTexts.stopMicrophoneButtonLabel}
        </button>
      </div>

      <div className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        <strong>{homeScreenInterfaceTexts.statusFieldLabel}:</strong> {microphoneStatusMessage}
      </div>

      <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        <strong>{homeScreenInterfaceTexts.transcriptionPanelLabel}:</strong>{' '}
        {transcriptionStatusMessage}
        {transcribedText && (
          <p className="mt-2 rounded-md bg-white p-2 text-left font-mono text-slate-900">
            {transcribedText}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        <strong>{homeScreenInterfaceTexts.grammarCorrectionPanelLabel}:</strong>{' '}
        {grammarCorrectionStatusMessage}
        {correctedGrammarText && (
          <p className="mt-2 rounded-md bg-white p-2 text-left font-mono text-slate-900">
            {correctedGrammarText}
          </p>
        )}
        {grammarCorrectionMadeNoChangesToTranscription && (
          <p className="mt-2 text-slate-500 italic">
            {homeScreenInterfaceTexts.grammarCorrectionStatusMessages.noCorrectionsNeeded}
          </p>
        )}
      </div>
    </div>
  )
}

export default App
