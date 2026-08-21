import type { TextGenerationPipeline, TextToAudioPipeline } from '@huggingface/transformers'
import { generateCommunicationCoaching } from './communication-coaching-generation'
import { generateTutorReply } from './conversation-suggestions'
import type {
  GenerateCommunicationCoachingRequestMessage,
  GenerateTutorReplyRequestMessage,
  InferenceWorkerResponseMessage,
  SynthesizeSpeechRequestMessage,
} from './inference-worker-protocol'
import { prepareTextForSpeechSynthesis, synthesizeSpeechFromText } from './text-to-speech-synthesis'

export async function handleGenerateTutorReplyMessage(
  message: GenerateTutorReplyRequestMessage,
  deps: {
    readonly getConversationGenerator: () => Promise<TextGenerationPipeline>
    readonly emitModelReady: () => void
    readonly postResponse: (message: InferenceWorkerResponseMessage) => void
  },
): Promise<void> {
  const { requestId, scenarioContextEn, historyTurnsEn, userUtteranceEn, fallbackReplyEn } = message
  const fallback = fallbackReplyEn.trim()

  let generator: TextGenerationPipeline
  try {
    generator = await deps.getConversationGenerator()
    deps.emitModelReady()
  } catch (error) {
    console.error('Failed to load SmolLM2 conversation model.', error)
    if (fallback) {
      deps.postResponse({
        type: 'generate-tutor-reply-result',
        requestId,
        tutorReplyText: fallback,
        usedFallback: true,
      })
      return
    }
    deps.postResponse({
      type: 'generate-tutor-reply-error',
      requestId,
      reason: 'model-load-failed',
    })
    return
  }

  try {
    const result = await generateTutorReply(generator, {
      scenarioContextEn,
      historyTurnsEn,
      userUtteranceEn,
      fallbackReplyEn,
    })
    deps.postResponse({
      type: 'generate-tutor-reply-result',
      requestId,
      tutorReplyText: result.tutorReplyText,
      usedFallback: result.usedFallback,
    })
  } catch (error) {
    console.error('Tutor reply generation failed.', error)
    if (fallback) {
      deps.postResponse({
        type: 'generate-tutor-reply-result',
        requestId,
        tutorReplyText: fallback,
        usedFallback: true,
      })
      return
    }
    deps.postResponse({
      type: 'generate-tutor-reply-error',
      requestId,
      reason: 'generation-failed',
    })
  }
}

export async function handleGenerateCommunicationCoachingMessage(
  message: GenerateCommunicationCoachingRequestMessage,
  deps: {
    readonly getConversationGenerator: () => Promise<TextGenerationPipeline>
    readonly emitModelReady: () => void
    readonly postResponse: (message: InferenceWorkerResponseMessage) => void
  },
): Promise<void> {
  const { requestId, scenarioContextEn, lastTutorLineEn, userUtteranceEn } = message

  let generator: TextGenerationPipeline
  try {
    generator = await deps.getConversationGenerator()
    deps.emitModelReady()
  } catch (error) {
    console.error('Failed to load SmolLM2 conversation model.', error)
    deps.postResponse({
      type: 'generate-communication-coaching-error',
      requestId,
      reason: 'model-load-failed',
    })
    return
  }

  try {
    const result = await generateCommunicationCoaching(generator, {
      scenarioContextEn,
      lastTutorLineEn,
      userUtteranceEn,
    })
    deps.postResponse({
      type: 'generate-communication-coaching-result',
      requestId,
      tryThisEn: result.draft?.tryThisEn ?? '',
      whyEs: result.draft?.whyEs ?? '',
      usedFallback: result.usedFallback,
    })
  } catch (error) {
    console.error('Communication coaching generation failed.', error)
    deps.postResponse({
      type: 'generate-communication-coaching-error',
      requestId,
      reason: 'generation-failed',
    })
  }
}

export async function handleSynthesizeSpeechMessage(
  message: SynthesizeSpeechRequestMessage,
  deps: {
    readonly getTextToSpeechSynthesizer: () => Promise<TextToAudioPipeline>
    readonly emitModelReady: () => void
    readonly postResponse: (message: InferenceWorkerResponseMessage) => void
  },
): Promise<void> {
  const { requestId, inputText } = message
  const preparedText = prepareTextForSpeechSynthesis(inputText)
  if (!preparedText) {
    deps.postResponse({ type: 'synthesize-speech-error', requestId, reason: 'empty-text' })
    return
  }

  let synthesizer: TextToAudioPipeline
  try {
    synthesizer = await deps.getTextToSpeechSynthesizer()
    deps.emitModelReady()
  } catch (error) {
    console.error('Failed to load the text-to-speech model.', error)
    deps.postResponse({ type: 'synthesize-speech-error', requestId, reason: 'model-load-failed' })
    return
  }

  try {
    const synthesized = await synthesizeSpeechFromText(synthesizer, preparedText)
    if (synthesized.samples.length === 0) {
      deps.postResponse({ type: 'synthesize-speech-error', requestId, reason: 'synthesis-failed' })
      return
    }

    const audioSamples = synthesized.samples
    const response: InferenceWorkerResponseMessage = {
      type: 'synthesize-speech-result',
      requestId,
      audioSamples,
      sampleRateInHertz: synthesized.sampleRateInHertz,
    }
    const workerScope = self as unknown as {
      postMessage: (message: unknown, transfer: Transferable[]) => void
    }
    workerScope.postMessage(response, [audioSamples.buffer])
  } catch (error) {
    console.error('Speech synthesis failed.', error)
    deps.postResponse({ type: 'synthesize-speech-error', requestId, reason: 'synthesis-failed' })
  }
}
