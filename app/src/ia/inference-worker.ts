/**
 * Worker orquestador de inferencia: punto de entrada de un Web Worker de
 * módulo (`{ type: 'module' }`) que ejecuta el pipeline de IA fuera del hilo
 * principal, siguiendo la convención "nada de inferencia en el hilo
 * principal" del proyecto (ver "Convenciones y defaults técnicos" en el
 * README raíz). Por ahora el pipeline cubre ASR (reconocimiento de voz) y
 * corrección gramatical; sugerencias y TTS se integran en avances futuros
 * sobre este mismo worker.
 *
 * Cada modelo se carga perezosamente: recién en el primer mensaje que lo
 * necesita (`'transcribe'` para el ASR, `'correct-grammar'` para la
 * gramática), y se memoiza por separado para reutilizarse en los siguientes
 * (convención de "carga de modelos bajo demanda con indicador de progreso").
 * El progreso de cada primera carga se reenvía al hilo principal como
 * mensajes `'model-loading-progress'`, distinguidos por `modelKey`.
 *
 * Este archivo se ejecuta en el `DedicatedWorkerGlobalScope`, no en `window`:
 * no importa nada de `ui/` ni usa ninguna API del DOM.
 */

import type {
  AutomaticSpeechRecognitionPipeline,
  Text2TextGenerationPipeline,
} from '@huggingface/transformers'
import { loadSpeechRecognizer, transcribeAudioSamples } from './automatic-speech-recognition'
import type { ModelDownloadProgressEvent as SpeechRecognitionProgressEvent } from './automatic-speech-recognition'
import { correctEnglishGrammar, loadGrammarCorrector } from './grammar-correction'
import type { ModelDownloadProgressCallback as GrammarCorrectionProgressCallback } from './grammar-correction'
import type {
  CorrectGrammarRequestMessage,
  InferenceWorkerRequestMessage,
  InferenceWorkerResponseMessage,
  TranscribeRequestMessage,
} from './inference-worker-protocol'
import type { ModelRegistryKey } from './model-registry'
import { WHISPER_SAMPLE_RATE_IN_HERTZ } from '../audio/audio-resampler'

function postResponse(message: InferenceWorkerResponseMessage): void {
  self.postMessage(message)
}

/**
 * Reenvía al hilo principal los eventos de progreso de descarga que trae la
 * variante `'progress'` de `ModelDownloadProgressEvent`; las demás variantes
 * (`'initiate'`, `'download'`, `'done'`, `'ready'`) no traen un porcentaje y
 * se ignoran, ya que `ui/` solo necesita mostrar el avance de la descarga.
 * `modelKey` identifica cuál de los modelos del registro se está
 * descargando, para que el hilo principal pueda distinguirlos.
 */
function handleModelDownloadProgress(
  modelKey: ModelRegistryKey,
  event: SpeechRecognitionProgressEvent,
): void {
  if (event.status !== 'progress') {
    return
  }

  postResponse({
    type: 'model-loading-progress',
    modelKey,
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
    speechRecognizerPromise = loadSpeechRecognizer((event) =>
      handleModelDownloadProgress('automaticSpeechRecognition', event),
    ).catch((error: unknown) => {
      // Si la carga falla, se limpia la memoización para permitir un
      // reintento en el próximo mensaje 'transcribe' en vez de quedar
      // atascado en un rechazo permanente.
      speechRecognizerPromise = null
      throw error
    })
  }
  return speechRecognizerPromise
}

/**
 * Promesa del corrector gramatical, memoizada perezosamente con el mismo
 * criterio que `speechRecognizerPromise`: se crea recién en el primer mensaje
 * `'correct-grammar'` y se reutiliza en los siguientes.
 */
let grammarCorrectorPromise: Promise<Text2TextGenerationPipeline> | null = null

function getGrammarCorrector(): Promise<Text2TextGenerationPipeline> {
  if (!grammarCorrectorPromise) {
    const onProgress: GrammarCorrectionProgressCallback = (event) =>
      handleModelDownloadProgress('grammarCorrection', event)
    grammarCorrectorPromise = loadGrammarCorrector(onProgress).catch((error: unknown) => {
      // Mismo criterio que getSpeechRecognizer(): limpia la memoización para
      // permitir un reintento en el próximo 'correct-grammar'.
      grammarCorrectorPromise = null
      throw error
    })
  }
  return grammarCorrectorPromise
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

async function handleCorrectGrammarMessage(message: CorrectGrammarRequestMessage): Promise<void> {
  const { requestId, inputText } = message

  let corrector: Text2TextGenerationPipeline
  try {
    corrector = await getGrammarCorrector()
  } catch (error) {
    console.error('No fue posible cargar el modelo de corrección gramatical.', error)
    postResponse({ type: 'grammar-correction-error', requestId, reason: 'model-load-failed' })
    return
  }

  try {
    const correctedText = await correctEnglishGrammar(corrector, inputText)
    postResponse({ type: 'grammar-correction-result', requestId, correctedText })
  } catch (error) {
    console.error('Falló la corrección gramatical del texto transcrito.', error)
    postResponse({ type: 'grammar-correction-error', requestId, reason: 'correction-failed' })
  }
}

self.addEventListener('message', (event: MessageEvent<InferenceWorkerRequestMessage>) => {
  const message = event.data
  switch (message.type) {
    case 'transcribe':
      void handleTranscribeMessage(message)
      break
    case 'correct-grammar':
      void handleCorrectGrammarMessage(message)
      break
  }
})
