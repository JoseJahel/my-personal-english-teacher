import { describe, expect, it } from 'vitest'
import { combinePronunciationBranchScores } from './combine-pronunciation-branch-scores'

describe('combinePronunciationBranchScores', () => {
  it('returns the MFCC score when every other branch is missing', () => {
    expect(
      combinePronunciationBranchScores({
        mfccScore0to100: 81,
        pitchScore0to100: null,
        energyScore0to100: null,
        formantScore0to100: null,
      }),
    ).toBe(81)
  })

  it('renormalizes weights when a branch is unusable', () => {
    const combined = combinePronunciationBranchScores({
      mfccScore0to100: 80,
      pitchScore0to100: 60,
      energyScore0to100: null,
      formantScore0to100: null,
      weights: { mfcc: 0.75, pitch: 0.25, energy: 0.1, formant: 0.1 },
    })
    expect(combined).toBeCloseTo(75, 5)
  })

  it('mixes all four branches when they are present', () => {
    const combined = combinePronunciationBranchScores({
      mfccScore0to100: 100,
      pitchScore0to100: 0,
      energyScore0to100: 0,
      formantScore0to100: 0,
      weights: { mfcc: 0.7, pitch: 0.1, energy: 0.1, formant: 0.1 },
    })
    expect(combined).toBeCloseTo(70, 5)
  })
})
