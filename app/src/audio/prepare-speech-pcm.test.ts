import { describe, expect, it } from 'vitest'
import { WHISPER_SAMPLE_RATE_IN_HERTZ } from './audio-resampler'
import { prepareSpeechPcmForModels } from './prepare-speech-pcm'
import {
  VOICE_BANDPASS_IN_BAND_PROBE_HZ,
  VOICE_BANDPASS_MIN_STOPBAND_ATTENUATION_DB,
  VOICE_BANDPASS_RUMBLE_PROBE_HZ,
  applyVoiceBandpass,
} from '../dsp/biquad-voice-bandpass'

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

function steadyStateRms(samples: Float32Array, skipEachSide: number): number {
  const start = Math.min(skipEachSide, Math.floor(samples.length / 4))
  const end = Math.max(start + 1, samples.length - start)
  let sumOfSquares = 0
  let count = 0
  for (let index = start; index < end; index += 1) {
    const value = samples[index] ?? 0
    sumOfSquares += value * value
    count += 1
  }
  return count === 0 ? 0 : Math.sqrt(sumOfSquares / count)
}

describe('prepareSpeechPcmForModels', () => {
  it('returns empty PCM when the buffer or rates are unusable', () => {
    expect(prepareSpeechPcmForModels(new Float32Array(0), 48_000, 16_000).length).toBe(0)
    expect(prepareSpeechPcmForModels(new Float32Array(16), 0, 16_000).length).toBe(0)
  })

  it('applies the same steps to user and reference buffers', () => {
    const user = createTone(VOICE_BANDPASS_IN_BAND_PROBE_HZ, 48_000, 0.25)
    const reference = user.slice()
    const preparedUser = prepareSpeechPcmForModels(user, 48_000, WHISPER_SAMPLE_RATE_IN_HERTZ)
    const preparedReference = prepareSpeechPcmForModels(
      reference,
      48_000,
      WHISPER_SAMPLE_RATE_IN_HERTZ,
    )
    expect(preparedUser.length).toBe(preparedReference.length)
    expect(Array.from(preparedUser)).toEqual(Array.from(preparedReference))
  })

  it('is resample then one bandpass pass, matching the explicit composition', () => {
    const tone = createTone(VOICE_BANDPASS_IN_BAND_PROBE_HZ, 16_000, 0.3)
    const prepared = prepareSpeechPcmForModels(tone, 16_000, 16_000)
    const composed = applyVoiceBandpass(tone.slice(), 16_000)
    expect(Array.from(prepared)).toEqual(Array.from(composed))
  })

  it('keeps a 1 kHz tone and attenuates 20 Hz rumble after 48 kHz → 16 kHz', () => {
    const inBand = prepareSpeechPcmForModels(
      createTone(VOICE_BANDPASS_IN_BAND_PROBE_HZ, 48_000, 0.5),
      48_000,
      WHISPER_SAMPLE_RATE_IN_HERTZ,
    )
    const rumble = prepareSpeechPcmForModels(
      createTone(VOICE_BANDPASS_RUMBLE_PROBE_HZ, 48_000, 0.5),
      48_000,
      WHISPER_SAMPLE_RATE_IN_HERTZ,
    )
    const skip = Math.round(WHISPER_SAMPLE_RATE_IN_HERTZ * 0.1)
    const inBandRms = steadyStateRms(inBand, skip)
    const rumbleRms = steadyStateRms(rumble, skip)
    const attenuationDb = 20 * Math.log10(inBandRms / rumbleRms)
    expect(inBandRms).toBeGreaterThan(0.4)
    expect(attenuationDb).toBeGreaterThan(VOICE_BANDPASS_MIN_STOPBAND_ATTENUATION_DB)
  })
})
