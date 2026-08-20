import { parseLessonMarkdown } from './parse-lesson-markdown'
import type { ProcessedLesson, StudyDocument, StudySection } from './study-types'
import { PROCESSED_CATALOG_ID } from './study-types'

const processedLessonModules = import.meta.glob('../../../estudio/procesado/*.md', {
  query: '?raw',
  eager: true,
})

export function loadProcessedLessons(): StudyDocument | null {
  return loadProcessedLessonsFromModules(processedLessonModules)
}

export function loadProcessedLessonsFromModules(
  modules: Record<string, unknown>,
): StudyDocument | null {
  const lessons: ProcessedLesson[] = []
  for (const [sourcePath, moduleValue] of Object.entries(modules)) {
    const raw = rawFromModule(moduleValue)
    if (raw === null) {
      console.warn('Dropped study lesson module with a non-string source.', { sourcePath })
      continue
    }
    lessons.push(parseLessonMarkdown(raw, sourcePath))
  }
  return studyDocumentFromLessons(lessons)
}

export function studyDocumentFromLessons(lessons: readonly ProcessedLesson[]): StudyDocument | null {
  if (lessons.length === 0) {
    return null
  }
  const unique = uniquifyLessonIds(lessons)
  const sorted = [...unique].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  return {
    id: PROCESSED_CATALOG_ID,
    title: PROCESSED_CATALOG_ID,
    sections: sorted.map(sectionFromLesson),
  }
}

function sectionFromLesson(lesson: ProcessedLesson): StudySection {
  return {
    id: lesson.id,
    title: lesson.title,
    bodyText: lesson.bodyMarkdown,
    ...(lesson.titleEn !== undefined ? { titleEn: lesson.titleEn } : {}),
    ...(lesson.tema !== undefined ? { tema: lesson.tema } : {}),
    ...(lesson.bloque !== undefined ? { bloque: lesson.bloque } : {}),
    ...(lesson.bloqueEs !== undefined ? { bloqueEs: lesson.bloqueEs } : {}),
    ...(lesson.objetivo !== undefined ? { objetivo: lesson.objetivo } : {}),
  }
}

function uniquifyLessonIds(lessons: readonly ProcessedLesson[]): ProcessedLesson[] {
  const seen = new Set<string>()
  return lessons.map((lesson) => {
    let id = lesson.id
    let suffix = 2
    while (seen.has(id)) {
      console.warn('Duplicate lesson id; using a suffix.', {
        id: lesson.id,
        sourcePath: lesson.sourcePath,
      })
      id = `${lesson.id}-${suffix}`
      suffix += 1
    }
    seen.add(id)
    return id === lesson.id ? lesson : { ...lesson, id }
  })
}

function rawFromModule(moduleValue: unknown): string | null {
  if (typeof moduleValue === 'string') {
    return moduleValue
  }
  if (typeof moduleValue !== 'object' || moduleValue === null || !('default' in moduleValue)) {
    return null
  }
  const value = (moduleValue as { default: unknown }).default
  return typeof value === 'string' ? value : null
}
