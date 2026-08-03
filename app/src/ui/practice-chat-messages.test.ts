import { describe, expect, it } from 'vitest'
import {
  buildInitialChatMessagesForScenario,
  buildRecentHistoryTurnsEn,
  createTutorReplyMessage,
  createUserUtteranceMessage,
  findLastTutorLineText,
} from './practice-chat-messages'
import { getPracticeScenarioById } from './practice-scenarios'

describe('practice-chat-messages', () => {
  const restaurant = getPracticeScenarioById('restaurant')

  it('starts a scenario with a single tutor intro message', () => {
    const messages = buildInitialChatMessagesForScenario(restaurant, 'msg-1')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      id: 'msg-1',
      role: 'tutor',
      kind: 'scenario-intro',
      text: restaurant.tutorOpeningLineEn,
    })
  })

  it('stores corrected grammar only when it differs from ASR text', () => {
    const unchanged = createUserUtteranceMessage(
      'I would like water.',
      'I would like water.',
      'u1',
    )
    expect(unchanged.correctedText).toBeUndefined()

    const changed = createUserUtteranceMessage(
      'I want water please',
      'I would like water, please.',
      'u2',
    )
    expect(changed.correctedText).toBe('I would like water, please.')
    expect(changed.text).toBe('I want water please')
  })

  it('marks generated vs fallback tutor replies', () => {
    const generated = createTutorReplyMessage('Anything else to drink?', 't2', false)
    expect(generated.kind).toBe('tutor-reply')
    const fallback = createTutorReplyMessage(restaurant.tutorFollowUpPlaceholderEn, 't3', true)
    expect(fallback.kind).toBe('tutor-fallback')
  })

  it('finds the last tutor line for generation context', () => {
    const messages = [
      ...buildInitialChatMessagesForScenario(restaurant, 'i1'),
      createUserUtteranceMessage('Coffee please', 'Coffee please', 'u1'),
      createTutorReplyMessage('Would you like milk?', 't2', false),
    ]
    expect(findLastTutorLineText(messages)).toBe('Would you like milk?')
  })
})

describe('buildRecentHistoryTurnsEn', () => {
  const restaurant = getPracticeScenarioById('restaurant')

  it('maps tutor/user chat messages to speaker turns, oldest first', () => {
    const messages = [
      ...buildInitialChatMessagesForScenario(restaurant, 'i1'),
      createUserUtteranceMessage('Coffee please', 'Coffee please', 'u1'),
      createTutorReplyMessage('Anything else?', 't1', false),
    ]
    const turns = buildRecentHistoryTurnsEn(messages)
    expect(turns).toEqual([
      { speaker: 'tutor', textEn: restaurant.tutorOpeningLineEn },
      { speaker: 'student', textEn: 'Coffee please' },
      { speaker: 'tutor', textEn: 'Anything else?' },
    ])
  })

  it('keeps only the last 4 turns (2 pairs), oldest of the kept window first', () => {
    const messages = [
      ...buildInitialChatMessagesForScenario(restaurant, 'i1'),
      createUserUtteranceMessage('one', 'one', 'u1'),
      createTutorReplyMessage('reply one', 't1', false),
      createUserUtteranceMessage('two', 'two', 'u2'),
      createTutorReplyMessage('reply two', 't2', false),
      createUserUtteranceMessage('three', 'three', 'u3'),
      createTutorReplyMessage('reply three', 't3', false),
    ]
    const turns = buildRecentHistoryTurnsEn(messages)
    expect(turns).toHaveLength(4)
    expect(turns.map((turn) => turn.textEn)).toEqual(['two', 'reply two', 'three', 'reply three'])
  })

  it('prefers corrected grammar text for student turns when it differs from the ASR transcript', () => {
    const corrected = createUserUtteranceMessage('i has coffee', 'I have coffee', 'u1')
    expect(corrected.correctedText).toBe('I have coffee')
    const turns = buildRecentHistoryTurnsEn([corrected])
    expect(turns).toEqual([{ speaker: 'student', textEn: 'I have coffee' }])
  })

  it('falls back to the transcribed text when no grammar correction was applied', () => {
    const unchanged = createUserUtteranceMessage('Coffee please', 'Coffee please', 'u1')
    expect(unchanged.correctedText).toBeUndefined()
    const turns = buildRecentHistoryTurnsEn([unchanged])
    expect(turns).toEqual([{ speaker: 'student', textEn: 'Coffee please' }])
  })
})

