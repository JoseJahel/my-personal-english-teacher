/**
 * Captura de micrófono: apertura del dispositivo de entrada de audio y
 * publicación de sus datos crudos hacia el resto de la aplicación.
 *
 * Esta capa es infraestructura pura de Web Audio API: no importa nada de
 * `ui/` (cero React) y solo depende hacia adentro, hacia `dsp/`, si en algún
 * momento necesitara una función de análisis. Expone dos ramas de audio a
 * partir de un mismo `MediaStreamAudioSourceNode`:
 *
 * - Una rama de **visualización**, vía `analyserNode`, a la tasa nativa del
 *   dispositivo (44.1/48 kHz) y con `fftSize` 2048, pensada para dibujar el
 *   waveform en tiempo real desde `ui/`.
 * - Una rama de **frames crudos**, entregados con `subscribeToAudioFrames`,
 *   también a la tasa nativa. Estos frames alimentarán más adelante a
 *   `audio-resampler.ts` (conversión a 16 kHz mono) camino a Whisper y al
 *   extractor de MFCC del comparador de pronunciación.
 *
 * La entrega de frames usa un `AudioWorkletNode` (no `ScriptProcessorNode`,
 * que está obsoleto y corre en el hilo principal) cuyo procesador se registra
 * desde un módulo generado en memoria con `Blob` + `URL.createObjectURL`, para
 * no depender de un archivo de worklet servido aparte.
 */

const AUDIO_FRAME_WORKLET_PROCESSOR_NAME = 'microphone-audio-frame-publisher'
const VISUALIZATION_ANALYSER_FFT_SIZE = 2048

/**
 * Código fuente del `AudioWorkletProcessor` que publica cada bloque de audio
 * (128 muestras por defecto) recibido del micrófono hacia el hilo principal
 * mediante `postMessage`. Vive como una cadena de texto, no como un archivo
 * `.ts` aparte, porque se carga en el navegador como un módulo de worklet
 * independiente vía Blob URL; al ser JavaScript plano ejecutado en el scope
 * global del `AudioWorkletGlobalScope`, TypeScript no lo tipa ni lo compila.
 */
const audioFrameWorkletProcessorSource = `
class MicrophoneAudioFramePublisherProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const inputChannels = inputs[0]
    if (!inputChannels || inputChannels.length === 0 || !inputChannels[0]) {
      // Devolver true mantiene vivo al procesador aunque el bloque venga vacío
      // (p. ej. el primer callback antes de que el MediaStream entregue audio).
      return true
    }

    // Se copia el bloque porque el buffer que entrega el motor de audio se
    // reutiliza en cada llamada a process(); transferirlo evita además una
    // copia adicional en el postMessage (structured clone con transfer list).
    // Si el mic llega en estéreo (Chrome a veces ignora channelCount: 1), se
    // promedian los canales a mono para no tirar la mitad de la señal.
    const channelCount = inputChannels.length
    const frameLength = inputChannels[0].length
    let monoFrame
    if (channelCount === 1) {
      monoFrame = inputChannels[0].slice()
    } else {
      monoFrame = new Float32Array(frameLength)
      for (let sampleIndex = 0; sampleIndex < frameLength; sampleIndex += 1) {
        let sampleSum = 0
        for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
          const channel = inputChannels[channelIndex]
          sampleSum += channel ? channel[sampleIndex] : 0
        }
        monoFrame[sampleIndex] = sampleSum / channelCount
      }
    }
    this.port.postMessage(monoFrame, [monoFrame.buffer])
    return true
  }
}

registerProcessor('${AUDIO_FRAME_WORKLET_PROCESSOR_NAME}', MicrophoneAudioFramePublisherProcessor)
`

/**
 * Motivos por los que puede fallar la apertura del micrófono. Se modela como
 * un discriminante de cadena (no un enum: `erasableSyntaxOnly` los prohíbe en
 * este proyecto) para que `ui/` pueda mapear cada valor a un mensaje propio
 * en `ui/interface-texts.ts` con un simple `switch`.
 *
 * - `'permission-denied'`: la persona usuaria rechazó el permiso, o el
 *   navegador lo bloqueó por política de seguridad (`NotAllowedError` /
 *   `SecurityError`).
 * - `'unknown'`: cualquier otro fallo (dispositivo inexistente, en uso por
 *   otra aplicación, `AudioWorklet` no soportado, etc.).
 */
