import { describe, expect, it } from 'vitest'
import type { FormantTriple } from '../dsp/formant-estimation'
import {
  cloneFormantTriple,
  createUserTurnSignalSnapshot,
  isCurrentAttemptGeneration,
} from './practice-turn-signal-snapshot'

describe('createUserTurnSignalSnapshot', () => {
  it('copies PCM so later mutations of the source buffer do not affect the turn', () => {
    const source = new Float32Array([0.1, 0.2, 0.3])
    const formants = {
      f1InHertz: 500,
      f2InHertz: 1500,
      f3InHertz: 2500,
    } as FormantTriple & { f1InHertz: number }

    const snapshot = createUserTurnSignalSnapshot(source, 16_000, formants)
    source[0] = 0.9
    formants.f1InHertz = 999

    expect(snapshot.samples[0]).toBeCloseTo(0.1)
    expect(snapshot.sampleRateInHertz).toBe(16_000)
    expect(snapshot.formants).toEqual({
      f1InHertz: 500,
      f2InHertz: 1500,
      f3InHertz: 2500,
    })
  })

  it('keeps null formants null', () => {
    const snapshot = createUserTurnSignalSnapshot(new Float32Array([0]), 48_000, null)
    expect(snapshot.formants).toBeNull()
  })
})

describe('cloneFormantTriple', () => {
  it('returns an independent object', () => {
    const original: FormantTriple = {
      f1InHertz: 100,
      f2InHertz: 200,
      f3InHertz: null,
    }
    const cloned = cloneFormantTriple(original)
    expect(cloned).toEqual(original)
    expect(cloned).not.toBe(original)
  })
})

describe('isCurrentAttemptGeneration', () => {
  it('accepts only the matching generation token', () => {
    expect(isCurrentAttemptGeneration(3, 3)).toBe(true)
    expect(isCurrentAttemptGeneration(2, 3)).toBe(false)
  })
})

/**
 * Regression for issue #23: two rapid turns must not cross PCM/formants when
 * scoring/persist read from per-turn snapshots instead of shared mutable refs.
 */
describe('turn signal isolation across rapid turns (issue #23)', () => {
  it('keeps turn N snapshot stable after turn N+1 overwrites shared slot values', () => {
    const sharedSlot = {
      samples: new Float32Array([1, 1, 1]),
      sampleRateInHertz: 16_000,
      formants: {
        f1InHertz: 400,
        f2InHertz: 1400,
        f3InHertz: 2400,
      } satisfies FormantTriple,
    }

    const turnN = createUserTurnSignalSnapshot(
      sharedSlot.samples,
      sharedSlot.sampleRateInHertz,
      sharedSlot.formants,
    )

    // Simulate turn N+1 writing the shared ref-like slot before turn N scores.
    sharedSlot.samples = new Float32Array([9, 9, 9])
    sharedSlot.sampleRateInHertz = 48_000
    sharedSlot.formants = {
      f1InHertz: 800,
      f2InHertz: 1800,
      f3InHertz: 2800,
    }

    expect(Array.from(turnN.samples)).toEqual([1, 1, 1])
    expect(turnN.sampleRateInHertz).toBe(16_000)
    expect(turnN.formants).toEqual({
      f1InHertz: 400,
      f2InHertz: 1400,
      f3InHertz: 2400,
    })
  })
})
