import { describe, expect, it } from 'vitest'
import {
  centerVoicedPitchContourInHertz,
  computeDynamicTimeWarping,
  computeFeatureVectorEuclideanDistance,
  convertDtwDistanceToPronunciationScore,
  pitchContourToFeatureFrames,
  zScoreNormalizeFeatureSequence,
} from './dynamic-time-warping'
import { extractMfccSequence } from './mfcc-extraction'

function vector(...values: number[]): Float32Array {
  return Float32Array.from(values)
}

function synthesizeSineWave(options: {
  frequencyInHertz: number
  sampleRateInHertz: number
  durationSeconds: number
}): Float32Array {
  const { frequencyInHertz, sampleRateInHertz, durationSeconds } = options
  const sampleCount = Math.floor(durationSeconds * sampleRateInHertz)
  const samples = new Float32Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = 0.5 * Math.sin((2 * Math.PI * frequencyInHertz * index) / sampleRateInHertz)
  }
  return samples
}

describe('computeFeatureVectorEuclideanDistance', () => {
  it('returns 0 for identical vectors', () => {
    expect(computeFeatureVectorEuclideanDistance(vector(1, 2, 3), vector(1, 2, 3))).toBe(0)
  })

  it('matches the known L2 norm for a simple pair', () => {
    expect(computeFeatureVectorEuclideanDistance(vector(0, 0), vector(3, 4))).toBeCloseTo(5, 10)
  })
})

describe('computeDynamicTimeWarping', () => {
  it('returns infinite distance for an empty sequence', () => {
    const result = computeDynamicTimeWarping([], [vector(1)])
    expect(result.totalDistance).toBe(Number.POSITIVE_INFINITY)
    expect(result.path).toHaveLength(0)
  })

  it('is zero (path length 1) for two identical single frames', () => {
    const result = computeDynamicTimeWarping([vector(1, 2)], [vector(1, 2)])
    expect(result.totalDistance).toBeCloseTo(0, 10)
    expect(result.normalizedDistance).toBeCloseTo(0, 10)
    expect(result.path).toEqual([{ queryIndex: 0, referenceIndex: 0 }])
  })

  it('aligns a stretched query to a shorter reference with low cost', () => {
    // Reference: rising ramp of scalars. Query: same shape, held (time-stretched).
    const reference = [vector(0), vector(1), vector(2), vector(3)]
    const query = [
      vector(0),
      vector(0),
      vector(1),
      vector(1),
      vector(2),
      vector(2),
      vector(3),
      vector(3),
    ]
    const warped = computeDynamicTimeWarping(query, reference)
    const naivePairwise = computeDynamicTimeWarping(
      [vector(0), vector(1), vector(2), vector(3), vector(0), vector(0), vector(0), vector(0)],
      reference,
    )

    expect(warped.totalDistance).toBeLessThan(1e-6)
    expect(warped.path.length).toBeGreaterThanOrEqual(reference.length)
    // A non-matching long query should score worse than a time-stretched match.
    expect(warped.normalizedDistance).toBeLessThan(naivePairwise.normalizedDistance)
  })

  it('gives higher distance when sequences are unrelated', () => {
    const rising = [vector(0), vector(1), vector(2), vector(3), vector(4)]
    const falling = [vector(4), vector(3), vector(2), vector(1), vector(0)]
    const same = computeDynamicTimeWarping(rising, rising)
    const opposite = computeDynamicTimeWarping(rising, falling)
    expect(opposite.normalizedDistance).toBeGreaterThan(same.normalizedDistance)
  })

  it('respects a Sakoe–Chiba band without breaking endpoint reachability', () => {
    const query = [vector(0), vector(1), vector(2), vector(3)]
    const reference = [vector(0), vector(1), vector(2), vector(3)]
    const full = computeDynamicTimeWarping(query, reference)
    const banded = computeDynamicTimeWarping(query, reference, {
      sakoeChibaRadiusInFrames: 1,
    })
    expect(banded.totalDistance).toBeCloseTo(full.totalDistance, 8)
    expect(banded.path[0]).toEqual({ queryIndex: 0, referenceIndex: 0 })
    expect(banded.path[banded.path.length - 1]).toEqual({
      queryIndex: query.length - 1,
      referenceIndex: reference.length - 1,
    })
  })

  it('aligns MFCC sequences of the same tone better than tone vs different tone', () => {
    const sampleRate = 16000
    const lowA = extractMfccSequence(
      synthesizeSineWave({
        frequencyInHertz: 160,
        sampleRateInHertz: sampleRate,
        durationSeconds: 0.2,
      }),
      sampleRate,
    ).map((frame) => frame.coefficients)
    const lowB = extractMfccSequence(
      synthesizeSineWave({
        frequencyInHertz: 160,
        sampleRateInHertz: sampleRate,
        durationSeconds: 0.28,
      }),
      sampleRate,
    ).map((frame) => frame.coefficients)
    const high = extractMfccSequence(
      synthesizeSineWave({
        frequencyInHertz: 320,
        sampleRateInHertz: sampleRate,
        durationSeconds: 0.2,
      }),
      sampleRate,
    ).map((frame) => frame.coefficients)

    const sameTone = computeDynamicTimeWarping(
      zScoreNormalizeFeatureSequence(lowA),
      zScoreNormalizeFeatureSequence(lowB),
    )
    const differentTone = computeDynamicTimeWarping(
      zScoreNormalizeFeatureSequence(lowA),
      zScoreNormalizeFeatureSequence(high),
    )

    expect(sameTone.normalizedDistance).toBeLessThan(differentTone.normalizedDistance)
  })
})

describe('convertDtwDistanceToPronunciationScore', () => {
  it('maps perfect alignment to 100', () => {
    expect(convertDtwDistanceToPronunciationScore(0)).toBe(100)
  })

  it('maps the half-score distance to about 50', () => {
    expect(convertDtwDistanceToPronunciationScore(15, { distanceAtHalfScore: 15 })).toBeCloseTo(
      50,
      5,
    )
  })

  it('returns 0 for non-finite distance', () => {
    expect(convertDtwDistanceToPronunciationScore(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('zScoreNormalizeFeatureSequence', () => {
  it('centers each coefficient and yields unit variance for non-constant dims', () => {
    const frames = [vector(1, 10), vector(2, 20), vector(3, 30)]
    const normalized = zScoreNormalizeFeatureSequence(frames)
    expect(normalized).toHaveLength(3)

    let mean0 = 0
    let mean1 = 0
    for (const frame of normalized) {
      mean0 += frame[0]!
      mean1 += frame[1]!
    }
    mean0 /= normalized.length
    mean1 /= normalized.length
    expect(mean0).toBeCloseTo(0, 8)
    expect(mean1).toBeCloseTo(0, 8)
  })
})

describe('pitch contour helpers', () => {
  it('centers voiced pitch around zero mean', () => {
    const centered = centerVoicedPitchContourInHertz([100, 120, null, 140])
    const voiced = centered.filter((value): value is number => value !== null)
    const mean = voiced.reduce((sum, value) => sum + value, 0) / voiced.length
    expect(mean).toBeCloseTo(0, 8)
    expect(centered[2]).toBeNull()
  })

  it('packs pitch into 1-D frames for DTW', () => {
    const frames = pitchContourToFeatureFrames([100, null, 110])
    expect(frames).toHaveLength(3)
    expect(frames[0]![0]).toBe(100)
    expect(frames[1]![0]).toBe(0)
    expect(frames[2]![0]).toBe(110)
  })
})
