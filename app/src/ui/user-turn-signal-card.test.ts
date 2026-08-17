import { describe, expect, it } from 'vitest'
import type { PronunciationScoreResult } from '../dsp/pronunciation-score'
import { homeScreenInterfaceTexts } from './interface-texts'
import {
  attachUserTurnSignalCardToMessages,
  createUserTurnSignalCard,
  findLatestUserUtteranceId,
  formatUserTurnSignalCardViewModel,
} from './user-turn-signal-card'

function scoredResult(): PronunciationScoreResult {
  return {
    score0to100: 78.4,
    mfccScore0to100: 81,
    pitchScore0to100: 74,
    energyScore0to100: 70,
    formantScore0to100: 68,
    mfccNormalizedDistance: 0.4,
    pitchNormalizedDistance: 0.3,
    energyNormalizedDistance: 0.35,
    formantLogHertzDistance: 0.2,
    userMfccFrameCount: 40,
    referenceMfccFrameCount: 42,
    dtwPathLength: 44,
    wordHighlights: [
      { word: 'I', score0to100: 90, band: 'good', meanLocalDistance: 0.1 },
      { word: 'like', score0to100: 70, band: 'medium', meanLocalDistance: 0.3 },
      { word: 'glass', score0to100: 45, band: 'poor', meanLocalDistance: 0.55 },
      {
        word: '??',
        score0to100: 10,
        band: 'unknown',
        meanLocalDistance: 1,
      } as unknown as PronunciationScoreResult['wordHighlights'][number],
    ],
  }
}

describe('createUserTurnSignalCard', () => {
  it('copies score, band counts, and formants by value without PCM', () => {
    const formants = { f1InHertz: 520, f2InHertz: 1420, f3InHertz: 2480 }
    const card = createUserTurnSignalCard({
      pronunciation: scoredResult(),
      formants,
    })

    formants.f1InHertz = 1

    expect(card).toEqual({
      kind: 'scored',
      score0to100: 78.4,
      goodWordCount: 1,
      mediumWordCount: 1,
      poorWordCount: 1,
      wordHighlightSummary: 'I:good like:medium glass:poor ??:unknown',
      formantF1InHertz: 520,
      formantF2InHertz: 1420,
      formantF3InHertz: 2480,
    })
    expect(card).not.toHaveProperty('samples')
  })

  it('drops unknown highlight bands without discarding the rest', () => {
    const card = createUserTurnSignalCard({
      pronunciation: scoredResult(),
      formants: null,
    })
    expect(card.goodWordCount + card.mediumWordCount + card.poorWordCount).toBe(3)
  })

  it('marks conversation turns as deferred when there is no 0–100', () => {
    const card = createUserTurnSignalCard({
      pronunciation: null,
      formants: { f1InHertz: 400, f2InHertz: 1400, f3InHertz: null },
      skipReason: 'conversation-deferred-to-drill',
    })
    expect(card.kind).toBe('deferred-to-drill')
    expect(card.score0to100).toBeNull()
    expect(card.formantF3InHertz).toBeNull()
  })

  it('marks unusable speech as not-evaluated instead of a poor score', () => {
    const card = createUserTurnSignalCard({
      pronunciation: null,
      formants: null,
      skipReason: 'low-energy',
    })
    expect(card.kind).toBe('not-evaluated')
    expect(card.wordHighlightSummary).toBe('')
  })
})

describe('formatUserTurnSignalCardViewModel', () => {
  const copy = homeScreenInterfaceTexts.practiceChat.signalCard

  it('formats a scored card with highlight bands and formants', () => {
    const view = formatUserTurnSignalCardViewModel(
      createUserTurnSignalCard({
        pronunciation: scoredResult(),
        formants: { f1InHertz: 520, f2InHertz: 1420, f3InHertz: 2480 },
      }),
    )
    expect(view.title).toBe(copy.title)
    expect(view.scoreLine).toBe(copy.scoreScored(78.4))
    expect(view.highlightLine).toBe(copy.highlights(1, 1, 1))
    expect(view.formantsLine).toContain('520')
    expect(view.formantsLine).toContain('1420')
  })

  it('uses honest copy when conversation score is deferred', () => {
    const view = formatUserTurnSignalCardViewModel(
      createUserTurnSignalCard({
        pronunciation: null,
        formants: null,
        skipReason: 'conversation-deferred-to-drill',
      }),
    )
    expect(view.scoreLine).toBe(copy.scoreDeferred)
    expect(view.highlightLine).toBe(copy.highlightsEmpty)
    expect(view.formantsLine).toBe(copy.formantsUnavailable)
  })

  it('does not present missing speech as a low score', () => {
    const view = formatUserTurnSignalCardViewModel(
      createUserTurnSignalCard({
        pronunciation: null,
        formants: null,
        skipReason: 'non-speech-transcript',
      }),
    )
    expect(view.scoreLine).toBe(copy.scoreNotEvaluated)
  })
})

describe('attachUserTurnSignalCardToMessages', () => {
  it('patches only the matching message and leaves others untouched', () => {
    const card = createUserTurnSignalCard({
      pronunciation: null,
      formants: null,
      skipReason: 'conversation-deferred-to-drill',
    })
    const messages = [
      { id: 'u1', kind: 'user-utterance', text: 'one' },
      { id: 't1', kind: 'tutor-reply', text: 'two' },
    ]
    const next = attachUserTurnSignalCardToMessages(messages, 'u1', card)
    expect(next[0]).toMatchObject({ id: 'u1', signalCard: card })
    expect(next[1]).toEqual(messages[1])
    expect(next[1]).not.toHaveProperty('signalCard')
  })
})

describe('findLatestUserUtteranceId', () => {
  it('returns the last user utterance even when a tutor reply follows', () => {
    expect(
      findLatestUserUtteranceId([
        { id: 'u1', kind: 'user-utterance' },
        { id: 't1', kind: 'tutor-reply' },
        { id: 'u2', kind: 'user-utterance' },
        { id: 't2', kind: 'tutor-reply' },
      ]),
    ).toBe('u2')
  })
})
