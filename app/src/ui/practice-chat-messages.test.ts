import { describe, expect, it } from 'vitest'
import {
  buildInitialChatMessagesForScenario,
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

