import {
  buildCompletarItems,
  extractModelPhrases,
  extractVocabPairs,
  vocabToFlashcards,
  type ExtractedVocabPair,
} from './extract-practice-items'
import { TRANSFORM_DRILLS } from './practice-drills'
import {
  isStudyKey,
  type PracticeBank,
  type PracticeItem,
  type PracticeLessonSource,
  type PracticeMode,
  type TraducirPracticeItem,
  type TransformarPracticeItem,
} from './study-types'

export const EMPTY_PRACTICE_BANK: PracticeBank = {
  vocab: [],
  completar: [],
  traducir: [],
  transformar: [],
}

export function buildPracticeBank(lessons: readonly PracticeLessonSource[]): PracticeBank {
  const pairsByTema = new Map<string, ExtractedVocabPair[]>()
  const phrasesByLesson: { lesson: PracticeLessonSource; phrases: string[]; tema: string }[] = []

  for (const lesson of lessons) {
    const tema = lesson.tema
    if (tema === undefined || !isStudyKey(tema)) {
      continue
    }
    const pairs = extractVocabPairs(lesson.bodyMarkdown, tema, lesson.id)
    const existing = pairsByTema.get(tema) ?? []
    pairsByTema.set(tema, existing.concat(pairs))
    phrasesByLesson.push({
      lesson,
      tema,
      phrases: extractModelPhrases(lesson.bodyMarkdown),
    })
  }

  const vocab = [...pairsByTema.values()].flatMap((pairs) => vocabToFlashcards(pairs))
  const traducir = [...pairsByTema.values()].flatMap((pairs) => pairsToTraducir(pairs))
  const completar = phrasesByLesson.flatMap(({ lesson, phrases, tema }) =>
    buildCompletarItems(phrases, pairsByTema.get(tema) ?? [], tema, lesson.id),
  )
  const transformar = TRANSFORM_DRILLS.filter((item) => isValidTransform(item))

  return uniquifyBank({
    vocab,
    completar,
    traducir,
    transformar,
  })
}

export function itemsForMode(
  bank: PracticeBank,
  mode: PracticeMode,
  tema: string | null,
): readonly PracticeItem[] {
  const list = bank[mode]
  if (tema === null) {
    return list
  }
  return list.filter((item) => item.tema === tema)
}

function pairsToTraducir(pairs: readonly ExtractedVocabPair[]): TraducirPracticeItem[] {
  return pairs.map((pair) => ({
    id: pair.id.replace('-vocab-', '-trd-'),
    tema: pair.tema,
    kind: 'traducir',
    promptEs: pair.es,
    answerEn: pair.en,
  }))
}

function isValidTransform(item: TransformarPracticeItem): boolean {
  if (!isStudyKey(item.tema) || item.id.length === 0) {
    console.warn('Dropped invalid transform drill.', { id: item.id, tema: item.tema })
    return false
  }
  if (item.stimulus.trim().length === 0 || item.answer.trim().length === 0) {
    console.warn('Dropped invalid transform drill.', { id: item.id })
    return false
  }
  return true
}

function uniquifyBank(bank: PracticeBank): PracticeBank {
  return {
    vocab: uniquifyItems(bank.vocab),
    completar: uniquifyItems(bank.completar),
    traducir: uniquifyItems(bank.traducir),
    transformar: uniquifyItems(bank.transformar),
  }
}

function uniquifyItems<T extends { readonly id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>()
  return items.map((item) => {
    let id = item.id
    let suffix = 2
    while (seen.has(id)) {
      console.warn('Duplicate practice item id; using a suffix.', { id: item.id })
      id = `${item.id}-${suffix}`
      suffix += 1
    }
    seen.add(id)
    return id === item.id ? item : { ...item, id }
  })
}
