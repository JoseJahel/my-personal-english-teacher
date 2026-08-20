import { studyDocumentFromLessons } from './load-processed-lessons'
import { parseLessonMarkdown } from './parse-lesson-markdown'
import type { StudyDocument } from './study-types'

const SAMPLE_LESSON_FILES: Record<string, string> = {
  '01-en-el-restaurante.md': `---
id: restaurant
order: 1
title: En el restaurante
titleEn: At the restaurant
---

## Qué vas a aprender

Pedir la **menu** y la cuenta.
`,
  '02-en-el-aeropuerto.md': `---
id: airport
order: 2
title: En el aeropuerto
titleEn: At the airport
---

## Qué vas a aprender

Preguntar por la puerta.
`,
  '03-entrevista-de-trabajo.md': `---
id: interview
order: 3
title: Entrevista de trabajo
titleEn: A job interview
---

## Qué vas a aprender

Presentarte en tres frases.
`,
}

/** Minimal catalog factory for tests that do not load the processed glob. */
export function createSampleStudyDocument(): StudyDocument {
  const lessons = Object.entries(SAMPLE_LESSON_FILES).map(([path, raw]) =>
    parseLessonMarkdown(raw, path),
  )
  const document = studyDocumentFromLessons(lessons)
  if (!document) {
    throw new Error('Sample study document must contain at least one lesson.')
  }
  return document
}
