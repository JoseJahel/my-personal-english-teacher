import { describe, expect, it } from 'vitest'
import {
  buildCommunicationSuggestions,
  normalizeUtteranceForComparison,
  suggestionReferencesUtterance,
} from './communication-suggestions'

const FORBIDDEN_GENERIC_SNIPPETS = [
  'and", "but", or "because"',
  'quite short — try adding one more detail',
  'Could I have a coffee, please?',
  'Thank you for the opportunity',
  'Native speakers often end requests with "please"',
]

function tipsFor(
  userUtteranceEn: string,
  extras?: {
    readonly scenarioId?: 'restaurant' | 'airport' | 'job-interview'
    readonly correctedUtteranceEn?: string
    readonly lastTutorLineEn?: string
  },
) {
  return buildCommunicationSuggestions({
    scenarioId: extras?.scenarioId ?? 'restaurant',
    userUtteranceEn,
    correctedUtteranceEn: extras?.correctedUtteranceEn ?? userUtteranceEn,
    userTurnIndex: 0,
    lastTutorLineEn: extras?.lastTutorLineEn,
  })
}

describe('normalizeUtteranceForComparison', () => {
  it('ignores case and punctuation so a comma-only grammar fix is not a new phrase', () => {
    expect(
      normalizeUtteranceForComparison('I would like a glass of water please'),
    ).toBe(normalizeUtteranceForComparison('I would like a glass of water, please.'))
  })
})

describe('buildCommunicationSuggestions', () => {
  it('returns 1–3 tips and every tip is about the spoken sentence', () => {
    const suggestions = tipsFor('I would like a glass of water please')
    expect(suggestions.length).toBeGreaterThanOrEqual(1)
    expect(suggestions.length).toBeLessThanOrEqual(3)
    for (const suggestion of suggestions) {
      expect(suggestionReferencesUtterance(suggestion, 'I would like a glass of water please')).toBe(
        true,
      )
      expect(suggestion.youSaidEn.toLowerCase()).toContain('water')
    }
  })

  it('does not emit leftover generic filler', () => {
    const spoken = 'I would like a glass of water please'
    const blob = tipsFor(spoken)
      .map((item) => `${item.text} ${item.tryThisEn ?? ''}`)
      .join('\n')
    for (const banned of FORBIDDEN_GENERIC_SNIPPETS) {
      if (banned.includes('coffee')) {
        expect(blob.toLowerCase()).not.toContain('coffee')
        continue
      }
      expect(blob).not.toContain(banned)
    }
  })

  it('rewrites the water order instead of suggesting coffee', () => {
    const suggestions = tipsFor('I would like a glass of water please')
    const naturalness = suggestions.find((item) => item.type === 'naturalidad')
    expect(naturalness?.tryThisEn).toMatch(/glass of water/i)
    expect(naturalness?.tryThisEn).not.toMatch(/coffee/i)
  })

  it('quotes I want and rewrites that same order', () => {
    const suggestions = tipsFor('I want a coffee')
    expect(suggestions.some((item) => item.type === 'vocabulario')).toBe(true)
    expect(
      suggestions.some((item) => item.tryThisEn?.toLowerCase().includes('coffee')),
    ).toBe(true)
    expect(suggestions.every((item) => !/water/i.test(item.tryThisEn ?? ''))).toBe(true)
  })

  it('turns a one-word restaurant order into a polite request for that item', () => {
    const suggestions = tipsFor('Water?')
    expect(suggestions[0]?.tryThisEn).toMatch(/water/i)
    expect(suggestions[0]?.tryThisEn).not.toMatch(/coffee|gate/i)
    expect(suggestions.some((item) => item.type === 'fluidez' || item.type === 'naturalidad')).toBe(
      true,
    )
  })

  it('expands a short airport gate question using the word gate', () => {
    const suggestions = tipsFor('Gate?', { scenarioId: 'airport' })
    expect(suggestions.some((item) => /gate/i.test(item.tryThisEn ?? ''))).toBe(true)
    expect(suggestions.every((item) => !/coffee/i.test(`${item.text} ${item.tryThisEn}`))).toBe(true)
  })

  it('keeps the interview topic the student actually named', () => {
    const suggestions = tipsFor('I have experience with teams', {
      scenarioId: 'job-interview',
    })
    expect(suggestions.some((item) => /teams/i.test(item.tryThisEn ?? ''))).toBe(true)
    expect(suggestions.every((item) => suggestionReferencesUtterance(item, 'I have experience with teams'))).toBe(
      true,
    )
  })

  it('completes a yes using the tutor’s last question', () => {
    const suggestions = tipsFor('Yes', {
      lastTutorLineEn: 'Great choice. Would you like something to drink with that?',
    })
    expect(suggestions.some((item) => /drink/i.test(item.tryThisEn ?? ''))).toBe(true)
    expect(suggestions[0]?.youSaidEn).toMatch(/^Yes$/i)
  })

  it('does not recommend Could you tell me Hello, who are you', () => {
    const suggestions = tipsFor('Hello, who are you?')
    const blob = suggestions
      .map((item) => `${item.text} ${item.tryThisEn ?? ''}`)
      .join('\n')
    expect(blob.toLowerCase()).not.toContain('tell me hello')
    expect(blob.toLowerCase()).not.toContain('speaking with')
    const naturalness = suggestions.find((item) => item.type === 'naturalidad')
    expect(naturalness?.tryThisEn).toMatch(/catch your name/i)
    expect(naturalness?.text.toLowerCase()).not.toContain('catch your name')
    expect(suggestions.every((item) => item.type !== 'fluidez')).toBe(true)
  })

  it('explains a real T5 rewrite with both versions of the phrase', () => {
    const suggestions = tipsFor('I want water', {
      correctedUtteranceEn: 'I would like some water.',
    })
    const vocab = suggestions.find((item) => item.type === 'vocabulario')
    expect(vocab?.youSaidEn).toMatch(/I want water/i)
    expect(`${vocab?.text} ${vocab?.tryThisEn}`).toMatch(/water/i)
  })
})
