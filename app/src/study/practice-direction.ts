import type { TraducirPracticeItem, VocabPracticeItem } from './study-types'

export type PracticeDirection = 'es-en' | 'en-es' | 'mixed'
export type PracticeFacing = 'es-en' | 'en-es'

export const PRACTICE_DIRECTIONS = ['es-en', 'en-es', 'mixed'] as const

export function isBilingualPracticeMode(mode: string): boolean {
  return mode === 'vocab' || mode === 'traducir'
}

export function resolvePracticeFacing(
  direction: PracticeDirection,
  random: () => number = Math.random,
): PracticeFacing {
  if (direction === 'mixed') {
    return random() < 0.5 ? 'es-en' : 'en-es'
  }
  return direction
}

export function resolveBilingualSides(
  item: VocabPracticeItem | TraducirPracticeItem,
  facing: PracticeFacing,
): { readonly stimulus: string; readonly expected: string } {
  if (item.kind === 'vocab') {
    return facing === 'en-es'
      ? { stimulus: item.backEn, expected: item.frontEs }
      : { stimulus: item.frontEs, expected: item.backEn }
  }
  return facing === 'en-es'
    ? { stimulus: item.answerEn, expected: item.promptEs }
    : { stimulus: item.promptEs, expected: item.answerEn }
}
