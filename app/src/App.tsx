import { useCallback, useEffect, useRef, useState } from 'react'
import { MicrophoneCaptureError, startMicrophoneCapture } from './audio/microphone-capture'
import type { MicrophoneCaptureSession } from './audio/microphone-capture'
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

const WAVEFORM_BACKGROUND_COLOR = '#1e1e1e'
const WAVEFORM_LINE_COLOR = '#2ecc71'

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

export function App() {
  const [microphoneStatus, setMicrophoneStatus] = useState<MicrophoneUiStatus>('idle')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const captureSessionRef = useRef<MicrophoneCaptureSession | null>(null)
  const animationFrameRef = useRef<number | null>(null)
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

  const handleStartButtonClick = useCallback(async () => {
    const attemptGeneration = (captureAttemptGenerationRef.current += 1)
    setMicrophoneStatus('starting')

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
    stopMicrophoneCapture()
    clearWaveformCanvas()
    setMicrophoneStatus('stopped')
  }, [stopMicrophoneCapture, clearWaveformCanvas])

  // Cleanup al desmontar el componente: detiene la sesión de captura y
  // cancela el rAF pendiente, evitando fugas si el usuario navega fuera
  // mientras el micrófono sigue activo.
  useEffect(() => {
    return () => {
      stopMicrophoneCapture()
    }
  }, [stopMicrophoneCapture])

  const statusMessage = microphoneStatusMessageFor(microphoneStatus)

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
        <strong>{homeScreenInterfaceTexts.statusFieldLabel}:</strong> {statusMessage}
      </div>
    </div>
  )
}

export default App
