import {
  resolvePracticeFacing,
  type PracticeDirection,
  type PracticeFacing,
} from './practice-direction'
import type { PracticeMode } from './study-types'

export type PracticeGrade = 'correct' | 'incorrect'

export interface PracticeSessionState {
  readonly mode: PracticeMode
  readonly tema: string | null
  readonly index: number
  readonly revealed: boolean
  readonly grade: PracticeGrade | null
  readonly direction: PracticeDirection
  readonly facing: PracticeFacing
}

export function createPracticeSession(
  mode: PracticeMode = 'vocab',
  tema: string | null = null,
): PracticeSessionState {
  return {
    mode,
    tema,
    index: 0,
    revealed: false,
    grade: null,
    direction: 'es-en',
    facing: 'es-en',
  }
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

export function selectPracticeDirection(
  state: PracticeSessionState,
  direction: PracticeDirection,
  random?: () => number,
): PracticeSessionState {
  if (direction === state.direction) {
    return state
  }
  return {
    ...state,
    direction,
    facing: resolvePracticeFacing(direction, random),
    revealed: false,
    grade: null,
  }
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
  nextIndex: number,
  random?: () => number,
  facing?: PracticeFacing | null,
): PracticeSessionState {
  if (!Number.isInteger(nextIndex) || nextIndex < 0) {
    if (!state.revealed && state.grade === null) {
      return state
    }
    return { ...state, revealed: false, grade: null }
  }
  return {
    ...state,
    index: nextIndex,
    revealed: false,
    grade: null,
    facing: facing ?? resolvePracticeFacing(state.direction, random),
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
  nextIndex: number,
  random?: () => number,
  facing?: PracticeFacing | null,
): PracticeSessionState {
  if (!Number.isInteger(chosenIndex) || chosenIndex < 0) {
    return state
  }
  if (chosenIndex === correctIndex) {
    return goToNextPracticeItem(
      { ...state, grade: 'correct', revealed: true },
      nextIndex,
      random,
      facing,
    )
  }
  return { ...state, grade: 'incorrect', revealed: true }
}

export function checkWrittenAnswer(
  state: PracticeSessionState,
  raw: string,
  expected: string,
  nextIndex: number,
  random?: () => number,
  facing?: PracticeFacing | null,
): PracticeSessionState {
  if (raw.trim().length === 0) {
    return state
  }
  if (practiceAnswersMatch(raw, expected)) {
    return goToNextPracticeItem(
      { ...state, grade: 'correct', revealed: true },
      nextIndex,
      random,
      facing,
    )
  }
  return { ...state, grade: 'incorrect', revealed: true }
}

export function rateVocabAndNext(
  state: PracticeSessionState,
  nextIndex: number,
  knew: boolean,
  random?: () => number,
  facing?: PracticeFacing | null,
): PracticeSessionState {
  if (!state.revealed) {
    return state
  }
  void knew
  return goToNextPracticeItem(state, nextIndex, random, facing)
}
