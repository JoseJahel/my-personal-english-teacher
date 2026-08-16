import { describe, expect, it } from 'vitest'
import {
  MAXIMUM_TTS_INPUT_CHARACTERS,
  normalizeTextToSpeechPipelineOutput,
  prepareTextForSpeechSynthesis,
} from './text-to-speech-synthesis'

describe('prepareTextForSpeechSynthesis', () => {
  it('returns empty for blank input', () => {
    expect(prepareTextForSpeechSynthesis('   ')).toBe('')
    expect(prepareTextForSpeechSynthesis('')).toBe('')
  })

  it('collapses internal whitespace', () => {
    expect(prepareTextForSpeechSynthesis('  Hello,   world  ')).toBe('Hello, world')
  })

  it('truncates to the maximum character budget', () => {
    const longText = 'a'.repeat(MAXIMUM_TTS_INPUT_CHARACTERS + 50)
    const prepared = prepareTextForSpeechSynthesis(longText)
    expect(prepared.length).toBeLessThanOrEqual(MAXIMUM_TTS_INPUT_CHARACTERS)
  })

  it('normalizes numbers, prices, and codes before returning (#77)', () => {
    expect(prepareTextForSpeechSynthesis('Gate B12 boards at 3:30 p.m., ticket is $12')).toBe(
      'Gate B twelve boards at three thirty p m, ticket is twelve dollars',
    )
  })
})

describe('normalizeTextToSpeechPipelineOutput', () => {
  it('copies Float32Array audio and keeps sample rate', () => {
    const audio = new Float32Array([0.1, -0.2, 0.3])
    const result = normalizeTextToSpeechPipelineOutput({
      audio,
      sampling_rate: 16000,
    })
    expect(result.sampleRateInHertz).toBe(16000)
    expect(result.samples).toEqual(audio)
    expect(result.samples).not.toBe(audio)
  })

  it('defaults sample rate when the value is non-positive', () => {
    const result = normalizeTextToSpeechPipelineOutput({
      audio: new Float32Array([0, 1, 0]),
      sampling_rate: 0,
    })
    expect(result.samples).toEqual(new Float32Array([0, 1, 0]))
    expect(result.sampleRateInHertz).toBe(16000)
  })

  it('returns empty samples for empty pipeline output', () => {
    const result = normalizeTextToSpeechPipelineOutput([])
    expect(result.samples.length).toBe(0)
  })
})
