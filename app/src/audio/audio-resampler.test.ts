import { describe, expect, it } from 'vitest'
import {
  resampleAudioSamples,
  resampleToWhisperRate,
  WHISPER_SAMPLE_RATE_IN_HERTZ,
} from './audio-resampler'

describe('resampleAudioSamples', () => {
  it('returns an empty array when input is empty', () => {
    const emptySamples = new Float32Array(0)

    expect(resampleAudioSamples(emptySamples, 48000, 16000).length).toBe(0)
  })

  it('returns the same samples when input and output rates match', () => {
    const samples = new Float32Array([0.1, -0.2, 0.3, -0.4, 0.5])

    const resampled = resampleAudioSamples(samples, 44100, 44100)

    expect(Array.from(resampled)).toEqual(Array.from(samples))
  })

  it('produces roughly one third of the samples from 48 kHz to 16 kHz', () => {
    const durationInSeconds = 0.1
    const inputSampleRate = 48000
    const samples = new Float32Array(inputSampleRate * durationInSeconds)

    const resampled = resampleAudioSamples(samples, inputSampleRate, 16000)

    expect(resampled.length).toBe(samples.length / 3)
  })

  it('preserves the value of a constant signal', () => {
    const constantAmplitude = 0.42
    const constantSamples = new Float32Array(480).fill(constantAmplitude)

    const resampled = resampleAudioSamples(constantSamples, 48000, 16000)

    expect(resampled.length).toBeGreaterThan(0)
    for (const sampleValue of resampled) {
      // Float32 has ~7 significant digits; precision 5 is enough here.
      expect(sampleValue).toBeCloseTo(constantAmplitude, 5)
    }
  })

  it('keeps a 440 Hz sine frequency when going from 48 kHz to 16 kHz', () => {
    const inputSampleRate = 48000
    const outputSampleRate = 16000
    const frequencyInHertz = 440
    const durationInSeconds = 0.5
    const sampleCount = Math.round(inputSampleRate * durationInSeconds)

    const sineWaveSamples = new Float32Array(sampleCount)
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const timeInSeconds = sampleIndex / inputSampleRate
      sineWaveSamples[sampleIndex] = Math.sin(2 * Math.PI * frequencyInHertz * timeInSeconds)
    }

    const resampledSamples = resampleAudioSamples(
      sineWaveSamples,
      inputSampleRate,
      outputSampleRate,
    )

    // Estimate frequency via rising zero crossings.
    let positiveGoingZeroCrossingCount = 0
    for (let sampleIndex = 1; sampleIndex < resampledSamples.length; sampleIndex += 1) {
      const previousSample = resampledSamples[sampleIndex - 1]
      const currentSample = resampledSamples[sampleIndex]
      if (previousSample < 0 && currentSample >= 0) {
        positiveGoingZeroCrossingCount += 1
      }
    }

    const resampledDurationInSeconds = resampledSamples.length / outputSampleRate
    const estimatedFrequencyInHertz = positiveGoingZeroCrossingCount / resampledDurationInSeconds

    expect(estimatedFrequencyInHertz).toBeCloseTo(frequencyInHertz, -1)
  })
})

describe('resampleToWhisperRate', () => {
  it('fixes the output rate at 16 kHz', () => {
    const samples = new Float32Array(4800)

    const resampled = resampleToWhisperRate(samples, 48000)

    expect(resampled.length).toBe(samples.length * (WHISPER_SAMPLE_RATE_IN_HERTZ / 48000))
  })
})
