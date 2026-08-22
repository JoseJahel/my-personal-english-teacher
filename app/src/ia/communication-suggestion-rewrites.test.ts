import { describe, expect, it } from 'vitest'
import { analyzePracticeUtterance } from './communication-suggestion-analysis'
import { nounPhraseForOrder, rewriteAsNative } from './communication-suggestion-rewrites'

describe('nounPhraseForOrder', () => {
  it('keeps an existing determiner and does not turn water into a water', () => {
    expect(nounPhraseForOrder('a glass of water')).toBe('a glass of water')
    expect(nounPhraseForOrder('water')).toBe('some water')
    expect(nounPhraseForOrder('coffee')).toBe('a coffee')
  })
})

describe('rewriteAsNative', () => {
  it('rewrites a polite water order into a could-I-have line about water', () => {
    const rewrite = rewriteAsNative(
      analyzePracticeUtterance({
        scenarioId: 'restaurant',
        userUtteranceEn: 'I would like a glass of water please',
        correctedUtteranceEn: 'I would like a glass of water, please.',
      }),
    )
    expect(rewrite).toMatch(/glass of water/i)
    expect(rewrite).toMatch(/could i have/i)
  })

  it('does not invent coffee when the student asked for pizza', () => {
    const rewrite = rewriteAsNative(
      analyzePracticeUtterance({
        scenarioId: 'restaurant',
        userUtteranceEn: 'Give me pizza',
        correctedUtteranceEn: 'Give me pizza',
      }),
    )
    expect(rewrite).toMatch(/pizza/i)
    expect(rewrite).not.toMatch(/coffee|water/i)
  })

  it('completes yes from the waiter asking about a drink', () => {
    const rewrite = rewriteAsNative(
      analyzePracticeUtterance({
        scenarioId: 'restaurant',
        userUtteranceEn: 'Yes',
        correctedUtteranceEn: 'Yes',
        lastTutorLineEn: 'Would you like something to drink with that?',
      }),
    )
    expect(rewrite).toMatch(/drink/i)
  })

  it('does not glue Could you tell me onto Hello, who are you', () => {
    const rewrite = rewriteAsNative(
      analyzePracticeUtterance({
        scenarioId: 'restaurant',
        userUtteranceEn: 'Hello, who are you?',
        correctedUtteranceEn: 'Hello, who are you?',
      }),
    )
    expect(rewrite.toLowerCase()).not.toContain('tell me hello')
    expect(rewrite.toLowerCase()).not.toMatch(/^could you tell me hello/)
    expect(rewrite.toLowerCase()).not.toContain('speaking with')
  })

  it('softens who are you into an in-person name request, not phone register', () => {
    const rewrite = rewriteAsNative(
      analyzePracticeUtterance({
        scenarioId: 'restaurant',
        userUtteranceEn: 'Hello, who are you?',
        correctedUtteranceEn: 'Hello, who are you?',
      }),
    )
    expect(rewrite.toLowerCase()).not.toContain('speaking with')
    expect(rewrite).toMatch(/catch your name/i)
  })

  it('applies the same who+BE transform to any subject, not a hardcoded you-line', () => {
    const rewrite = rewriteAsNative(
      analyzePracticeUtterance({
        scenarioId: 'restaurant',
        userUtteranceEn: 'Who is the manager?',
        correctedUtteranceEn: 'Who is the manager?',
      }),
    )
    expect(rewrite).toMatch(/manager/i)
    expect(rewrite.toLowerCase()).not.toContain('speaking with')
    expect(rewrite).not.toMatch(/who are you/i)
  })

  it('keeps How are you as a complete question', () => {
    const rewrite = rewriteAsNative(
      analyzePracticeUtterance({
        scenarioId: 'restaurant',
        userUtteranceEn: 'How are you?',
        correctedUtteranceEn: 'How are you?',
      }),
    )
    expect(rewrite.toLowerCase()).not.toContain('tell me how')
    expect(rewrite).toMatch(/how are you/i)
  })
})
