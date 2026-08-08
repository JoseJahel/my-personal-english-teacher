import { describe, expect, it } from 'vitest'
import {
  fitDistanceAtHalfScore,
  type CalibrationSample,
} from './fit-pronunciation-score-calibration'

function scoreFromDistance(distance: number, distanceAtHalfScore: number): number {
  return 100 * Math.exp((-Math.LN2 * distance) / distanceAtHalfScore)
}

describe('fitDistanceAtHalfScore', () => {
  it('recovers the exact distanceAtHalfScore from noiseless synthetic data', () => {
    const trueDistanceAtHalfScore = 20
    const distances = [1, 3, 5, 8, 12, 18, 25, 35]
    const samples: CalibrationSample[] = distances.map((normalizedDistance) => ({
      normalizedDistance,
      humanScore0to100: scoreFromDistance(normalizedDistance, trueDistanceAtHalfScore),
    }))

    const result = fitDistanceAtHalfScore(samples)

    expect(result).not.toBeNull()
    expect(result!.distanceAtHalfScore).toBeCloseTo(trueDistanceAtHalfScore, 5)
    expect(result!.rootMeanSquareErrorInScorePoints).toBeLessThan(0.01)
    expect(result!.sampleCount).toBe(distances.length)
  })

  it('recovers an approximate distanceAtHalfScore under labeling noise', () => {
    const trueDistanceAtHalfScore = 15
    const distances = [2, 4, 6, 9, 13, 17, 22, 28, 33]
    const noise = [1.5, -2, 0.5, -1, 2, -1.5, 1, -0.5, 0.8]
    const samples: CalibrationSample[] = distances.map((normalizedDistance, i) => ({
      normalizedDistance,
      humanScore0to100: Math.min(
        100,
        Math.max(1, scoreFromDistance(normalizedDistance, trueDistanceAtHalfScore) + noise[i]),
      ),
    }))

    const result = fitDistanceAtHalfScore(samples)

    expect(result).not.toBeNull()
    expect(result!.distanceAtHalfScore).toBeGreaterThan(10)
    expect(result!.distanceAtHalfScore).toBeLessThan(22)
    expect(result!.rootMeanSquareErrorInScorePoints).toBeLessThan(5)
  })

  it('returns null with too few samples', () => {
    const samples: CalibrationSample[] = [
      { normalizedDistance: 5, humanScore0to100: 80 },
      { normalizedDistance: 10, humanScore0to100: 60 },
    ]
    expect(fitDistanceAtHalfScore(samples)).toBeNull()
  })

  it('filters out unusable samples (zero/negative distance, out-of-range score)', () => {
    const samples: CalibrationSample[] = [
      { normalizedDistance: 5, humanScore0to100: 80 },
      { normalizedDistance: 10, humanScore0to100: 60 },
      { normalizedDistance: 15, humanScore0to100: 40 },
      { normalizedDistance: 0, humanScore0to100: 100 },
      { normalizedDistance: -3, humanScore0to100: 90 },
      { normalizedDistance: 20, humanScore0to100: 150 },
    ]
    const result = fitDistanceAtHalfScore(samples)
    expect(result).not.toBeNull()
    expect(result!.sampleCount).toBe(3)
  })

  it('returns null when distance and score are not inversely related', () => {
    const samples: CalibrationSample[] = [
      { normalizedDistance: 1, humanScore0to100: 10 },
      { normalizedDistance: 5, humanScore0to100: 40 },
      { normalizedDistance: 10, humanScore0to100: 90 },
    ]
    expect(fitDistanceAtHalfScore(samples)).toBeNull()
  })
})
