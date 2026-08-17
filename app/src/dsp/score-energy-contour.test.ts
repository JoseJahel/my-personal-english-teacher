import { describe, expect, it } from 'vitest'
import { scoreEnergyContourFromMonoPcm } from './score-energy-contour'

function synthesizeAmplitudeModulatedTone(options: {
  frequencyInHertz: number
  sampleRateInHertz: number
  durationSeconds: number
  modulationHertz: number
}): Float32Array {
  const sampleCount = Math.floor(options.durationSeconds * options.sampleRateInHertz)
  const samples = new Float32Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / options.sampleRateInHertz
    const envelope = 0.25 + 0.25 * Math.sin(2 * Math.PI * options.modulationHertz * time)
    samples[index] =
      envelope * Math.sin((2 * Math.PI * options.frequencyInHertz * index) / options.sampleRateInHertz)
  }
  return samples
}

describe('scoreEnergyContourFromMonoPcm', () => {
  const sampleRateInHertz = 16_000

  it('returns null for empty buffers', () => {
    expect(
      scoreEnergyContourFromMonoPcm(new Float32Array(0), new Float32Array(800), sampleRateInHertz),
    ).toBeNull()
  })

  it('scores a time-stretched copy of the same envelope highly', () => {
    const reference = synthesizeAmplitudeModulatedTone({
      frequencyInHertz: 180,
      sampleRateInHertz,
      durationSeconds: 0.28,
      modulationHertz: 4,
    })
    const user = synthesizeAmplitudeModulatedTone({
      frequencyInHertz: 180,
      sampleRateInHertz,
      durationSeconds: 0.38,
      modulationHertz: 4,
    })
    const result = scoreEnergyContourFromMonoPcm(user, reference, sampleRateInHertz)
    expect(result).not.toBeNull()
    expect(result!.score0to100).toBeGreaterThan(80)
  })

  it('scores a different envelope lower than a matching one', () => {
    const reference = synthesizeAmplitudeModulatedTone({
      frequencyInHertz: 180,
      sampleRateInHertz,
      durationSeconds: 0.3,
      modulationHertz: 3,
    })
    const matching = synthesizeAmplitudeModulatedTone({
      frequencyInHertz: 200,
      sampleRateInHertz,
      durationSeconds: 0.32,
      modulationHertz: 3,
    })
    const mismatch = synthesizeAmplitudeModulatedTone({
      frequencyInHertz: 180,
      sampleRateInHertz,
      durationSeconds: 0.3,
      modulationHertz: 12,
    })
    const match = scoreEnergyContourFromMonoPcm(matching, reference, sampleRateInHertz)
    const different = scoreEnergyContourFromMonoPcm(mismatch, reference, sampleRateInHertz)
    expect(match).not.toBeNull()
    expect(different).not.toBeNull()
    expect(match!.score0to100).toBeGreaterThan(different!.score0to100)
  })
})
