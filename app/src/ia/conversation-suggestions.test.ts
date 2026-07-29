import { describe, expect, it } from 'vitest'
import {
  buildTutorReplyChatMessages,
  cleanGeneratedTutorReply,
  isPlausibleTutorReply,
  MAXIMUM_TUTOR_REPLY_CHARACTERS,
} from './conversation-suggestions'

describe('buildTutorReplyChatMessages', () => {
  it('builds a system message plus one message per history turn and the current student line', () => {
    const messages = buildTutorReplyChatMessages({
      scenarioContextEn: 'Role-play: restaurant waiter.',
      historyTurnsEn: [
        { speaker: 'tutor', textEn: 'What would you like to order?' },
        { speaker: 'student', textEn: 'A coffee, please.' },
      ],
      userUtteranceEn: 'And a croissant too.',
      fallbackReplyEn: 'Anything else?',
    })
    expect(messages).toHaveLength(4)
    expect(messages[0]).toMatchObject({ role: 'system' })
    expect(messages[0]!.content).toContain('restaurant waiter')
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: 'What would you like to order?',
    })
    expect(messages[2]).toMatchObject({ role: 'user', content: 'A coffee, please.' })
    expect(messages[3]).toMatchObject({ role: 'user', content: 'And a croissant too.' })
  })

  it('works with an empty history window (first turn of the scenario)', () => {
    const messages = buildTutorReplyChatMessages({
      scenarioContextEn: 'Role-play: airport airline desk.',
      historyTurnsEn: [],
      userUtteranceEn: 'Where is my gate?',
      fallbackReplyEn: 'I can help with your gate.',
    })
    expect(messages).toHaveLength(2)
    expect(messages[1]).toMatchObject({ role: 'user', content: 'Where is my gate?' })
  })

  it('drops history turns whose text is blank or only whitespace', () => {
    const messages = buildTutorReplyChatMessages({
      scenarioContextEn: 'Role-play: hotel check-in.',
      historyTurnsEn: [
        { speaker: 'tutor', textEn: 'Do you have a reservation?' },
        { speaker: 'student', textEn: '   ' },
        { speaker: 'tutor', textEn: 'Great, may I see your ID?' },
      ],
      userUtteranceEn: 'Here you go.',
      fallbackReplyEn: 'Thank you.',
    })
    expect(messages).toHaveLength(4)
    expect(messages.some((message) => message.content.length === 0)).toBe(false)
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