export type MicrophoneCaptureErrorReason = 'permission-denied' | 'unknown'

/**
 * Error de primera clase para fallos al capturar el micrófono. Se distingue
 * de un `Error` genérico por su propiedad `reason`, tipada como
 * `MicrophoneCaptureErrorReason`, que `ui/` puede inspeccionar para decidir
 * qué mensaje mostrar sin tener que interpretar mensajes de texto libre.
 */
export class MicrophoneCaptureError extends Error {
  readonly reason: MicrophoneCaptureErrorReason

  constructor(reason: MicrophoneCaptureErrorReason, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'MicrophoneCaptureError'
    this.reason = reason
  }
}

/**
 * Clasifica un error arrojado por `getUserMedia` (o por la inicialización del
 * `AudioWorklet`) en un `MicrophoneCaptureError` con un motivo tipado.
 */
function toMicrophoneCaptureError(error: unknown): MicrophoneCaptureError {
  const isPermissionError =
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'SecurityError')

  if (isPermissionError) {
    return new MicrophoneCaptureError(
      'permission-denied',
      'La persona usuaria denegó el permiso de acceso al micrófono, o el navegador lo bloqueó por política de seguridad.',
      { cause: error },
    )
  }

  return new MicrophoneCaptureError(
    'unknown',
    'No fue posible acceder al micrófono por un error inesperado.',
    { cause: error },
  )
}

/**
 * Función que recibe un frame mono de audio crudo (`Float32Array`, valores en
 * el rango [-1, 1]) a la tasa nativa del dispositivo.
 */
export type AudioFrameListener = (frame: Float32Array) => void

/**
 * Función que cancela una suscripción previa a `subscribeToAudioFrames`.
 */
export type UnsubscribeFromAudioFrames = () => void

/**
 * Sesión de captura de micrófono activa, devuelta por `startMicrophoneCapture`.
 */
export interface MicrophoneCaptureSession {
  /** Contexto de audio que gobierna toda la sesión de captura. */
  readonly audioContext: AudioContext
  /**
   * Nodo de análisis de la rama de visualización, a la tasa nativa del
   * dispositivo y con `fftSize` 2048. Pensado para que `ui/` lo lea con
   * `requestAnimationFrame` y dibuje el waveform; esta capa no dibuja nada.
   */
  readonly analyserNode: AnalyserNode
  /** Tasa de muestreo nativa del dispositivo, en Hz (la de `audioContext`). */
  readonly nativeSampleRate: number
  /**
   * Suscribe un listener a los frames crudos de audio (mono, tasa nativa).
   * Devuelve una función para cancelar la suscripción.
   */
  subscribeToAudioFrames: (listener: AudioFrameListener) => UnsubscribeFromAudioFrames
  /**
   * Detiene la captura: para las pistas del `MediaStream`, desconecta todos
   * los nodos de audio y cierra el `AudioContext`. Es idempotente: llamarla
   * más de una vez no tiene efecto adicional.
   */
  stop: () => void
}

/**
 * Abre el micrófono del dispositivo y arma el grafo de Web Audio necesario
 * para capturarlo: un `MediaStreamAudioSourceNode` alimenta en paralelo a un
 * `AnalyserNode` (visualización) y a un `AudioWorkletNode` (entrega de frames
 * crudos). La captura es mono (`channelCount: 1`).
 *
 * @throws {MicrophoneCaptureError} si la persona usuaria deniega el permiso
 *   de micrófono, o si falla la apertura del dispositivo o la inicialización
 *   del `AudioWorklet` por cualquier otro motivo.
 */
