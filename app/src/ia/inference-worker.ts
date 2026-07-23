/**
 * Inference Web Worker: ASR then grammar outside the main thread.
 * Lazy-loads and memoizes each pipeline; supports warm preload.
 */

import type {
  AutomaticSpeechRecognitionPipeline,
  Text2TextGenerationPipeline,
} from '@huggingface/transformers'
import { loadSpeechRecognizer, transcribeAudioSamples } from './automatic-speech-recognition'
import type { ModelDownloadProgressEvent as SpeechRecognitionProgressEvent } from './automatic-speech-recognition'
import { correctEnglishGrammar, loadGrammarCorrector } from './grammar-correction'
import { AggregateModelDownloadProgress } from './model-download-progress'
import type {
  CorrectGrammarRequestMessage,
  InferenceWorkerRequestMessage,
  InferenceWorkerResponseMessage,
  PreloadModelsRequestMessage,
  TranscribeRequestMessage,
} from './inference-worker-protocol'
import type { ModelRegistryKey } from './model-registry'
import { resolvePreferredOnnxDevice } from './resolve-inference-device'
import type { OnnxInferenceDevice } from './resolve-inference-device'
import { WHISPER_SAMPLE_RATE_IN_HERTZ } from '../audio/audio-resampler'

function postResponse(message: InferenceWorkerResponseMessage): void {
  self.postMessage(message)
}

const progressByModel = new Map<ModelRegistryKey, AggregateModelDownloadProgress>()

function progressTrackerFor(modelKey: ModelRegistryKey): AggregateModelDownloadProgress {
  let tracker = progressByModel.get(modelKey)
  if (!tracker) {
    tracker = new AggregateModelDownloadProgress()
    progressByModel.set(modelKey, tracker)
  }
  return tracker
}

function handleModelDownloadProgress(
  modelKey: ModelRegistryKey,
  event: SpeechRecognitionProgressEvent,
): void {
  const tracker = progressTrackerFor(modelKey)
  const progressPercent = tracker.handleEvent(event)
  if (progressPercent === null) {
    return
  }

  const fileName = 'file' in event && typeof event.file === 'string' ? event.file : ''

  postResponse({
    type: 'model-loading-progress',
    modelKey,
    progressPercent,
    fileName,
  })
}

function emitModelReady(modelKey: ModelRegistryKey): void {
  progressTrackerFor(modelKey).markComplete()
  postResponse({
    type: 'model-loading-progress',
    modelKey,
    progressPercent: 100,
    fileName: '',
  })
  postResponse({ type: 'model-ready', modelKey })
}

let preferredDevicePromise: Promise<OnnxInferenceDevice> | null = null

function getPreferredDevice(): Promise<OnnxInferenceDevice> {
  if (!preferredDevicePromise) {
    preferredDevicePromise = resolvePreferredOnnxDevice()
  }
  return preferredDevicePromise
}

let speechRecognizerPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null

async function loadSpeechRecognizerWithFallback(): Promise<AutomaticSpeechRecognitionPipeline> {
  const device = await getPreferredDevice()
  const onProgress = (event: SpeechRecognitionProgressEvent) =>
    handleModelDownloadProgress('automaticSpeechRecognition', event)
  progressTrackerFor('automaticSpeechRecognition').reset()
  try {
    return await loadSpeechRecognizer(device, onProgress)
  } catch (error) {
    if (device === 'wasm') {
      throw error
    }
    // Adapter existed but ONNX WebGPU session failed: one WASM retry (cache hits).
    console.warn('ASR WebGPU load failed; retrying with WASM.', error)
    progressTrackerFor('automaticSpeechRecognition').reset()
    preferredDevicePromise = Promise.resolve('wasm')
    return loadSpeechRecognizer('wasm', onProgress)
  }
}

function getSpeechRecognizer(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!speechRecognizerPromise) {
    speechRecognizerPromise = loadSpeechRecognizerWithFallback().catch((error: unknown) => {
      speechRecognizerPromise = null
      throw error
    })
  }
  return speechRecognizerPromise
}

let grammarCorrectorPromise: Promise<Text2TextGenerationPipeline> | null = null

async function loadGrammarCorrectorWithFallback(): Promise<Text2TextGenerationPipeline> {
  const device = await getPreferredDevice()
  const onProgress = (event: SpeechRecognitionProgressEvent) =>
    handleModelDownloadProgress('grammarCorrection', event)
  progressTrackerFor('grammarCorrection').reset()
  try {
    return await loadGrammarCorrector(device, onProgress)
  } catch (error) {
    if (device === 'wasm') {
      throw error
    }
    console.warn('Grammar WebGPU load failed; retrying with WASM.', error)
    progressTrackerFor('grammarCorrection').reset()
    preferredDevicePromise = Promise.resolve('wasm')
    return loadGrammarCorrector('wasm', onProgress)
  }
}

function getGrammarCorrector(): Promise<Text2TextGenerationPipeline> {
  if (!grammarCorrectorPromise) {
    grammarCorrectorPromise = loadGrammarCorrectorWithFallback().catch((error: unknown) => {
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
    emitModelReady('automaticSpeechRecognition')
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
    emitModelReady('grammarCorrection')
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

/**
 * Load ASR then grammar in series (memory-friendly) so the first utterance
 * only pays inference latency when the user has already been on the page a bit.
 */
async function handlePreloadModelsMessage(message: PreloadModelsRequestMessage): Promise<void> {
  const { requestId } = message
  try {
    await getSpeechRecognizer()
    emitModelReady('automaticSpeechRecognition')
    await getGrammarCorrector()
    emitModelReady('grammarCorrection')
    postResponse({ type: 'preload-models-result', requestId })
  } catch (error) {
    console.error('Model preload failed.', error)
    postResponse({ type: 'preload-models-error', requestId, reason: 'model-load-failed' })
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
    case 'preload-models':
      void handlePreloadModelsMessage(message)
      break
  }
})
