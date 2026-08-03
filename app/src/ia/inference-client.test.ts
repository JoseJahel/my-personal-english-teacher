import { describe, expect, it } from 'vitest'
import {
  buildGenerateTutorReplyRequestMessage,
  buildPreloadConversationModelRequestMessage,
  buildPreloadModelsRequestMessage,
  buildSetPreferredDeviceMessage,
  buildTranscribeRequestMessage,
} from './inference-client'
import { WHISPER_SAMPLE_RATE_IN_HERTZ } from '../audio/audio-resampler'

describe('buildGenerateTutorReplyRequestMessage', () => {
  it('maps the client input to the worker request shape with historyTurnsEn', () => {
    const message = buildGenerateTutorReplyRequestMessage('req-1', {
      scenarioContextEn: 'Role-play: restaurant waiter.',
      historyTurnsEn: [{ speaker: 'tutor', textEn: 'What would you like?' }],
      userUtteranceEn: 'A coffee, please.',
      fallbackReplyEn: 'Anything else?',
    })
    expect(message).toEqual({
      type: 'generate-tutor-reply',
      requestId: 'req-1',
      scenarioContextEn: 'Role-play: restaurant waiter.',
      historyTurnsEn: [{ speaker: 'tutor', textEn: 'What would you like?' }],
      userUtteranceEn: 'A coffee, please.',
      fallbackReplyEn: 'Anything else?',
    })
  })
})

describe('buildPreloadConversationModelRequestMessage', () => {
  it('builds a typed preload request for the SmolLM2 conversation model', () => {
    expect(buildPreloadConversationModelRequestMessage('req-2')).toEqual({
      type: 'preload-conversation-model',
      requestId: 'req-2',
    })
  })
})

describe('buildTranscribeRequestMessage', () => {
  it('omits asrCandidateId when not given (unchanged contract)', () => {
    const samples = new Float32Array([0.1, 0.2])
    const message = buildTranscribeRequestMessage('req-1', samples, undefined)
    expect(message).toEqual({
      type: 'transcribe',
      requestId: 'req-1',
      audioSamples: samples,
      sampleRate: WHISPER_SAMPLE_RATE_IN_HERTZ,
    })
    expect('asrCandidateId' in message).toBe(false)
    expect(message.audioSamples).toBe(samples)
  })

  it('includes asrCandidateId when given (benchmark runs)', () => {
    const samples = new Float32Array([0.1])
    const message = buildTranscribeRequestMessage('req-2', samples, 'small-en')
    expect(message.asrCandidateId).toBe('small-en')
  })
})

describe('buildPreloadModelsRequestMessage', () => {
  it('omits asrCandidateId when not given (unchanged contract)', () => {
    const message = buildPreloadModelsRequestMessage('req-3')
    expect(message).toEqual({ type: 'preload-models', requestId: 'req-3' })
  })

  it('includes asrCandidateId when given', () => {
    const message = buildPreloadModelsRequestMessage('req-4', 'base-en')
    expect(message.asrCandidateId).toBe('base-en')
  })
})

describe('buildSetPreferredDeviceMessage', () => {
  it('builds a fire-and-forget device override message', () => {
    expect(buildSetPreferredDeviceMessage('webgpu')).toEqual({
      type: 'set-preferred-device',
      device: 'webgpu',
    })
  })
})
