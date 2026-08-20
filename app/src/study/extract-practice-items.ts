import { isStudyKey, type CompletarPracticeItem, type VocabPracticeItem } from './study-types'

export interface ExtractedVocabPair {
  readonly id: string
  readonly tema: string
  readonly en: string
  readonly es: string
  readonly matchKeys: readonly string[]
}

const VOCAB_LINE =
  /^\s*[-*]\s+\*\*(.+?)\*\*(?:\s+\/[^/\n]+\/)?\s+[—–]\s+(.+?)\s*$/
const VOCAB_LINE_HYPHEN = /^\s*[-*]\s+\*\*(.+?)\*\*(?:\s+\/[^/\n]+\/)?\s+-\s+(.+?)\s*$/

export function extractVocabPairs(
  body: string,
  tema: string,
  lessonId: string,
): ExtractedVocabPair[] {
  if (!isStudyKey(tema)) {
    return []
  }
  const pairs: ExtractedVocabPair[] = []
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  let index = 0
  for (const line of lines) {
    const parsed = parseVocabLine(line)
    if (parsed === null) {
      continue
    }
    pairs.push({
      id: `${lessonId}-vocab-${index}`,
      tema,
      en: parsed.en,
      es: parsed.es,
      matchKeys: matchKeysFromEnglish(parsed.en),
    })
    index += 1
  }
  return pairs
}

function parseVocabLine(line: string): { en: string; es: string } | null {
  const match = line.match(VOCAB_LINE) ?? line.match(VOCAB_LINE_HYPHEN)
  if (!match) {
    return null
  }
  const en = (match[1] ?? '').replace(/\s+/g, ' ').trim()
  const es = (match[2] ?? '').replace(/\s+/g, ' ').trim()
  if (en.length === 0 || es.length === 0) {
    console.warn('Dropped invalid vocab list item.', { line })
    return null
  }
  return { en, es }
}

export function matchKeysFromEnglish(en: string): string[] {
  const keys = new Set<string>()
  for (const variant of en.split(/\s+\/\s+/)) {
    const stripped = variant
      .replace(/[…]+/g, '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (stripped.length > 1) {
      keys.add(stripped)
    }
    const words = stripped.split(' ').filter((word) => word.length > 1)
    const last = words[words.length - 1]
    if (last && last.length > 2) {
      keys.add(last.replace(/[.,!?]+$/g, ''))
    }
  }
  return [...keys].sort((a, b) => b.length - a.length)
}

export function extractModelPhrases(body: string): string[] {
  const section = markdownSection(body, 'Frases modelo')
  if (section.length === 0) {
    return []
  }
  const phrases: string[] = []
  for (const line of section.split('\n')) {
    const item = line.match(/^\s*[-*]\s+(.+)$/)
    if (!item) {
      continue
    }
    let text = (item[1] ?? '').replace(/\*+/g, '').trim()
    const speaker = text.match(
      /^[A-Za-z][A-Za-z'’.-]*(?:\s+[A-Za-z][A-Za-z'’.-]*){0,2}:\s*(.+)$/,
    )
    if (speaker) {
      text = (speaker[1] ?? '').trim()
    }
    if (!looksEnglish(text)) {
      continue
    }
    phrases.push(text)
  }
  return phrases
}

function markdownSection(body: string, title: string): string {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex((line) => line.trim() === `## ${title}`)
  if (start < 0) {
    return ''
  }
  const end = lines.findIndex((line, index) => index > start && /^## /.test(line.trim()))
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n')
}

function looksEnglish(text: string): boolean {
  if (text.length < 3) {
    return false
  }
  if (/[¿¡áéíóúñÁÉÍÓÚÑ]/.test(text) || /→/.test(text)) {
    return false
  }
  return /[A-Za-z]/.test(text)
}

export function vocabToFlashcards(pairs: readonly ExtractedVocabPair[]): VocabPracticeItem[] {
  return pairs.map((pair) => ({
    id: pair.id,
    tema: pair.tema,
    kind: 'vocab',
    frontEs: pair.es,
    backEn: pair.en,
  }))
}

export function buildCompletarItems(
  phrases: readonly string[],
  vocab: readonly ExtractedVocabPair[],
  tema: string,
  idPrefix: string,
): CompletarPracticeItem[] {
  if (!isStudyKey(tema) || vocab.length < 3) {
    return []
  }
  const items: CompletarPracticeItem[] = []
  phrases.forEach((phrase, phraseIndex) => {
    const hit = findVocabHit(phrase, vocab)
    if (hit === null) {
      return
    }
    const gapped = gapOnce(phrase, hit.key)
    if (gapped === null || gapped === '___') {
      return
    }
    const distractors = uniqueOthers(vocab, hit.en, 3)
    if (distractors.length < 2) {
      return
    }
    const placed = placeCorrect(hit.en, distractors, `${idPrefix}-${phraseIndex}`)
    items.push({
      id: `${idPrefix}-comp-${phraseIndex}`,
      tema,
      kind: 'completar',
      phrase: gapped,
      options: placed.options,
      correctIndex: placed.correctIndex,
    })
  })
  return items
}

function findVocabHit(
  phrase: string,
  vocab: readonly ExtractedVocabPair[],
): { en: string; key: string } | null {
  let best: { en: string; key: string; length: number } | null = null
  for (const pair of vocab) {
    for (const key of pair.matchKeys) {
      if (key.length < 2) {
        continue
      }
      if (!keyOccurs(phrase, key)) {
        continue
      }
      if (best === null || key.length > best.length) {
        best = { en: pair.en, key, length: key.length }
      }
    }
  }
  return best
}

function keyOccurs(phrase: string, key: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'i')
  return pattern.test(phrase)
}

function gapOnce(phrase: string, key: string): string | null {
  const pattern = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'i')
  if (!pattern.test(phrase)) {
    return null
  }
  return phrase.replace(pattern, '___')
}

function uniqueOthers(
  vocab: readonly ExtractedVocabPair[],
  correctEn: string,
  take: number,
): string[] {
  const seen = new Set<string>([correctEn.toLowerCase()])
  const out: string[] = []
  for (const pair of vocab) {
    const label = pair.en
    const key = label.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(label)
    if (out.length >= take) {
      break
    }
  }
  return out
}

function placeCorrect(
  correct: string,
  distractors: readonly string[],
  seed: string,
): { options: string[]; correctIndex: number } {
  const options = [...distractors]
  const index = hashString(seed) % (options.length + 1)
  options.splice(index, 0, correct)
  return { options, correctIndex: index }
}

function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
