/**
 * Inference Web Worker: ASR, grammar, TTS, and SmolLM2 tutor replies.
 * Lazy-loads and memoizes each pipeline; warm preload overlaps ASR + grammar + TTS.
 */

import type {
  AutomaticSpeechRecognitionPipeline,
  Text2TextGenerationPipeline,
  TextGenerationPipeline,
  TextToAudioPipeline,
} from '@huggingface/transformers'
import { loadSpeechRecognizer, transcribeAudioSamples } from './automatic-speech-recognition'
import type { ModelDownloadProgressEvent as SpeechRecognitionProgressEvent } from './automatic-speech-recognition'
import { loadConversationSuggestionGenerator } from './conversation-suggestions'
import { correctEnglishGrammar, loadGrammarCorrector } from './grammar-correction'
import { KeyedAsyncCache } from './keyed-async-cache'
import { AggregateModelDownloadProgress } from './model-download-progress'
import type {
  CorrectGrammarRequestMessage,
  InferenceWorkerRequestMessage,
  InferenceWorkerResponseMessage,
  PreloadConversationModelRequestMessage,
  PreloadModelsRequestMessage,
  TranscribeRequestMessage,
} from './inference-worker-protocol'
import type { AsrModelCandidateId, ModelRegistryKey } from './model-registry'
import { resolveActiveAsrCandidateId } from './model-registry'
import { deviceForModelKey, resolvePreferredOnnxDevice } from './resolve-inference-device'
import type { OnnxInferenceDevice } from './resolve-inference-device'
import { loadTextToSpeechSynthesizer } from './text-to-speech-synthesis'
import {
  handleGenerateCommunicationCoachingMessage,
  handleGenerateTutorReplyMessage,
  handleSynthesizeSpeechMessage,
} from './inference-worker-speech-jobs'
import { WHISPER_SAMPLE_RATE_IN_HERTZ } from '../audio/audio-resampler'
import { isWarmPreloadSuccessful, runWarmModelPreload } from './warm-model-preload'

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

/**
 * Resolves which ASR candidate a request targets: an explicit override
 * (benchmark runs) wins, else the active candidate (env override or default).
 * Keeping the normal app flow's contract unchanged (no candidate → default).
 */
export function resolveAsrCandidateIdForMessage(message: {
  readonly asrCandidateId?: AsrModelCandidateId
}): AsrModelCandidateId {
  return message.asrCandidateId ?? resolveActiveAsrCandidateId()
}

// Entries are never evicted on success (no LRU/cap). A benchmark sweeping
// several candidates must dispose/recreate the InferenceClient between
// candidates instead of reusing one worker, or resident Whisper models will
// accumulate.
const speechRecognizerCache = new KeyedAsyncCache<
  AsrModelCandidateId,
  AutomaticSpeechRecognitionPipeline
>()

async function loadSpeechRecognizerWithFallback(
  candidateId: AsrModelCandidateId,
): Promise<AutomaticSpeechRecognitionPipeline> {
  const device = await getPreferredDevice()
  const onProgress = (event: SpeechRecognitionProgressEvent) =>
    handleModelDownloadProgress('automaticSpeechRecognition', event)
  progressTrackerFor('automaticSpeechRecognition').reset()
  try {
    return await loadSpeechRecognizer(device, onProgress, candidateId)
  } catch (error) {
    if (device === 'wasm') {
      throw error
    }
    // Adapter existed but ONNX WebGPU session failed: one WASM retry (cache hits).
    console.warn('ASR WebGPU load failed; retrying with WASM.', error)
    progressTrackerFor('automaticSpeechRecognition').reset()
    preferredDevicePromise = Promise.resolve('wasm')
    return loadSpeechRecognizer('wasm', onProgress, candidateId)
  }
}

function getSpeechRecognizer(
  candidateId: AsrModelCandidateId,
): Promise<AutomaticSpeechRecognitionPipeline> {
  return speechRecognizerCache.get(candidateId, () => loadSpeechRecognizerWithFallback(candidateId))
}

let grammarCorrectorPromise: Promise<Text2TextGenerationPipeline> | null = null

