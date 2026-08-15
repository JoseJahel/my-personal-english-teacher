import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyVisualizationLogMagnitudeAsIfPower,
  countFlooredLogMelBands,
  inspectMfccChainForTone,
} from './mfcc-chain-audit'
import {
  DEFAULT_MFCC_COEFFICIENT_COUNT,
  DEFAULT_MFCC_MEL_FILTER_COUNT,
  extractMfccSequence,
  MFCC_LOG_MEL_ENERGY_FLOOR,
} from './mfcc-extraction'

const SAMPLE_RATE_HZ = 16_000
const TONE_HZ = 1_000
const AMPLITUDE = 1
const DURATION_SECONDS = 0.1

function synthesizeUnitTone(): Float32Array {
  const sampleCount = Math.floor(DURATION_SECONDS * SAMPLE_RATE_HZ)
  const samples = new Float32Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = AMPLITUDE * Math.sin((2 * Math.PI * TONE_HZ * index) / SAMPLE_RATE_HZ)
  }
  return samples
}

describe('MFCC chain audit (issue #94)', () => {
  it('pins the HTK convention declared in mfcc-chain-invariants.json', () => {
    const fixturePath = resolve(process.cwd(), 'src/dsp/mfcc-chain-invariants.json')
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      readonly convention: string
      readonly melFilterCount: number
      readonly coefficientCount: number
      readonly c0: string
      readonly dct: string
      readonly logMelFloor: number
      readonly powerSpectrum: string
    }
    expect(fixture.convention).toBe('HTK')
    expect(fixture.melFilterCount).toBe(DEFAULT_MFCC_MEL_FILTER_COUNT)
    expect(fixture.coefficientCount).toBe(DEFAULT_MFCC_COEFFICIENT_COUNT)
    expect(fixture.c0).toBe('kept')
    expect(fixture.dct).toMatch(/type-II/i)
    expect(fixture.logMelFloor).toBe(MFCC_LOG_MEL_ENERGY_FLOOR)
    expect(fixture.powerSpectrum.toLowerCase()).toMatch(/log10|1\/n/)
  })

  it('does not pin the 1 kHz energy to the log floor on a unit-amplitude tone', () => {
    const inspection = inspectMfccChainForTone(synthesizeUnitTone(), SAMPLE_RATE_HZ)
    expect(inspection.logMelEnergies.length).toBe(40)
    let peakBand = 0
    let peakEnergy = Number.NEGATIVE_INFINITY
    for (let index = 0; index < inspection.melEnergies.length; index += 1) {
      const energy = inspection.melEnergies[index] ?? 0
      if (energy > peakEnergy) {
        peakEnergy = energy
        peakBand = index
      }
    }
    const floorLog = Math.fround(Math.log(MFCC_LOG_MEL_ENERGY_FLOOR))
    expect(inspection.logMelEnergies[peakBand]!).toBeGreaterThan(floorLog + 1)
    expect(countFlooredLogMelBands(inspection.logMelEnergies)).toBeLessThanOrEqual(2)
  })

  it('keeps c1–c12 from collapsing to ~0 on that tone', () => {
    const frames = extractMfccSequence(synthesizeUnitTone(), SAMPLE_RATE_HZ)
    const mid = frames[Math.floor(frames.length / 2)]!.coefficients
    let maxAbs = 0
    for (let index = 1; index < mid.length; index += 1) {
      maxAbs = Math.max(maxAbs, Math.abs(mid[index] ?? 0))
    }
    expect(maxAbs).toBeGreaterThan(1)
  })

  it('fails the floor invariant if the power spectrum is replaced by spectrogram log-magnitude', () => {
    const inspection = inspectMfccChainForTone(synthesizeUnitTone(), SAMPLE_RATE_HZ)
    const poisonedPower = applyVisualizationLogMagnitudeAsIfPower(inspection.powerSpectrum)
    const poisoned = inspectMfccChainForTone(synthesizeUnitTone(), SAMPLE_RATE_HZ, {
      powerSpectrumOverride: poisonedPower,
    })
    const healthyFloored = countFlooredLogMelBands(inspection.logMelEnergies)
    const poisonedFloored = countFlooredLogMelBands(poisoned.logMelEnergies)
    expect(poisonedFloored).toBeGreaterThan(healthyFloored)
    expect(poisonedFloored).toBeGreaterThanOrEqual(10)
  })
})
