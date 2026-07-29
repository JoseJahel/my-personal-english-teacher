import { describe, expect, it } from 'vitest'
import { computeWordErrorRate } from './word-error-rate'

describe('computeWordErrorRate', () => {
  it('is zero for an identical transcript', () => {
    const result = computeWordErrorRate('the cat sat on the mat', 'the cat sat on the mat')
    expect(result).toEqual({
      substitutions: 0,
      deletions: 0,
      insertions: 0,
      referenceWordCount: 6,
      wordErrorRate: 0,
    })
  })

  it('is one when every reference word is wrong and counts match', () => {
    const result = computeWordErrorRate('one two three', 'four five six')
    expect(result.substitutions).toBe(3)
    expect(result.deletions).toBe(0)
    expect(result.insertions).toBe(0)
    expect(result.wordErrorRate).toBe(1)
  })

  it('counts a single substitution', () => {
    const result = computeWordErrorRate('the cat sat on the mat', 'the cat sit on the mat')
    expect(result.substitutions).toBe(1)
    expect(result.deletions).toBe(0)
    expect(result.insertions).toBe(0)
    expect(result.wordErrorRate).toBeCloseTo(1 / 6)
  })

  it('counts a single insertion', () => {
    const result = computeWordErrorRate('good morning', 'good very morning')
    expect(result.insertions).toBe(1)
    expect(result.substitutions).toBe(0)
    expect(result.deletions).toBe(0)
    expect(result.wordErrorRate).toBeCloseTo(1 / 2)
  })

  it('counts a single deletion', () => {
    const result = computeWordErrorRate('good morning everyone', 'good everyone')
    expect(result.deletions).toBe(1)
    expect(result.substitutions).toBe(0)
    expect(result.insertions).toBe(0)
    expect(result.wordErrorRate).toBeCloseTo(1 / 3)
  })

  it('normalizes case and punctuation before comparing', () => {
    const result = computeWordErrorRate('Hello, world!', 'hello   world')
    expect(result.wordErrorRate).toBe(0)
    expect(result.referenceWordCount).toBe(2)
  })

  it('treats an empty reference as fully wrong only if the hypothesis is non-empty', () => {
    expect(computeWordErrorRate('', '').wordErrorRate).toBe(0)
    expect(computeWordErrorRate('', 'oops').wordErrorRate).toBe(1)
  })
})
