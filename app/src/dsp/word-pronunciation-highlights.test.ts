import { describe, expect, it } from 'vitest'
import {
  buildWordPronunciationHighlights,
  classifyWordHighlightBand,
  computeMeanLocalCostPerQueryFrame,
  tokenizeEnglishWords,
} from './word-pronunciation-highlights'

describe('tokenizeEnglishWords', () => {
  it('splits on whitespace and drops empties', () => {
    expect(tokenizeEnglishWords('  Hello,  world!  ')).toEqual(['Hello,', 'world!'])
  })
})

describe('computeMeanLocalCostPerQueryFrame', () => {
  it('averages local Euclidean costs per query index on the path', () => {
    const query = [new Float32Array([0, 0]), new Float32Array([1, 0])]
    const reference = [new Float32Array([0, 0]), new Float32Array([1, 0])]
    const path = [
      { queryIndex: 0, referenceIndex: 0 },
      { queryIndex: 1, referenceIndex: 1 },
    ]
    const means = computeMeanLocalCostPerQueryFrame(query, reference, path)
    expect(means[0]).toBeCloseTo(0, 8)
    expect(means[1]).toBeCloseTo(0, 8)
  })

  it('is higher when query and reference vectors differ', () => {
    const query = [new Float32Array([0, 0]), new Float32Array([10, 0])]
    const reference = [new Float32Array([0, 0]), new Float32Array([0, 0])]
    const path = [
      { queryIndex: 0, referenceIndex: 0 },
      { queryIndex: 1, referenceIndex: 1 },
    ]
    const means = computeMeanLocalCostPerQueryFrame(query, reference, path)
    expect(means[0]!).toBeLessThan(means[1]!)
  })
})

describe('buildWordPronunciationHighlights', () => {
  it('returns one highlight per word', () => {
    const frames = new Float32Array([1, 1, 1, 1, 10, 10, 10, 10])
    const highlights = buildWordPronunciationHighlights(['good', 'bad'], frames, {
      distanceAtHalfScore: 5,
    })
    expect(highlights).toHaveLength(2)
    expect(highlights[0]!.word).toBe('good')
    expect(highlights[1]!.word).toBe('bad')
    expect(highlights[0]!.score0to100).toBeGreaterThan(highlights[1]!.score0to100)
    expect(highlights[1]!.band).toBe('poor')
  })

  it('handles a single word spanning all frames', () => {
    const highlights = buildWordPronunciationHighlights(
      ['hello'],
      new Float32Array([0, 0, 0]),
    )
    expect(highlights).toHaveLength(1)
    expect(highlights[0]!.score0to100).toBe(100)
    expect(highlights[0]!.band).toBe('good')
  })
})

describe('classifyWordHighlightBand', () => {
  it('maps scores to good / medium / poor', () => {
    expect(classifyWordHighlightBand(90)).toBe('good')
    expect(classifyWordHighlightBand(50)).toBe('medium')
    expect(classifyWordHighlightBand(20)).toBe('poor')
  })
})
