import { describe, expect, it } from 'vitest'
import { diffEnglishWords } from './grammar-correction-diff'

describe('diffEnglishWords', () => {
  it('returns only unchanged tokens for identical text', () => {
    const tokens = diffEnglishWords('He goes to school', 'He goes to school')

    expect(tokens).toEqual([
      { type: 'unchanged', text: 'He' },
      { type: 'unchanged', text: 'goes' },
      { type: 'unchanged', text: 'to' },
      { type: 'unchanged', text: 'school' },
    ])
  })

  it('ignores case and trailing punctuation differences (still unchanged)', () => {
    const tokens = diffEnglishWords('he goes to school', 'He goes to school.')

    expect(tokens.every((token) => token.type === 'unchanged')).toBe(true)
  })

  it('returns an empty array when both texts are empty', () => {
    expect(diffEnglishWords('', '')).toEqual([])
  })

  it('marks a single inserted word as added', () => {
    const tokens = diffEnglishWords('I like apples', 'I really like apples')

    expect(tokens).toEqual([
      { type: 'unchanged', text: 'I' },
      { type: 'added', text: 'really' },
      { type: 'unchanged', text: 'like' },
      { type: 'unchanged', text: 'apples' },
    ])
  })

  it('marks a single removed word as removed', () => {
    const tokens = diffEnglishWords('I really like apples', 'I like apples')

    expect(tokens).toEqual([
      { type: 'unchanged', text: 'I' },
      { type: 'removed', text: 'really' },
      { type: 'unchanged', text: 'like' },
      { type: 'unchanged', text: 'apples' },
    ])
  })

  it('pairs a one-word swap into substituted-old/substituted-new', () => {
    const tokens = diffEnglishWords('He go to school', 'He goes to school')

    expect(tokens).toEqual([
      { type: 'unchanged', text: 'He' },
      { type: 'substituted-old', text: 'go' },
      { type: 'substituted-new', text: 'goes' },
      { type: 'unchanged', text: 'to' },
      { type: 'unchanged', text: 'school' },
    ])
  })

  it('handles every corrected word being an addition (empty original)', () => {
    const tokens = diffEnglishWords('', 'She likes apples')

    expect(tokens).toEqual([
      { type: 'added', text: 'She' },
      { type: 'added', text: 'likes' },
      { type: 'added', text: 'apples' },
    ])
  })

  it('handles every original word being removed (empty corrected)', () => {
    const tokens = diffEnglishWords('She likes apples', '')

    expect(tokens).toEqual([
      { type: 'removed', text: 'She' },
      { type: 'removed', text: 'likes' },
      { type: 'removed', text: 'apples' },
    ])
  })
})
