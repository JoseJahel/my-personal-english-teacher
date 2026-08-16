import { describe, expect, it } from 'vitest'
import type { GrammarDiffToken } from './grammar-correction-diff'
import {
  explainDiffTokensInSpanish,
  explainGrammarCorrectionInSpanish,
} from './grammar-correction-explanation'

describe('explainGrammarCorrectionInSpanish', () => {
  it('returns an empty array when both texts are identical', () => {
    expect(explainGrammarCorrectionInSpanish('He goes to school', 'He goes to school')).toEqual([])
  })

  it('returns an empty array when both texts are empty', () => {
    expect(explainGrammarCorrectionInSpanish('', '')).toEqual([])
  })

  it('returns an empty array when the only difference is case or punctuation', () => {
    expect(explainGrammarCorrectionInSpanish('he goes to school', 'He goes to school.')).toEqual([])
  })

  it('explains an added article', () => {
    expect(explainGrammarCorrectionInSpanish('I want coffee', 'I want a coffee')).toEqual([
      'Se añadió el artículo "a".',
    ])
  })

  it('explains third-person -s agreement', () => {
    expect(explainGrammarCorrectionInSpanish('He go to school', 'He goes to school')).toEqual([
      'Concordancia de tercera persona: "go" se corrigió a "goes".',
    ])
  })

  it('explains a regular past tense correction', () => {
    expect(explainGrammarCorrectionInSpanish('I want to talk', 'I wanted to talk')).toEqual([
      'Se corrigió el tiempo verbal: "want" se corrigió a "wanted".',
    ])
  })

  it('explains a removed word', () => {
    expect(
      explainGrammarCorrectionInSpanish('I am very happy today', 'I am happy today'),
    ).toEqual(['Se eliminó la palabra "very" por ser innecesaria.'])
  })

  it('falls back to a generic explanation for an irregular verb substitution', () => {
    expect(
      explainGrammarCorrectionInSpanish('She go to school yesterday', 'She went to school yesterday'),
    ).toEqual(['Se ajustó la gramática: "go" se cambió por "went".'])
  })
})

describe('explainDiffTokensInSpanish', () => {
  it('caps at 2 explanations even when more changes are present', () => {
    const tokens: GrammarDiffToken[] = [
      { type: 'added', text: 'a' },
      { type: 'substituted-old', text: 'go' },
      { type: 'substituted-new', text: 'goes' },
      { type: 'removed', text: 'very' },
    ]

    expect(explainDiffTokensInSpanish(tokens)).toEqual([
      'Se añadió el artículo "a".',
      'Concordancia de tercera persona: "go" se corrigió a "goes".',
    ])
  })

  it('returns an empty array for an all-unchanged diff', () => {
    const tokens: GrammarDiffToken[] = [
      { type: 'unchanged', text: 'He' },
      { type: 'unchanged', text: 'goes' },
    ]

    expect(explainDiffTokensInSpanish(tokens)).toEqual([])
  })
})
