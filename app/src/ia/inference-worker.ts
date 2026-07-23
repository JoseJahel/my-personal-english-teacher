/**
 * Inference Web Worker: ASR then grammar outside the main thread.
 * Lazy-loads and memoizes each pipeline on first use.
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

let speechRecognizerPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null

function getSpeechRecognizer(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!speechRecognizerPromise) {
    speechRecognizerPromise = loadSpeechRecognizer((event) =>
      handleModelDownloadProgress('automaticSpeechRecognition', event),
    ).catch((error: unknown) => {
      // Clear memo so the next request can retry a failed download.
      speechRecognizerPromise = null
      throw error
    })
  }
  return speechRecognizerPromise
}

let grammarCorrectorPromise: Promise<Text2TextGenerationPipeline> | null = null

function getGrammarCorrector(): Promise<Text2TextGenerationPipeline> {
  if (!grammarCorrectorPromise) {
    const onProgress: GrammarCorrectionProgressCallback = (event) =>
      handleModelDownloadProgress('grammarCorrection', event)
    grammarCorrectorPromise = loadGrammarCorrector(onProgress).catch((error: unknown) => {
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
    postResponse({ type: 'model-ready', modelKey: 'automaticSpeechRecognition' })
  } catch (error) {
    console.error('Failed to load the speech recognition model.', error)
    postResponse({ type: 'transcription-error', requestId, reason: 'model-load-failed' })
    return
  }

  try {
    const transcribedText = await transcribeAudioSamples(recognizer, audioSamples)
    postResponse({ type: 'transcription-result', requestId, transcribedText })
  } catch (error) {
    console.error('Speech transcription failed.', error)
    postResponse({ type: 'transcription-error', requestId, reason: 'transcription-failed' })
  }
}

async function handleCorrectGrammarMessage(message: CorrectGrammarRequestMessage): Promise<void> {
  const { requestId, inputText } = message

  let corrector: Text2TextGenerationPipeline
  try {
    corrector = await getGrammarCorrector()
    postResponse({ type: 'model-ready', modelKey: 'grammarCorrection' })
  } catch (error) {
    console.error('Failed to load the grammar correction model.', error)
    postResponse({ type: 'grammar-correction-error', requestId, reason: 'model-load-failed' })
    return
  }

  try {
    const correctedText = await correctEnglishGrammar(corrector, inputText)
    postResponse({ type: 'grammar-correction-result', requestId, correctedText })
  } catch (error) {
    console.error('Grammar correction inference failed.', error)
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
