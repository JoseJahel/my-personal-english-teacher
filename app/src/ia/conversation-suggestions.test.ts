import { describe, expect, it } from 'vitest'
import {
  buildTutorReplyChatMessages,
  cleanGeneratedTutorReply,
  isPlausibleTutorReply,
  MAXIMUM_TUTOR_REPLY_CHARACTERS,
} from './conversation-suggestions'

describe('buildTutorReplyChatMessages', () => {
  it('builds a system + user pair with scenario constraints', () => {
    const messages = buildTutorReplyChatMessages({
      scenarioContextEn: 'Role-play: restaurant waiter.',
      lastTutorLineEn: 'What would you like to order?',
      userUtteranceEn: 'I would like a coffee.',
      fallbackReplyEn: 'Anything else?',
    })
    expect(messages).toHaveLength(2)
    expect(messages[0]!.content).toContain('restaurant waiter')
    expect(messages[1]!.content).toContain('I would like a coffee.')
  })
})

describe('cleanGeneratedTutorReply', () => {
  it('returns empty for blank or degenerate loops', () => {
    expect(cleanGeneratedTutorReply('   ')).toBe('')
    expect(
      cleanGeneratedTutorReply('bias bias bias bias bias bias bias bias bias'),
    ).toBe('')
  })

  it('strips chat markers and keeps at most two sentences', () => {
    const cleaned = cleanGeneratedTutorReply(
      '<|im_start|>assistant\nGreat choice. Would you like dessert? We also have cake. And pie too.<|im_end|>',
    )
    expect(cleaned.toLowerCase()).toContain('great choice')
    expect(cleaned.toLowerCase().includes('pie')).toBe(false)
  })

  it('truncates very long replies', () => {
    const long = `${'Hello there. '.repeat(40)}`
    const cleaned = cleanGeneratedTutorReply(long)
    expect(cleaned.length).toBeLessThanOrEqual(MAXIMUM_TUTOR_REPLY_CHARACTERS + 1)
  })
})

describe('isPlausibleTutorReply', () => {
  it('accepts a short natural English reply', () => {
    expect(
      isPlausibleTutorReply('Great choice. Would you like a drink?', 'I want pasta'),
    ).toBe(true)
  })

  it('rejects empty, echo, and non-English junk', () => {
    expect(isPlausibleTutorReply('', 'hello')).toBe(false)
    expect(isPlausibleTutorReply('I want pasta', 'I want pasta')).toBe(false)
    expect(isPlausibleTutorReply('!!!! ????', 'hello')).toBe(false)
    expect(
      isPlausibleTutorReply('As an AI language model I cannot help', 'hello'),
    ).toBe(false)
  })
})
