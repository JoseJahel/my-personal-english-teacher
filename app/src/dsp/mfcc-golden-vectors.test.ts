import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractMfccSequence } from './mfcc-extraction'
import {
  MFCC_GOLDEN_MAX_ABSOLUTE_ERROR,
  MFCC_GOLDEN_SAMPLE_RATE_HZ,
  mfccGoldenSignalRecipes,
  synthesizeGoldenMfccSignal,
} from './mfcc-golden-signals'

interface MfccGoldenFixture {
  readonly version: number
  readonly sampleRateInHertz: number
  readonly maxAbsoluteError: number
  readonly c0Policy: string
  readonly cases: readonly {
    readonly id: string
    readonly coefficients: readonly (readonly number[])[]
  }[]
}

function loadGoldenFixture(): MfccGoldenFixture {
  const fixturePath = resolve(process.cwd(), 'src/dsp/mfcc-golden-vectors.json')
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as MfccGoldenFixture
}

function maximumAbsoluteError(
  actual: Float32Array,
  expected: readonly number[],
  startCoefficient: number,
): number {
  let maximum = 0
  for (let index = startCoefficient; index < actual.length; index += 1) {
    maximum = Math.max(maximum, Math.abs((actual[index] ?? 0) - (expected[index] ?? 0)))
  }
  return maximum
}

describe('MFCC golden vectors (issue #67)', () => {
  it('matches versioned coefficients for every synthetic recipe', () => {
    const fixture = loadGoldenFixture()
    expect(fixture.version).toBe(1)
    expect(fixture.sampleRateInHertz).toBe(MFCC_GOLDEN_SAMPLE_RATE_HZ)
    expect(fixture.maxAbsoluteError).toBe(MFCC_GOLDEN_MAX_ABSOLUTE_ERROR)
    expect(fixture.c0Policy.toLowerCase()).toMatch(/c0/)
    expect(fixture.cases.map((entry) => entry.id)).toEqual(
      mfccGoldenSignalRecipes.map((recipe) => recipe.id),
    )

    let maxErrorC0 = 0
    let maxErrorC1ToC12 = 0

    for (const recipe of mfccGoldenSignalRecipes) {
      const golden = fixture.cases.find((entry) => entry.id === recipe.id)
      expect(golden).toBeDefined()
      const frames = extractMfccSequence(
        synthesizeGoldenMfccSignal(recipe),
        MFCC_GOLDEN_SAMPLE_RATE_HZ,
      )
      expect(frames.length).toBe(golden!.coefficients.length)

      for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
        const actual = frames[frameIndex]!.coefficients
        const expected = golden!.coefficients[frameIndex]!
        expect(actual.length).toBe(13)
        expect(expected.length).toBe(13)
        maxErrorC0 = Math.max(maxErrorC0, Math.abs((actual[0] ?? 0) - (expected[0] ?? 0)))
        maxErrorC1ToC12 = Math.max(maxErrorC1ToC12, maximumAbsoluteError(actual, expected, 1))
      }
    }

    expect(maxErrorC1ToC12).toBeLessThan(MFCC_GOLDEN_MAX_ABSOLUTE_ERROR)
    expect(maxErrorC0).toBeLessThan(MFCC_GOLDEN_MAX_ABSOLUTE_ERROR)
  })
})
