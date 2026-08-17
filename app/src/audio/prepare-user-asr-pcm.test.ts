import { describe, expect, it } from 'vitest'
import { computeRootMeanSquareEnergy } from '../dsp/signal-energy'
import { WHISPER_SAMPLE_RATE_IN_HERTZ } from './audio-resampler'
import { prepareSpeechPcmForModels } from './prepare-speech-pcm'
import { prepareUserSpeechPcmForAsr } from './prepare-user-asr-pcm'

describe('prepareUserSpeechPcmForAsr', () => {
  it('keeps the shared #73 bandpass chain for a clean in-band tone', () => {
    const sampleRate = 16_000
    const tone = new Float32Array(sampleRate)
    for (let index = 0; index < tone.length; index += 1) {
      tone[index] = 0.3 * Math.sin((2 * Math.PI * 1000 * index) / sampleRate)
    }
    const shared = prepareSpeechPcmForModels(tone, sampleRate, WHISPER_SAMPLE_RATE_IN_HERTZ)
    const userAsr = prepareUserSpeechPcmForAsr(tone, sampleRate, WHISPER_SAMPLE_RATE_IN_HERTZ)
    const sharedRms = computeRootMeanSquareEnergy(shared)
    const userRms = computeRootMeanSquareEnergy(userAsr)
    expect(Math.abs(userRms - sharedRms) / Math.max(sharedRms, 1e-8)).toBeLessThan(0.08)
  })
})
