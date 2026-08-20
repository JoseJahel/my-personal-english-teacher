import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildCompletarItems,
  extractModelPhrases,
  extractVocabPairs,
  vocabToFlashcards,
} from './extract-practice-items'

afterEach(() => {
  vi.restoreAllMocks()
})

const FIXTURE = `---
id: fixture-1a
title: Fixture
---

## Vocabulario

- **hello** — hola
- **goodbye** — adiós
- **please** — por favor
- **thanks** — gracias
- **not a pair**
- **   ** — vacío

## Frases modelo

Helen y Tom se encuentran:

- Hello, please.
- Tom: Goodbye and thanks.
- recepción de hotel → *a passport*
- ¿Cómo te llamas?
`

describe('extractVocabPairs', () => {
  it('reads **en** — es list items and drops broken lines', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const pairs = extractVocabPairs(FIXTURE, 'besingular', 'fixture-1a')
    expect(pairs.map((pair) => pair.en)).toEqual(['hello', 'goodbye', 'please', 'thanks'])
    expect(pairs[0]?.es).toBe('hola')
    expect(pairs[0]?.tema).toBe('besingular')
    expect(warn).toHaveBeenCalled()
  })

  it('returns no pairs when tema is invalid', () => {
    expect(extractVocabPairs(FIXTURE, 'be_singular', 'fixture-1a')).toEqual([])
  })
})

describe('extractModelPhrases', () => {
  it('keeps English list lines and skips Spanish or labelled scene lines', () => {
    expect(extractModelPhrases(FIXTURE)).toEqual(['Hello, please.', 'Goodbye and thanks.'])
  })
})

describe('buildCompletarItems / flashcards', () => {
  it('gaps one vocab word and needs at least two distractors', () => {
    const pairs = extractVocabPairs(FIXTURE, 'besingular', 'fixture-1a')
    const cards = vocabToFlashcards(pairs)
    expect(cards[0]).toMatchObject({
      kind: 'vocab',
      frontEs: 'hola',
      backEn: 'hello',
    })
    const phrases = extractModelPhrases(FIXTURE)
    const items = buildCompletarItems(phrases, pairs, 'besingular', 'fixture-1a')
    expect(items.length).toBeGreaterThan(0)
    const first = items[0]
    expect(first?.phrase).toContain('___')
    expect(first?.options.length).toBeGreaterThanOrEqual(3)
    expect(first?.options[first.correctIndex]).toBeTruthy()
    expect(first?.options.filter((option) => option === first.options[first.correctIndex])).toHaveLength(
      1,
    )
  })

  it('omits a phrase when there are not enough distractors', () => {
    const tiny = extractVocabPairs('- **hello** — hola\n- **please** — por favor\n', 'besingular', 'x')
    const items = buildCompletarItems(['Hello, please.'], tiny, 'besingular', 'x')
    expect(items).toEqual([])
  })
})
