/**
 * Study-desk domain types. No React/DOM — UI maps these to Spanish copy.
 */

export const PROCESSED_CATALOG_ID = 'processed-temario'

/** JapApp catalog keys: latin, no underscore. */
export const STUDY_KEY_PATTERN = /^[a-z][a-z0-9]*$/

export function isStudyKey(value: string): boolean {
  return STUDY_KEY_PATTERN.test(value)
}

export interface StudySection {
  readonly id: string
  readonly title: string
  readonly bodyText: string
  readonly titleEn?: string
  readonly tema?: string
  readonly bloque?: string
  readonly bloqueEs?: string
  readonly objetivo?: string
}

export interface StudyDocument {
  readonly id: string
  readonly title: string
  readonly sections: readonly StudySection[]
}

/** One resume point per catalog. null = no bookmark. */
export interface StudyBookmark {
  readonly sectionId: string
  readonly title: string
  readonly titleEn?: string
  readonly order: number
  readonly savedAtIso: string
}

export interface StudySession {
  readonly documentId: string
  readonly activeSectionIndex: number
  readonly completedSectionIds: readonly string[]
  readonly bookmark: StudyBookmark | null
}

export interface ProcessedLesson {
  readonly id: string
  readonly order: number
  readonly title: string
  readonly titleEn?: string
  readonly sourcePath: string
  readonly bodyMarkdown: string
  readonly tema?: string
  readonly bloque?: string
  readonly bloqueEs?: string
  readonly objetivo?: string
}

export const PRACTICE_MODES = ['vocab', 'completar', 'traducir', 'transformar'] as const

export type PracticeMode = (typeof PRACTICE_MODES)[number]

export interface PracticeItemBase {
  readonly id: string
  readonly tema: string
}

export interface VocabPracticeItem extends PracticeItemBase {
  readonly kind: 'vocab'
  readonly frontEs: string
  readonly backEn: string
}

export interface CompletarPracticeItem extends PracticeItemBase {
  readonly kind: 'completar'
  readonly phrase: string
  readonly options: readonly string[]
  readonly correctIndex: number
}

export interface TraducirPracticeItem extends PracticeItemBase {
  readonly kind: 'traducir'
  readonly promptEs: string
  readonly answerEn: string
}

export interface TransformarPracticeItem extends PracticeItemBase {
  readonly kind: 'transformar'
  readonly prompt: string
  readonly stimulus: string
  readonly answer: string
  readonly options?: readonly string[]
}

export type PracticeItem =
  | VocabPracticeItem
  | CompletarPracticeItem
  | TraducirPracticeItem
  | TransformarPracticeItem

export interface PracticeBank {
  readonly vocab: readonly VocabPracticeItem[]
  readonly completar: readonly CompletarPracticeItem[]
  readonly traducir: readonly TraducirPracticeItem[]
  readonly transformar: readonly TransformarPracticeItem[]
}

export interface PracticeLessonSource {
  readonly id: string
  readonly bodyMarkdown: string
  readonly tema?: string
}
