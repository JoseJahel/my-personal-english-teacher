import { describe, expect, it } from 'vitest'
import { extractLogRmsEnergyFrames } from './energy-contour'

function synthesizeTone(options: {
  frequencyInHertz: number
  sampleRateInHertz: number
  durationSeconds: number
  amplitude: number
}): Float32Array {
  const sampleCount = Math.floor(options.durationSeconds * options.sampleRateInHertz)
  const samples = new Float32Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] =
      options.amplitude *
      Math.sin((2 * Math.PI * options.frequencyInHertz * index) / options.sampleRateInHertz)
  }
  return samples
}

describe('extractLogRmsEnergyFrames', () => {
  const sampleRateInHertz = 16_000

  it('returns no frames for empty or unusable input', () => {
    expect(extractLogRmsEnergyFrames(new Float32Array(0), sampleRateInHertz)).toEqual([])
    expect(extractLogRmsEnergyFrames(new Float32Array(800), 0)).toEqual([])
  })

  it('emits one log-RMS coefficient per 10 ms hop', () => {
    const tone = synthesizeTone({
      frequencyInHertz: 200,
      sampleRateInHertz,
      durationSeconds: 0.2,
      amplitude: 0.4,
    })
    const frames = extractLogRmsEnergyFrames(tone, sampleRateInHertz)
    expect(frames.length).toBeGreaterThan(10)
    expect(frames[0]).toHaveLength(1)
    expect(Number.isFinite(frames[0]![0])).toBe(true)
  })

  it('assigns a higher log-RMS to a louder constant tone', () => {
    const quiet = extractLogRmsEnergyFrames(
      synthesizeTone({
        frequencyInHertz: 180,
        sampleRateInHertz,
        durationSeconds: 0.2,
        amplitude: 0.1,
      }),
      sampleRateInHertz,
    )
    const loud = extractLogRmsEnergyFrames(
      synthesizeTone({
        frequencyInHertz: 180,
        sampleRateInHertz,
        durationSeconds: 0.2,
        amplitude: 0.6,
      }),
      sampleRateInHertz,
    )
    const quietMean = quiet.reduce((sum, frame) => sum + (frame[0] ?? 0), 0) / quiet.length
    const loudMean = loud.reduce((sum, frame) => sum + (frame[0] ?? 0), 0) / loud.length
    expect(loudMean).toBeGreaterThan(quietMean)
  })
})
