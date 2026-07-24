/**
 * Inference Web Worker: ASR, grammar, TTS, and SmolLM2 tutor replies.
 * Lazy-loads and memoizes each pipeline; warm preload covers ASR + grammar only.
 */

import type {
  AutomaticSpeechRecognitionPipeline,
  Text2TextGenerationPipeline,
  TextGenerationPipeline,
  TextToAudioPipeline,
} from '@huggingface/transformers'
import { loadSpeechRecognizer, transcribeAudioSamples } from './automatic-speech-recognition'
import type { ModelDownloadProgressEvent as SpeechRecognitionProgressEvent } from './automatic-speech-recognition'
import {
  generateTutorReply,
  loadConversationSuggestionGenerator,
} from './conversation-suggestions'
import { correctEnglishGrammar, loadGrammarCorrector } from './grammar-correction'
import { AggregateModelDownloadProgress } from './model-download-progress'
import type {
  CorrectGrammarRequestMessage,
  GenerateTutorReplyRequestMessage,
  InferenceWorkerRequestMessage,
  InferenceWorkerResponseMessage,
  PreloadModelsRequestMessage,
  SynthesizeSpeechRequestMessage,
  TranscribeRequestMessage,
} from './inference-worker-protocol'
import type { ModelRegistryKey } from './model-registry'
import { resolvePreferredOnnxDevice } from './resolve-inference-device'
import type { OnnxInferenceDevice } from './resolve-inference-device'
import {
  loadTextToSpeechSynthesizer,
  prepareTextForSpeechSynthesis,
  synthesizeSpeechFromText,
} from './text-to-speech-synthesis'
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

let textToSpeechSynthesizerPromise: Promise<TextToAudioPipeline> | null = null

async function loadTextToSpeechSynthesizerWithFallback(): Promise<TextToAudioPipeline> {
  const device = await getPreferredDevice()
  const onProgress = (event: SpeechRecognitionProgressEvent) =>
    handleModelDownloadProgress('textToSpeech', event)
  progressTrackerFor('textToSpeech').reset()
  try {
    return await loadTextToSpeechSynthesizer(device, onProgress)
  } catch (error) {
    if (device === 'wasm') {
      throw error
    }
    console.warn('TTS WebGPU load failed; retrying with WASM.', error)
    progressTrackerFor('textToSpeech').reset()
    preferredDevicePromise = Promise.resolve('wasm')
    return loadTextToSpeechSynthesizer('wasm', onProgress)
  }
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

async function loadConversationGeneratorWithFallback(): Promise<TextGenerationPipeline> {
  const device = await getPreferredDevice()
  const onProgress = (event: SpeechRecognitionProgressEvent) =>
    handleModelDownloadProgress('conversationSuggestions', event)
  progressTrackerFor('conversationSuggestions').reset()
  try {
    return await loadConversationSuggestionGenerator(device, onProgress)
  } catch (error) {
    if (device === 'wasm') {
      throw error
    }
    console.warn('SmolLM2 WebGPU load failed; retrying with WASM.', error)
    progressTrackerFor('conversationSuggestions').reset()
    preferredDevicePromise = Promise.resolve('wasm')
    return loadConversationSuggestionGenerator('wasm', onProgress)
  }
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
    // TTS and SmolLM2 are intentionally not preloaded (heavy); load on first use.
    postResponse({ type: 'preload-models-result', requestId })
  } catch (error) {
    console.error('Model preload failed.', error)
    postResponse({ type: 'preload-models-error', requestId, reason: 'model-load-failed' })
  }
}

async function handleGenerateTutorReplyMessage(
  message: GenerateTutorReplyRequestMessage,
): Promise<void> {
  const {
    requestId,
    scenarioContextEn,
    lastTutorLineEn,
    userUtteranceEn,
    fallbackReplyEn,
  } = message

  let generator: TextGenerationPipeline
  try {
    generator = await getConversationGenerator()
    emitModelReady('conversationSuggestions')
  } catch (error) {
    console.error('Failed to load SmolLM2 conversation model.', error)
    // Soft-fail: still return the curated scenario line so the demo continues.
    const fallback = fallbackReplyEn.trim()
    if (fallback) {
      postResponse({
        type: 'generate-tutor-reply-result',
        requestId,
        tutorReplyText: fallback,
        usedFallback: true,
      })
      return
    }
    postResponse({ type: 'generate-tutor-reply-error', requestId, reason: 'model-load-failed' })
    return
  }

  try {
    const result = await generateTutorReply(generator, {
      scenarioContextEn,
      lastTutorLineEn,
      userUtteranceEn,
      fallbackReplyEn,
    })
    postResponse({
      type: 'generate-tutor-reply-result',
      requestId,
      tutorReplyText: result.tutorReplyText,
      usedFallback: result.usedFallback,
    })
  } catch (error) {
    console.error('Tutor reply generation failed.', error)
    const fallback = fallbackReplyEn.trim()
    if (fallback) {
      postResponse({
        type: 'generate-tutor-reply-result',
        requestId,
        tutorReplyText: fallback,
        usedFallback: true,
      })
      return
    }
    postResponse({ type: 'generate-tutor-reply-error', requestId, reason: 'generation-failed' })
  }
}

async function handleSynthesizeSpeechMessage(
  message: SynthesizeSpeechRequestMessage,
): Promise<void> {
  const { requestId, inputText } = message
  const preparedText = prepareTextForSpeechSynthesis(inputText)
  if (!preparedText) {
    postResponse({ type: 'synthesize-speech-error', requestId, reason: 'empty-text' })
    return
  }

  let synthesizer: TextToAudioPipeline
  try {
    synthesizer = await getTextToSpeechSynthesizer()
    emitModelReady('textToSpeech')
  } catch (error) {
    console.error('Failed to load the text-to-speech model.', error)
    postResponse({ type: 'synthesize-speech-error', requestId, reason: 'model-load-failed' })
    return
  }

  try {
    const synthesized = await synthesizeSpeechFromText(synthesizer, preparedText)
    if (synthesized.samples.length === 0) {
      postResponse({ type: 'synthesize-speech-error', requestId, reason: 'synthesis-failed' })
      return
    }

    const audioSamples = synthesized.samples
    const response: InferenceWorkerResponseMessage = {
      type: 'synthesize-speech-result',
      requestId,
      audioSamples,
      sampleRateInHertz: synthesized.sampleRateInHertz,
    }
    // Transfer PCM buffer to the main thread (worker postMessage transfer list).
    const workerScope = self as unknown as {
      postMessage: (message: unknown, transfer: Transferable[]) => void
    }
    workerScope.postMessage(response, [audioSamples.buffer])
  } catch (error) {
    console.error('Speech synthesis failed.', error)
    postResponse({ type: 'synthesize-speech-error', requestId, reason: 'synthesis-failed' })
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
    case 'synthesize-speech':
      void handleSynthesizeSpeechMessage(message)
      break
    case 'generate-tutor-reply':
      void handleGenerateTutorReplyMessage(message)
      break
  }
})