export async function startMicrophoneCapture(): Promise<MicrophoneCaptureSession> {
  let mediaStream: MediaStream
  try {
    // Constraints orientadas a voz: mono preferido, AGC y supresión de ruido
    // del propio navegador. `echoCancellation` evita realimentación si hay
    // altavoces; no todos los drivers honran `channelCount: 1`, por eso el
    // worklet también hace downmix a mono por si llegan 2 canales.
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: 1 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    })
  } catch (error) {
    throw toMicrophoneCaptureError(error)
  }

  const audioContext = new AudioContext()

  try {
    // CRÍTICO: tras el await de getUserMedia el gesto de usuario ya se
    // "gastó". En Chrome/Edge el AudioContext nace en 'suspended' y NO
    // procesa el grafo (ni AnalyserNode ni AudioWorklet) hasta resume().
    // Sin esto el waveform queda plano y Whisper recibe silencio: la app
    // "no detecta la voz" aunque el permiso del mic esté concedido.
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const workletModuleBlob = new Blob([audioFrameWorkletProcessorSource], {
      type: 'application/javascript',
    })
    const workletModuleUrl = URL.createObjectURL(workletModuleBlob)
    try {
      await audioContext.audioWorklet.addModule(workletModuleUrl)
    } finally {
      URL.revokeObjectURL(workletModuleUrl)
    }

    // Reintentar resume por si addModule u otra operación volvió a suspender
    // el contexto (política autoplay del navegador en algunos entornos).
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
  } catch (error) {
    mediaStream.getTracks().forEach((track) => track.stop())
    if (audioContext.state !== 'closed') {
      await audioContext.close()
    }
    throw new MicrophoneCaptureError(
      'unknown',
      'No fue posible inicializar el procesador de audio (AudioWorklet).',
      { cause: error },
    )
  }

  // Si tras el resume el contexto sigue sin correr, no tiene sentido devolver
  // una sesión "sorda": fallar con un error tipado es más claro que un
  // waveform plano sin explicación.
  if (audioContext.state !== 'running') {
    mediaStream.getTracks().forEach((track) => track.stop())
    if (audioContext.state !== 'closed') {
      await audioContext.close()
    }
    throw new MicrophoneCaptureError(
      'unknown',
      'El contexto de audio del navegador no pudo arrancar (sigue suspendido). Prueba de nuevo tras una interacción con la página.',
    )
  }

  const sourceNode = audioContext.createMediaStreamSource(mediaStream)

  const analyserNode = audioContext.createAnalyser()
  analyserNode.fftSize = VISUALIZATION_ANALYSER_FFT_SIZE
  // Suavizado bajo para que el waveform reaccione al instante a la voz.
  analyserNode.smoothingTimeConstant = 0.3

  // No forzar channelCountMode: 'explicit' en el worklet: con micrófonos
  // estéreo reales Chrome a veces entrega 2 canales y un nodo en modo
  // explicit a 1 canal puede recibir silencio o un layout incorrecto.
  const workletNode = new AudioWorkletNode(audioContext, AUDIO_FRAME_WORKLET_PROCESSOR_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  })

  // El worklet nunca escribe en su salida (queda en silencio absoluto), pero
  // necesita estar conectado -aunque sea indirectamente- al destino del
  // AudioContext para que el motor de audio siga invocando su process(): un
  // AudioWorkletNode que no llega al destino puede quedar fuera del grafo de
  // renderizado activo y dejar de procesar. La ganancia en 0 garantiza que,
  // pase lo que pase, no se escuche nada por este camino.
  const silentOutputGainNode = audioContext.createGain()
  silentOutputGainNode.gain.value = 0

  sourceNode.connect(analyserNode)
  sourceNode.connect(workletNode)
  workletNode.connect(silentOutputGainNode)
  silentOutputGainNode.connect(audioContext.destination)

  const audioFrameListeners = new Set<AudioFrameListener>()

  workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
    for (const listener of audioFrameListeners) {
      listener(event.data)
    }
  }

  let isStopped = false

  function subscribeToAudioFrames(listener: AudioFrameListener): UnsubscribeFromAudioFrames {
    audioFrameListeners.add(listener)
    return () => {
      audioFrameListeners.delete(listener)
    }
  }

  function stop(): void {
    if (isStopped) {
      return
    }
    isStopped = true

    workletNode.port.onmessage = null
    workletNode.port.close()
    audioFrameListeners.clear()

    sourceNode.disconnect()
    analyserNode.disconnect()
    workletNode.disconnect()
    silentOutputGainNode.disconnect()

    mediaStream.getTracks().forEach((track) => track.stop())

    if (audioContext.state !== 'closed') {
      void audioContext.close()
    }
  }

  return {
    audioContext,
    analyserNode,
    nativeSampleRate: audioContext.sampleRate,
    subscribeToAudioFrames,
    stop,
  }
}
