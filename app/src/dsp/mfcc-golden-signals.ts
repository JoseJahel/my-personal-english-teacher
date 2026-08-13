/**
 * Deterministic synthetic recipes for MFCC golden-vector fixtures (issue #67).
 * Shared by the Vitest anchor and the optional offline regenerator.
 */

export const MFCC_GOLDEN_SAMPLE_RATE_HZ = 16_000
export const MFCC_GOLDEN_DURATION_SECONDS = 0.08
/** Absolute per-coefficient cap vs the versioned JSON (Float32 pipeline). */
export const MFCC_GOLDEN_MAX_ABSOLUTE_ERROR = 1e-5

export type MfccGoldenSignalRecipe =
  | {
      readonly id: 'sine-440'
      readonly kind: 'sine'
      readonly frequencyInHertz: 440
      readonly amplitude: 0.5
    }
  | {
      readonly id: 'sine-1000'
      readonly kind: 'sine'
      readonly frequencyInHertz: 1000
      readonly amplitude: 0.5
    }
  | {
      readonly id: 'two-tone-220-660'
      readonly kind: 'two-sine'
      readonly frequencyAInHertz: 220
      readonly frequencyBInHertz: 660
      readonly amplitude: 0.35
    }
  | {
      readonly id: 'lcg-noise'
      readonly kind: 'lcg-noise'
      readonly seed: 7
    }

export const mfccGoldenSignalRecipes: readonly MfccGoldenSignalRecipe[] = [
  { id: 'sine-440', kind: 'sine', frequencyInHertz: 440, amplitude: 0.5 },
  { id: 'sine-1000', kind: 'sine', frequencyInHertz: 1000, amplitude: 0.5 },
  {
    id: 'two-tone-220-660',
    kind: 'two-sine',
    frequencyAInHertz: 220,
    frequencyBInHertz: 660,
    amplitude: 0.35,
  },
  { id: 'lcg-noise', kind: 'lcg-noise', seed: 7 },
]

export function synthesizeGoldenMfccSignal(recipe: MfccGoldenSignalRecipe): Float32Array {
  const sampleCount = Math.floor(MFCC_GOLDEN_DURATION_SECONDS * MFCC_GOLDEN_SAMPLE_RATE_HZ)
  const samples = new Float32Array(sampleCount)
  if (recipe.kind === 'sine') {
    fillSine(samples, recipe.frequencyInHertz, recipe.amplitude)
    return samples
  }
  if (recipe.kind === 'two-sine') {
    fillSine(samples, recipe.frequencyAInHertz, recipe.amplitude)
    for (let index = 0; index < sampleCount; index += 1) {
      samples[index] =
        (samples[index] ?? 0) +
        recipe.amplitude *
          Math.sin((2 * Math.PI * recipe.frequencyBInHertz * index) / MFCC_GOLDEN_SAMPLE_RATE_HZ)
    }
    return samples
  }
  let seed = recipe.seed
  for (let index = 0; index < sampleCount; index += 1) {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0
    samples[index] = seed / 0xff_ff_ff_ff - 0.5
  }
  return samples
}

function fillSine(samples: Float32Array, frequencyInHertz: number, amplitude: number): void {
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] =
      amplitude * Math.sin((2 * Math.PI * frequencyInHertz * index) / MFCC_GOLDEN_SAMPLE_RATE_HZ)
  }
}