// Grammar T5 is only validated on WASM (deviceForModelKey pins it there), so
// unlike ASR there is no WebGPU attempt and thus no WASM retry to perform:
// a load failure here is a genuine failure and propagates to the caller.
async function loadGrammarCorrectorWithFallback(): Promise<Text2TextGenerationPipeline> {
  const device = deviceForModelKey('grammarCorrection', await getPreferredDevice())
  const onProgress = (event: SpeechRecognitionProgressEvent) =>
    handleModelDownloadProgress('grammarCorrection', event)
  progressTrackerFor('grammarCorrection').reset()
  return loadGrammarCorrector(device, onProgress)
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

let textToSpeechSynthesizerPromise: Promise<TextToAudioPipeline> | null = null

// TTS is only validated on WASM (deviceForModelKey pins it there):
// the previous SpeechT5 WebGPU MatMul kernel was broken, and Supertonic
// stays on the same WASM pin so a TTS failure cannot contaminate the
// shared device pin that ASR reads.
async function loadTextToSpeechSynthesizerWithFallback(): Promise<TextToAudioPipeline> {
  const device = deviceForModelKey('textToSpeech', await getPreferredDevice())
  const onProgress = (event: SpeechRecognitionProgressEvent) =>
    handleModelDownloadProgress('textToSpeech', event)
  progressTrackerFor('textToSpeech').reset()
  return loadTextToSpeechSynthesizer(device, onProgress)
}

function getTextToSpeechSynthesizer(): Promise<TextToAudioPipeline> {
  if (!textToSpeechSynthesizerPromise) {
    textToSpeechSynthesizerPromise = loadTextToSpeechSynthesizerWithFallback().catch(
      (error: unknown) => {
        textToSpeechSynthesizerPromise = null
        throw error
      },
    )
  }
  return textToSpeechSynthesizerPromise
}

let conversationGeneratorPromise: Promise<TextGenerationPipeline> | null = null

// SmolLM2 is only validated on WASM (deviceForModelKey pins it there), so
// unlike ASR there is no WebGPU attempt and thus no WASM retry to perform.
async function loadConversationGeneratorWithFallback(): Promise<TextGenerationPipeline> {
  const device = deviceForModelKey('conversationSuggestions', await getPreferredDevice())
  const onProgress = (event: SpeechRecognitionProgressEvent) =>
    handleModelDownloadProgress('conversationSuggestions', event)
  progressTrackerFor('conversationSuggestions').reset()
  return loadConversationSuggestionGenerator(device, onProgress)
}

function getConversationGenerator(): Promise<TextGenerationPipeline> {
  if (!conversationGeneratorPromise) {
    conversationGeneratorPromise = loadConversationGeneratorWithFallback().catch(
      (error: unknown) => {
        conversationGeneratorPromise = null
        throw error
      },
    )
  }
  return conversationGeneratorPromise
}

async function handleTranscribeMessage(message: TranscribeRequestMessage): Promise<void> {
  const { requestId, audioSamples, sampleRate } = message

  if (sampleRate !== WHISPER_SAMPLE_RATE_IN_HERTZ) {
    postResponse({ type: 'transcription-error', requestId, reason: 'invalid-sample-rate' })
    return
  }

  const candidateId = resolveAsrCandidateIdForMessage(message)

  let recognizer: AutomaticSpeechRecognitionPipeline
  try {
    recognizer = await getSpeechRecognizer(candidateId)
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
 * Overlap Whisper + T5 + Supertonic downloads. SmolLM2 still waits for a
 * scenario pick so it does not steal bandwidth from the first-turn models.
 */
async function handlePreloadModelsMessage(message: PreloadModelsRequestMessage): Promise<void> {
  const { requestId } = message
  const candidateId = resolveAsrCandidateIdForMessage(message)
  try {
    const result = await runWarmModelPreload({
      loadSpeechRecognizer: async () => {
        await getSpeechRecognizer(candidateId)
        emitModelReady('automaticSpeechRecognition')
      },
      loadGrammarCorrector: async () => {
        await getGrammarCorrector()
        emitModelReady('grammarCorrection')
      },
      loadTextToSpeech: async () => {
        await getTextToSpeechSynthesizer()
        emitModelReady('textToSpeech')
      },
    })
    if (!isWarmPreloadSuccessful(result)) {
      postResponse({ type: 'preload-models-error', requestId, reason: 'model-load-failed' })
      return
    }
    postResponse({ type: 'preload-models-result', requestId })
  } catch (error) {
    console.error('Model preload failed.', error)
    postResponse({ type: 'preload-models-error', requestId, reason: 'model-load-failed' })
  }
}

async function handlePreloadConversationModelMessage(
  message: PreloadConversationModelRequestMessage,
): Promise<void> {
  const { requestId } = message
  try {
    await getConversationGenerator()
    emitModelReady('conversationSuggestions')
    postResponse({ type: 'preload-conversation-model-result', requestId })
  } catch (error) {
    console.error('SmolLM2 conversation model preload failed.', error)
    postResponse({
      type: 'preload-conversation-model-error',
      requestId,
      reason: 'model-load-failed',
    })
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
    case 'preload-conversation-model':
      void handlePreloadConversationModelMessage(message)
      break
    case 'synthesize-speech':
      void handleSynthesizeSpeechMessage(message, {
        getTextToSpeechSynthesizer,
        emitModelReady: () => emitModelReady('textToSpeech'),
        postResponse,
      })
      break
    case 'generate-tutor-reply':
      void handleGenerateTutorReplyMessage(message, {
        getConversationGenerator,
        emitModelReady: () => emitModelReady('conversationSuggestions'),
        postResponse,
      })
      break
    case 'generate-communication-coaching':
      void handleGenerateCommunicationCoachingMessage(message, {
        getConversationGenerator,
        emitModelReady: () => emitModelReady('conversationSuggestions'),
        postResponse,
      })
      break
    case 'set-preferred-device':
      // Worker-wide pin: ALL pipelines (ASR/grammar/TTS/SmolLM2) read this device.
      if (message.device === 'webgpu' || message.device === 'wasm') {
        preferredDevicePromise = Promise.resolve(message.device)
      } else {
        console.warn('Ignoring invalid preferred device override.', message.device)
      }
      break
  }
})
