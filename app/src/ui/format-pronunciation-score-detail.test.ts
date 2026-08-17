import { describe, expect, it } from 'vitest'
import { formatPronunciationScoreDetail } from './format-pronunciation-score-detail'

describe('formatPronunciationScoreDetail', () => {
  it('omits missing branches and keeps Spanish labels', () => {
    expect(
      formatPronunciationScoreDetail({
        mfccScore: 80,
        pitchScore: null,
        energyScore: 70,
        formantScore: null,
        userFrames: 10,
        referenceFrames: 12,
      }),
    ).toBe('MFCC 80.0 · energía 70.0 · frames usuario 10 / ref 12')
  })
})
