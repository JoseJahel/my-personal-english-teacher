/**
 * Habit stats from already-persisted practice turns (issue #72).
 * Local calendar days only — no network, no leaderboard.
 */

import { CALIBRATED_HIGHLIGHT_GOOD_SCORE_THRESHOLD } from '../dsp/pronunciation-score-calibration-constants'
import type { PracticeTurnRecord } from '../storage/practice-session-types'

export const PRACTICE_HISTORY_LIST_LIMIT = 10
export const PRACTICE_HABIT_TURN_LIMIT = 90

export interface PracticeHabits {
  readonly streakDays: number
  readonly goodTurnCount: number
  readonly scoredTurnCount: number
  readonly averageScore0to100: number | null
  readonly turnCount: number
}

export function calendarDayKeyFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calendarDayKeyFromIso(iso: string): string | null {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return calendarDayKeyFromDate(parsed)
}

export function computeConsecutiveDayStreak(
  uniqueDayKeysNewestFirst: readonly string[],
  todayKey: string,
): number {
  if (uniqueDayKeysNewestFirst.length === 0) {
    return 0
  }

  const startKey =
    uniqueDayKeysNewestFirst[0] === todayKey
      ? todayKey
      : uniqueDayKeysNewestFirst[0] === shiftDayKey(todayKey, -1)
        ? shiftDayKey(todayKey, -1)
        : null
  if (!startKey) {
    return 0
  }

  let streak = 0
  let expected = startKey
  for (const dayKey of uniqueDayKeysNewestFirst) {
    if (dayKey !== expected) {
      break
    }
    streak += 1
    expected = shiftDayKey(expected, -1)
  }
  return streak
}

export function computePracticeHabits(
  turns: readonly PracticeTurnRecord[],
  now: Date = new Date(),
  goodScoreThreshold: number = CALIBRATED_HIGHLIGHT_GOOD_SCORE_THRESHOLD,
): PracticeHabits {
  const scores = turns
    .map((turn) => turn.pronunciationScore0to100)
    .filter((score): score is number => score !== null)
  const goodTurnCount = scores.filter((score) => score >= goodScoreThreshold).length
  const averageScore0to100 =
    scores.length === 0
      ? null
      : scores.reduce((sum, score) => sum + score, 0) / scores.length

  const uniqueDays = uniqueSortedDayKeys(turns)
  return {
    streakDays: computeConsecutiveDayStreak(uniqueDays, calendarDayKeyFromDate(now)),
    goodTurnCount,
    scoredTurnCount: scores.length,
    averageScore0to100,
    turnCount: turns.length,
  }
}

function uniqueSortedDayKeys(turns: readonly PracticeTurnRecord[]): string[] {
  const days = new Set<string>()
  for (const turn of turns) {
    const dayKey = calendarDayKeyFromIso(turn.createdAtIso)
    if (dayKey) {
      days.add(dayKey)
    }
  }
  return [...days].sort((left, right) => (left < right ? 1 : left > right ? -1 : 0))
}

function shiftDayKey(dayKey: string, dayDelta: number): string {
  const [yearText, monthText, dayText] = dayKey.split('-')
  const shifted = new Date(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText) + dayDelta,
  )
  return calendarDayKeyFromDate(shifted)
}
