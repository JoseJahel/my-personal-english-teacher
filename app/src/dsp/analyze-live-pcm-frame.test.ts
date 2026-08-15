import { describe, expect, it } from 'vitest'
import { analyzeLivePcmFrame } from './analyze-live-pcm-frame'
import { livePcmFrameLengthInSamples } from './pcm-frame-accumulator'

function synthesizeSineWave(options: {
  frequencyInHertz: number
  sampleRateInHertz: number
  durationSeconds: number
}): Float32Array {
  const { frequencyInHertz, sampleRateInHertz, durationSeconds } = options
  const sampleCount = Math.floor(durationSeconds * sampleRateInHertz)
  const samples = new Float32Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = 0.6 * Math.sin((2 * Math.PI * frequencyInHertz * index) / sampleRateInHertz)
  }
  return samples
}

describe('analyzeLivePcmFrame', () => {
  const sampleRateInHertz = 16_000
  const frameLength = livePcmFrameLengthInSamples(sampleRateInHertz)

  it('places a 1 kHz tone peak near the analytical STFT bin', () => {
    const frame = synthesizeSineWave({
      frequencyInHertz: 1000,
      sampleRateInHertz,
      durationSeconds: frameLength / sampleRateInHertz,
    })
    const result = analyzeLivePcmFrame(frame, sampleRateInHertz)
    expect(result.logMagnitudeColumn).not.toBeNull()
    const column = result.logMagnitudeColumn!
    let peakBin = 0
    let peakValue = Number.NEGATIVE_INFINITY
    for (let bin = 0; bin < column.length; bin += 1) {
      if ((column[bin] ?? Number.NEGATIVE_INFINITY) > peakValue) {
        peakValue = column[bin] ?? peakValue
        peakBin = bin
      }
    }
    const fftSize = result.fftSize
    const expectedBin = Math.round((1000 * fftSize) / sampleRateInHertz)
    expect(Math.abs(peakBin - expectedBin)).toBeLessThanOrEqual(2)
    expect(result.analysisDurationMs).toBeGreaterThanOrEqual(0)
    expect(result.analysisDurationMs).toBeLessThan(50)
  })

  it('estimates F0 near 220 Hz with the same YIN used post-utterance', () => {
    const frame = synthesizeSineWave({
      frequencyInHertz: 220,
      sampleRateInHertz,
      durationSeconds: 0.04,
    })
    const result = analyzeLivePcmFrame(frame, sampleRateInHertz)
    expect(result.pitchFrequencyInHertz).not.toBeNull()
    expect(result.pitchFrequencyInHertz!).toBeGreaterThan(200)
    expect(result.pitchFrequencyInHertz!).toBeLessThan(240)
  })

  it('does not invent a stable speech F0 on silence', () => {
    const silence = new Float32Array(frameLength)
    const result = analyzeLivePcmFrame(silence, sampleRateInHertz)
    expect(result.pitchFrequencyInHertz).toBeNull()
  })
})
