/**
 * Ordered English script the tutor voice reads out loud for one lesson.
 *
 * Pure domain, same rule as the rest of `study/`: no React, no DOM, no
 * `ia/`, no `audio/`. Same body markdown in, same script out.
 *
 * Lessons mix Spanish (instructions, glosses) and English (model phrases,
 * vocabulary). Only the English side is spoken, and it is taken from the
 * very same extractors the practice bank is built from, so the reader can
 * never narrate a Spanish gloss with an English voice.
 */
import { extractModelPhrases, extractVocabPairs } from './extract-practice-items'

export type LessonSpeechLineKind = 'phrase' | 'vocab'

export interface LessonSpeechLine {
  readonly id: string
  readonly text: string
  readonly kind: LessonSpeechLineKind
}

/**
 * Each section gets its own budget rather than sharing one global cap. A
 * single shared cap let a long dialogue (some lessons run past 25 model
 * phrases) consume every slot, so the vocabulary list was never spoken.
 */
export const MAXIMUM_SPOKEN_MODEL_PHRASES = 30
export const MAXIMUM_SPOKEN_VOCABULARY_TERMS = 30

/** Upper bound on a whole read-aloud, kept to a few minutes of speech. */
export const MAXIMUM_LESSON_SPEECH_LINES =
  MAXIMUM_SPOKEN_MODEL_PHRASES + MAXIMUM_SPOKEN_VOCABULARY_TERMS

/** Longer lines are prose blocks, not speakable phrases; they are dropped. */
export const MAXIMUM_LESSON_SPEECH_LINE_CHARACTERS = 180

const LIMIT_BY_KIND: Record<LessonSpeechLineKind, number> = {
  phrase: MAXIMUM_SPOKEN_MODEL_PHRASES,
  vocab: MAXIMUM_SPOKEN_VOCABULARY_TERMS,
}

/**
 * Builds the read-aloud script: model phrases first (they carry the lesson's
 * point), then the English side of the vocabulary list. Duplicates are
 * dropped case-insensitively so a word listed in both sections is heard once.
 * `tema` is optional: without a valid one there is no vocabulary to speak,
 * and the script falls back to the model phrases alone.
 */
export function buildLessonSpeechScript(
  bodyMarkdown: string,
  lessonId: string,
  tema?: string,
): readonly LessonSpeechLine[] {
  const lines: LessonSpeechLine[] = []
  const alreadyQueued = new Set<string>()
  const spokenByKind: Record<LessonSpeechLineKind, number> = { phrase: 0, vocab: 0 }

  const queue = (rawText: string, kind: LessonSpeechLineKind): void => {
    if (spokenByKind[kind] >= LIMIT_BY_KIND[kind]) {
      return
    }
    const text = rawText.replace(/\s+/g, ' ').trim()
    if (!isSpeakable(text)) {
      return
    }
    const key = text.toLowerCase()
    if (alreadyQueued.has(key)) {
      return
    }
    alreadyQueued.add(key)
    spokenByKind[kind] += 1
    lines.push({ id: `${lessonId}-speech-${lines.length}`, text, kind })
  }

  for (const phrase of extractModelPhrases(bodyMarkdown)) {
    queue(phrase, 'phrase')
  }
  if (tema !== undefined) {
    for (const pair of extractVocabPairs(bodyMarkdown, tema, lessonId)) {
      queue(firstEnglishVariant(pair.en), 'vocab')
    }
  }
  return lines
}

/**
 * Vocabulary entries can list alternatives ("holiday / vacation") and
 * parenthetical hints; a voice should read one clean term, not the notation.
 */
function firstEnglishVariant(englishTerm: string): string {
  const [first = ''] = englishTerm.split(/\s+\/\s+/)
  return first.replace(/\([^)]*\)/g, ' ').replace(/[.]{3,}/g, ' ')
}

function isSpeakable(text: string): boolean {
  if (text.length === 0 || text.length > MAXIMUM_LESSON_SPEECH_LINE_CHARACTERS) {
    return false
  }
  return /[A-Za-z]/.test(text)
}
