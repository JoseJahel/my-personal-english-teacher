import { describe, expect, it } from 'vitest'
import { applyGrammarCorrectionToLastUserMessage } from './apply-grammar-correction-to-messages'
import { createUserUtteranceMessage } from './practice-chat-messages'
import { createUserTurnSignalCard } from './user-turn-signal-card'

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

  it('keeps an existing signal card when T5 patches the same bubble', () => {
    const signalCard = createUserTurnSignalCard({
      pronunciation: null,
      formants: { f1InHertz: 500, f2InHertz: 1500, f3InHertz: 2500 },
      skipReason: 'conversation-deferred-to-drill',
    })
    const user = createUserUtteranceMessage(
      'I would like a glass of water please',
      'I would like a glass of water please',
      'user-1',
      { signalCard },
    )
    const next = applyGrammarCorrectionToLastUserMessage(
      [user],
      'I would like a glass of water please',
      'I would like a glass of water, please.',
    )
    expect(next[0]?.signalCard).toEqual(signalCard)
    expect(next[0]?.correctedText).toBe('I would like a glass of water, please.')
  })

  it('leaves messages unchanged when no matching user bubble exists', () => {
    const user = createUserUtteranceMessage('hello', 'hello', 'user-1')
    const next = applyGrammarCorrectionToLastUserMessage([user], 'other', 'Other.')
    expect(next).toEqual([user])
  })
})
