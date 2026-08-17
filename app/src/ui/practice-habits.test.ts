import { describe, expect, it } from 'vitest'
import { CALIBRATED_HIGHLIGHT_GOOD_SCORE_THRESHOLD } from '../dsp/pronunciation-score-calibration-constants'
import type { PracticeTurnRecord } from '../storage/practice-session-types'
import {
  calendarDayKeyFromDate,
  computeConsecutiveDayStreak,
  computePracticeHabits,
} from './practice-habits'

function turnOn(iso: string, score: number | null = 80): PracticeTurnRecord {
  return {
    id: iso,
    sessionId: 'session-1',
    createdAtIso: iso,
    scenarioId: 'restaurant',
    transcribedText: 'hello',
    correctedText: 'hello',
    tutorReplyText: 'hi',
    tutorUsedFallback: false,
    pronunciationScore0to100: score,
    mfccScore0to100: score,
    pitchScore0to100: null,
    formantF1InHertz: null,
    formantF2InHertz: null,
    formantF3InHertz: null,
    wordHighlightSummary: '',
    spokenProgress: null,
  }
}

describe('calendarDayKeyFromDate', () => {
  it('splits a local midnight pair into two calendar days', () => {
    const beforeMidnight = new Date(2026, 7, 16, 23, 30, 0)
    const afterMidnight = new Date(2026, 7, 17, 0, 30, 0)
    expect(calendarDayKeyFromDate(beforeMidnight)).toBe('2026-08-16')
    expect(calendarDayKeyFromDate(afterMidnight)).toBe('2026-08-17')
  })
})

describe('computeConsecutiveDayStreak', () => {
  it('returns 0 when there are no practice days', () => {
    expect(computeConsecutiveDayStreak([], '2026-08-17')).toBe(0)
  })

  it('counts today plus the previous consecutive days', () => {
    expect(
      computeConsecutiveDayStreak(['2026-08-17', '2026-08-16', '2026-08-15'], '2026-08-17'),
    ).toBe(3)
  })

  it('keeps yesterday’s streak when today has no turn yet', () => {
    expect(computeConsecutiveDayStreak(['2026-08-16', '2026-08-15'], '2026-08-17')).toBe(2)
  })

  it('stops at a calendar gap', () => {
    expect(
      computeConsecutiveDayStreak(['2026-08-17', '2026-08-15', '2026-08-14'], '2026-08-17'),
    ).toBe(1)
  })

  it('is zero when the latest turn is older than yesterday', () => {
    expect(computeConsecutiveDayStreak(['2026-08-14'], '2026-08-17')).toBe(0)
  })
})

describe('computePracticeHabits', () => {
  it('counts good scores with the calibrated highlight threshold', () => {
    const now = new Date(2026, 7, 17, 18, 0, 0)
    const habits = computePracticeHabits(
      [
        turnOn(new Date(2026, 7, 17, 15).toISOString(), CALIBRATED_HIGHLIGHT_GOOD_SCORE_THRESHOLD),
        turnOn(new Date(2026, 7, 17, 16).toISOString(), CALIBRATED_HIGHLIGHT_GOOD_SCORE_THRESHOLD - 1),
        turnOn(new Date(2026, 7, 17, 17).toISOString(), null),
      ],
      now,
    )
    expect(habits.turnCount).toBe(3)
    expect(habits.scoredTurnCount).toBe(2)
    expect(habits.goodTurnCount).toBe(1)
    expect(habits.streakDays).toBe(1)
  })

  it('does not double-count two turns on the same local day in the streak', () => {
    const now = new Date(2026, 7, 17, 18, 0, 0)
    const habits = computePracticeHabits(
      [
        turnOn(new Date(2026, 7, 17, 10).toISOString()),
        turnOn(new Date(2026, 7, 17, 22).toISOString()),
      ],
      now,
    )
    expect(habits.streakDays).toBe(1)
  })
})
