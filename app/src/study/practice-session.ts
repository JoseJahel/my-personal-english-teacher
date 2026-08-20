import type { PracticeMode } from './study-types'

export type PracticeGrade = 'correct' | 'incorrect'

export interface PracticeSessionState {
  readonly mode: PracticeMode
  readonly tema: string | null
  readonly index: number
  readonly revealed: boolean
  readonly grade: PracticeGrade | null
}

export function createPracticeSession(
  mode: PracticeMode = 'vocab',
  tema: string | null = null,
): PracticeSessionState {
  return { mode, tema, index: 0, revealed: false, grade: null }
}

export function selectPracticeMode(
  state: PracticeSessionState,
  mode: PracticeMode,
): PracticeSessionState {
  if (mode === state.mode) {
    return state
  }
  return { ...state, mode, index: 0, revealed: false, grade: null }
}

export function selectPracticeTema(
  state: PracticeSessionState,
  tema: string | null,
): PracticeSessionState {
  if (tema === state.tema) {
    return state
  }
  return { ...state, tema, index: 0, revealed: false, grade: null }
}

export function revealPracticeItem(state: PracticeSessionState): PracticeSessionState {
  if (state.revealed) {
    return state
  }
  return { ...state, revealed: true }
}

export function goToNextPracticeItem(
  state: PracticeSessionState,
  itemCount: number,
): PracticeSessionState {
  if (itemCount <= 0) {
    return state
  }
  return {
    ...state,
    index: (state.index + 1) % itemCount,
    revealed: false,
    grade: null,
  }
}

export function currentPracticeIndex(state: PracticeSessionState, itemCount: number): number {
  if (itemCount <= 0) {
    return 0
  }
  return ((state.index % itemCount) + itemCount) % itemCount
}

export function normalizePracticeAnswer(raw: string): string {
  return raw.trim().toLowerCase().replace(/[.!?…]+$/u, '').replace(/\s+/g, ' ')
}

export function practiceAnswersMatch(input: string, expected: string): boolean {
  const left = normalizePracticeAnswer(input)
  const right = normalizePracticeAnswer(expected)
  return left.length > 0 && left === right
}

export function checkCompletarChoice(
  state: PracticeSessionState,
  chosenIndex: number,
  correctIndex: number,
  itemCount: number,
): PracticeSessionState {
  if (!Number.isInteger(chosenIndex) || chosenIndex < 0) {
    return state
  }
  if (chosenIndex === correctIndex) {
    return goToNextPracticeItem({ ...state, grade: 'correct', revealed: true }, itemCount)
  }
  return { ...state, grade: 'incorrect', revealed: true }
}

export function checkWrittenAnswer(
  state: PracticeSessionState,
  raw: string,
  expected: string,
  itemCount: number,
): PracticeSessionState {
  if (raw.trim().length === 0) {
    return state
  }
  if (practiceAnswersMatch(raw, expected)) {
    return goToNextPracticeItem({ ...state, grade: 'correct', revealed: true }, itemCount)
  }
  return { ...state, grade: 'incorrect', revealed: true }
}

export function rateVocabAndNext(
  state: PracticeSessionState,
  itemCount: number,
): PracticeSessionState {
  if (!state.revealed || itemCount <= 0) {
    return state
  }
  return goToNextPracticeItem(state, itemCount)
}
