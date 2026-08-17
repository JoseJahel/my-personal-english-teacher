import { describe, expect, it } from 'vitest'
import { WHISPER_SAMPLE_RATE_IN_HERTZ } from '../audio/audio-resampler'
import { prepareSpeechPcmForModels } from '../audio/prepare-speech-pcm'
import { scorePronunciationFromMonoPcm } from '../dsp/pronunciation-score'
import { runPronunciationScoringForUtterance } from './run-pronunciation-scoring'

function createTone(
  frequencyInHertz: number,
  sampleRateInHertz: number,
  durationInSeconds: number,
): Float32Array {
  const sampleCount = Math.round(sampleRateInHertz * durationInSeconds)
  const samples = new Float32Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = Math.sin((2 * Math.PI * frequencyInHertz * index) / sampleRateInHertz)
  }
  return samples
}

describe('runPronunciationScoringForUtterance', () => {
  it('preprocesses user PCM and the TTS reference with the same chain', async () => {
    const userSamples = createTone(220, 48_000, 0.35)
    const referenceSamples = createTone(220, WHISPER_SAMPLE_RATE_IN_HERTZ, 0.35)
    const result = await runPronunciationScoringForUtterance({
      userSamples,
      userSampleRateInHertz: 48_000,
      referenceEnglishText: 'hello',
      synthesizeSpeech: async () => ({
        samples: referenceSamples,
        sampleRateInHertz: WHISPER_SAMPLE_RATE_IN_HERTZ,
      }),
    })

    const expected = scorePronunciationFromMonoPcm(
      prepareSpeechPcmForModels(userSamples, 48_000, WHISPER_SAMPLE_RATE_IN_HERTZ),
      prepareSpeechPcmForModels(
        referenceSamples,
        WHISPER_SAMPLE_RATE_IN_HERTZ,
        WHISPER_SAMPLE_RATE_IN_HERTZ,
      ),
      WHISPER_SAMPLE_RATE_IN_HERTZ,
      { referenceTextForHighlights: 'hello' },
    )

    expect(result).not.toBeNull()
    expect(expected).not.toBeNull()
    expect(result?.score0to100).toBe(expected?.score0to100)
    expect(result?.mfccNormalizedDistance).toBe(expected?.mfccNormalizedDistance)
  })
})
