import { describe, expect, it } from 'vitest'
import {
  FIR_ALIAS_PROBE_TONE_HZ,
  FIR_MIN_ALIAS_ATTENUATION_DB,
} from '../dsp/polyphase-resample'
import {
  resampleAudioSamples,
  resampleAudioSamplesLinear,
  resampleToWhisperRate,
  WHISPER_SAMPLE_RATE_IN_HERTZ,
} from './audio-resampler'

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

function aliasAttenuationDb(output: Float32Array): number {
  const skip = 80
  const start = skip
  const end = output.length - skip
  let sumOfSquares = 0
  let count = 0
  for (let index = start; index < end; index += 1) {
    const value = output[index] ?? 0
    sumOfSquares += value * value
    count += 1
  }
  const rms = count === 0 ? 0 : Math.sqrt(sumOfSquares / count)
  return -20 * Math.log10(Math.max(rms / Math.SQRT1_2, 1e-12))
}
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
  it('preserves the value of a constant signal in FIR steady state', () => {
    const constantAmplitude = 0.42
    const constantSamples = new Float32Array(4800).fill(constantAmplitude)
    const resampled = resampleAudioSamples(constantSamples, 48000, 16000)
    expect(resampled.length).toBeGreaterThan(80)
    const start = 40
    const end = resampled.length - 40
    for (let index = start; index < end; index += 1) {
      expect(resampled[index]).toBeCloseTo(constantAmplitude, 3)
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
    const skipEachSide = Math.round(0.02 * outputSampleRate)
    let positiveGoingZeroCrossingCount = 0
    for (
      let sampleIndex = skipEachSide + 1;
      sampleIndex < resampledSamples.length - skipEachSide;
      sampleIndex += 1
    ) {
      const previousSample = resampledSamples[sampleIndex - 1] ?? 0
      const currentSample = resampledSamples[sampleIndex] ?? 0
      if (previousSample < 0 && currentSample >= 0) {
        positiveGoingZeroCrossingCount += 1
      }
    }
    const countedDurationInSeconds =
      (resampledSamples.length - 2 * skipEachSide) / outputSampleRate
    const estimatedFrequencyInHertz = positiveGoingZeroCrossingCount / countedDurationInSeconds
    expect(estimatedFrequencyInHertz).toBeCloseTo(frequencyInHertz, -1)
  })
  it('returns an empty array instead of crashing when inputSampleRate is zero', () => {
    const samples = new Float32Array([0.1, 0.2, 0.3])
    expect(() => resampleAudioSamples(samples, 0, 16000)).not.toThrow()
    expect(resampleAudioSamples(samples, 0, 16000).length).toBe(0)
  })
  it('returns an empty array instead of crashing when inputSampleRate is negative', () => {
    const samples = new Float32Array([0.1, 0.2, 0.3])
    expect(() => resampleAudioSamples(samples, -48000, 16000)).not.toThrow()
    expect(resampleAudioSamples(samples, -48000, 16000).length).toBe(0)
  })
  it('returns an empty array for a non-positive outputSampleRate', () => {
    const samples = new Float32Array([0.1, 0.2, 0.3])
    expect(resampleAudioSamples(samples, 48000, 0).length).toBe(0)
    expect(resampleAudioSamples(samples, 48000, -16000).length).toBe(0)
  })
  it('returns an empty array for non-finite sample rates instead of crashing', () => {
    const samples = new Float32Array([0.1, 0.2, 0.3])
    expect(() => resampleAudioSamples(samples, NaN, 16000)).not.toThrow()
    expect(resampleAudioSamples(samples, NaN, 16000).length).toBe(0)
    expect(() => resampleAudioSamples(samples, Infinity, 16000)).not.toThrow()
    expect(resampleAudioSamples(samples, Infinity, 16000).length).toBe(0)
  })
})
describe('resampleToWhisperRate', () => {
  it('fixes the output rate at 16 kHz', () => {
    const samples = new Float32Array(4800)
    const resampled = resampleToWhisperRate(samples, 48000)
    expect(resampled.length).toBe(samples.length * (WHISPER_SAMPLE_RATE_IN_HERTZ / 48000))
  })

  it('uses the FIR path for 44.1 kHz and does not crash on an odd device rate', () => {
    const fortyFourOne = resampleToWhisperRate(new Float32Array(4410), 44100)
    expect(fortyFourOne.length).toBe(1600)
    expect(() => resampleToWhisperRate(new Float32Array(3200), 32000)).not.toThrow()
    expect(resampleToWhisperRate(new Float32Array(3200), 32000).length).toBe(1600)
  })

  it('rejects a 12 kHz probe far more than linear interpolation on both device rates', () => {
    const tone48 = createTone(FIR_ALIAS_PROBE_TONE_HZ, 48000, 0.25)
    const tone44 = createTone(FIR_ALIAS_PROBE_TONE_HZ, 44100, 0.25)
    const fir48 = aliasAttenuationDb(resampleToWhisperRate(tone48, 48000))
    const fir44 = aliasAttenuationDb(resampleToWhisperRate(tone44, 44100))
    const linear48 = aliasAttenuationDb(resampleAudioSamplesLinear(tone48, 48000, 16000))
    const linear44 = aliasAttenuationDb(resampleAudioSamplesLinear(tone44, 44100, 16000))
    expect(fir48).toBeGreaterThanOrEqual(FIR_MIN_ALIAS_ATTENUATION_DB)
    expect(fir44).toBeGreaterThanOrEqual(FIR_MIN_ALIAS_ATTENUATION_DB)
    expect(fir48).toBeGreaterThan(linear48 + 40)
    expect(fir44).toBeGreaterThan(linear44 + 40)
    expect(linear48).toBeLessThan(5)
  })
})
