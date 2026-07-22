/**
 * Worker orquestador de inferencia: punto de entrada de un Web Worker de
 * módulo (`{ type: 'module' }`) que ejecuta el pipeline de IA fuera del hilo
 * principal, siguiendo la convención "nada de inferencia en el hilo
 * principal" del proyecto (ver "Convenciones y defaults técnicos" en el
 * README raíz). Por ahora el pipeline solo cubre ASR (reconocimiento de voz);
 * gramática, sugerencias y TTS se integran en avances futuros sobre este
 * mismo worker.
 *
 * El pipeline de ASR se carga perezosamente: recién en el primer mensaje
 * `'transcribe'` que llega, y se memoiza para reutilizarse en los siguientes
 * (convención de "carga de modelos bajo demanda con indicador de progreso").
 * El progreso de esa primera carga se reenvía al hilo principal como
 * mensajes `'model-loading-progress'`.
 *
 * Este archivo se ejecuta en el `DedicatedWorkerGlobalScope`, no en `window`:
 * no importa nada de `ui/` ni usa ninguna API del DOM.
 */

import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import { loadSpeechRecognizer, transcribeAudioSamples } from './automatic-speech-recognition'
import type { ModelDownloadProgressEvent } from './automatic-speech-recognition'
import type {
  InferenceWorkerRequestMessage,
  InferenceWorkerResponseMessage,
  TranscribeRequestMessage,
} from './inference-worker-protocol'
import { WHISPER_SAMPLE_RATE_IN_HERTZ } from '../audio/audio-resampler'

function postResponse(message: InferenceWorkerResponseMessage): void {
  self.postMessage(message)
}

/**
 * Reenvía al hilo principal los eventos de progreso de descarga que trae la
 * variante `'progress'` de `ModelDownloadProgressEvent`; las demás variantes
 * (`'initiate'`, `'download'`, `'done'`, `'ready'`) no traen un porcentaje y
 * se ignoran, ya que `ui/` solo necesita mostrar el avance de la descarga.
 */
function handleModelDownloadProgress(event: ModelDownloadProgressEvent): void {
  if (event.status !== 'progress') {
    return
  }

  postResponse({
    type: 'model-loading-progress',
    modelKey: 'automaticSpeechRecognition',
    progressPercent: Math.round(event.progress),
    fileName: event.file,
  })
}

/**
 * Promesa del reconocedor de voz, memoizada perezosamente: se crea recién en
 * el primer mensaje `'transcribe'` y se reutiliza en los siguientes. Se
 * memoiza la promesa (no el pipeline resuelto) para que dos mensajes
 * `'transcribe'` que lleguen antes de que termine la primera carga esperen la
 * misma descarga en curso, en vez de disparar dos descargas en paralelo.
 */
let speechRecognizerPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null

function getSpeechRecognizer(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!speechRecognizerPromise) {
    speechRecognizerPromise = loadSpeechRecognizer(handleModelDownloadProgress).catch(
      (error: unknown) => {
        // Si la carga falla, se limpia la memoización para permitir un
        // reintento en el próximo mensaje 'transcribe' en vez de quedar
        // atascado en un rechazo permanente.
        speechRecognizerPromise = null
        throw error
      },
    )
  }
  return speechRecognizerPromise
}

async function handleTranscribeMessage(message: TranscribeRequestMessage): Promise<void> {
  const { requestId, audioSamples, sampleRate } = message

  if (sampleRate !== WHISPER_SAMPLE_RATE_IN_HERTZ) {
    postResponse({ type: 'transcription-error', requestId, reason: 'invalid-sample-rate' })
    return
  }

  let recognizer: AutomaticSpeechRecognitionPipeline
  try {
    recognizer = await getSpeechRecognizer()
  } catch (error) {
    console.error('No fue posible cargar el modelo de reconocimiento de voz.', error)
    postResponse({ type: 'transcription-error', requestId, reason: 'model-load-failed' })
    return
  }

  try {
    const transcribedText = await transcribeAudioSamples(recognizer, audioSamples)
    postResponse({ type: 'transcription-result', requestId, transcribedText })
  } catch (error) {
    console.error('Falló la transcripción del audio capturado.', error)
    postResponse({ type: 'transcription-error', requestId, reason: 'transcription-failed' })
  }
}

self.addEventListener('message', (event: MessageEvent<InferenceWorkerRequestMessage>) => {
  const message = event.data
  if (message.type === 'transcribe') {
    void handleTranscribeMessage(message)
  }
})
