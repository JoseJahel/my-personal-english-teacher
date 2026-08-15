import { describe, expect, it } from 'vitest'
import { applyGrammarCorrectionToLastUserMessage } from './apply-grammar-correction-to-messages'
import { createUserUtteranceMessage } from './practice-chat-messages'

describe('applyGrammarCorrectionToLastUserMessage', () => {
  it('attaches T5 output to the matching user bubble without adding a turn', () => {
    const user = createUserUtteranceMessage(
      'I would like a glass of water please',
      'I would like a glass of water please',
      'user-1',
    )
    const next = applyGrammarCorrectionToLastUserMessage(
      [user],
      'I would like a glass of water please',
      'I would like a glass of water, please.',
    )

    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe('user-1')
    expect(next[0]?.correctedText).toBe('I would like a glass of water, please.')
  })

  it('leaves messages unchanged when no matching user bubble exists', () => {
    const user = createUserUtteranceMessage('hello', 'hello', 'user-1')
    const next = applyGrammarCorrectionToLastUserMessage([user], 'other', 'Other.')
    expect(next).toEqual([user])
  })
})
