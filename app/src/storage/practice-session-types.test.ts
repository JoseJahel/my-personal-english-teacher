import { describe, expect, it } from 'vitest'
import {
  createPracticeSessionRecord,
  createPracticeTurnRecord,
  summarizeWordHighlights,
} from './practice-session-types'

describe('practice-session-types', () => {
  it('creates a session for a scenario', () => {
    const session = createPracticeSessionRecord('restaurant', {
      id: 'session-1',
      createdAtIso: '2026-07-24T12:00:00.000Z',
    })
    expect(session).toEqual({
      id: 'session-1',
      createdAtIso: '2026-07-24T12:00:00.000Z',
      updatedAtIso: '2026-07-24T12:00:00.000Z',
      scenarioId: 'restaurant',
    })
  })

  it('creates a turn without storing audio', () => {
    const turn = createPracticeTurnRecord(
      {
        sessionId: 'session-1',
        scenarioId: 'airport',
        transcribedText: 'I need my bag',
        correctedText: 'I need my bag.',
        tutorReplyText: 'Do you have your boarding pass?',
        tutorUsedFallback: false,
        pronunciationScore0to100: 72.5,
        mfccScore0to100: 70,
        pitchScore0to100: 80,
        formantF1InHertz: 500,
        formantF2InHertz: 1500,
        formantF3InHertz: 2500,
        wordHighlights: [
          { word: 'I', score0to100: 90, band: 'good' },
          { word: 'need', score0to100: 40, band: 'poor' },
        ],
      },
      { id: 'turn-1', createdAtIso: '2026-07-24T12:01:00.000Z' },
    )

    expect(turn.id).toBe('turn-1')
    expect(turn.sessionId).toBe('session-1')
    expect(turn.wordHighlightSummary).toBe('I:good need:poor')
    expect(turn).not.toHaveProperty('samples')
    expect(turn).not.toHaveProperty('audio')
  })

  it('summarizes word highlights', () => {
    expect(summarizeWordHighlights([])).toBe('')
    expect(
      summarizeWordHighlights([
        { word: 'hello', band: 'good' },
        { word: 'world', band: 'medium' },
      ]),
    ).toBe('hello:good world:medium')
  })
})
