import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSampleStudyDocument } from '../study/create-sample-study-document'
import type { StudyDocument, StudySession } from '../study/study-types'
import type { StudyProgressRecord } from '../storage/study-document-types'
import { createStudyProgressRecord } from '../storage/study-document-types'
import type { StudyDocumentStore } from '../storage/study-document-store'
import { StudyScreen } from './StudyScreen'
import { STUDY_TEST_IDS, studyInterfaceTexts } from './study-interface-texts'

function memoryStore(initial: StudyProgressRecord | null = null): StudyDocumentStore {
  let record = initial
  return {
    saveProgress: async (document: StudyDocument, session: StudySession) => {
      record = createStudyProgressRecord(document, session)
      return record
    },
    getProgress: async (catalogId: string) => (record?.catalogId === catalogId ? record : null),
    close: () => undefined,
  }
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('StudyScreen', () => {
  let root: ReturnType<typeof createRoot> | null = null
  let host: HTMLDivElement

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    host.remove()
    root = null
  })

  it('shows the packaged catalog index and first lesson', async () => {
    const catalog = createSampleStudyDocument()
    await act(async () => {
      root?.render(
        <StudyScreen
          sessionOptions={{
            createStore: async () => memoryStore(),
            loadCatalog: () => catalog,
          }}
        />,
      )
    })
    await flush()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.screen}"]`)).not.toBeNull()
    expect(host.querySelector('[data-testid="study-import-input"]')).toBeNull()
    expect(host.querySelector('[data-testid="study-load-sample"]')).toBeNull()
    expect(host.textContent).not.toMatch(/Cargar temario de ejemplo/)
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.syllabus}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)?.textContent).toBe(
      'En el restaurante',
    )
    const body = host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionBody}"]`)
    expect(body?.querySelector('h2')?.textContent).toMatch(/Qué vas a aprender/)
    expect(body?.textContent).not.toContain('##')
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.progress}"]`)).not.toBeNull()
  })

  it('moves to the next lesson and back with previous', async () => {
    const catalog = createSampleStudyDocument()
    await act(async () => {
      root?.render(
        <StudyScreen
          sessionOptions={{
            createStore: async () => memoryStore(),
            loadCatalog: () => catalog,
          }}
        />,
      )
    })
    await flush()
    const firstTitle = host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)
      ?.textContent
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.next}"]`) as HTMLButtonElement).click()
    })
    const secondTitle = host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)
      ?.textContent
    expect(secondTitle).toMatch(/aeropuerto/i)
    expect(secondTitle).not.toBe(firstTitle)
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.previous}"]`) as HTMLButtonElement).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)?.textContent).toBe(
      firstTitle,
    )
  })

  it('shows empty copy when the catalog has no lessons', async () => {
    await act(async () => {
      root?.render(
        <StudyScreen
          sessionOptions={{
            createStore: async () => memoryStore(),
            loadCatalog: () => null,
          }}
        />,
      )
    })
    await flush()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.syllabus}"]`)).toBeNull()
    expect(host.textContent).toContain(studyInterfaceTexts.emptyLead)
    expect(host.querySelector('[data-testid="study-import-input"]')).toBeNull()
  })

  it('hides the back-to-practice button when embedded', async () => {
    await act(async () => {
      root?.render(
        <StudyScreen
          embedded
          sessionOptions={{
            createStore: async () => memoryStore(),
            loadCatalog: () => null,
          }}
        />,
      )
    })
    await flush()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.screen}"]`)).not.toBeNull()
    expect(host.textContent).not.toContain(studyInterfaceTexts.backToPracticeLabel)
    expect(host.textContent).toContain(studyInterfaceTexts.screenTitle)
  })

  it('groups contiguous lessons into block boxes and keeps titles clickable', async () => {
    await act(async () => {
      root?.render(
        <StudyScreen
          sessionOptions={{
            createStore: async () => memoryStore(),
            loadCatalog: () => groupedCatalog(),
          }}
        />,
      )
    })
    await flush()
    expect(host.textContent).toContain('File 1 · Conocerse')
    expect(host.textContent).toContain('Inglés práctico 1 · Deletrear')
    expect(host.querySelectorAll(`[data-testid="${STUDY_TEST_IDS.syllabusBlock}"]`).length).toBe(2)
    await act(async () => {
      const button = [...host.querySelectorAll('button')].find((node) =>
        node.textContent?.includes('1B · Música'),
      ) as HTMLButtonElement
      button.click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)?.textContent).toMatch(
      /Música/,
    )
  })

  it('opens the practice desk for the lesson tema from the CTA', async () => {
    await act(async () => {
      root?.render(
        <StudyScreen
          embedded
          sessionOptions={{
            createStore: async () => memoryStore(),
            loadCatalog: () => groupedCatalog(),
          }}
        />,
      )
    })
    await flush()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCta}"]`)).not.toBeNull()
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCta}"]`) as HTMLButtonElement).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceDesk}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeVocab}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeCompletar}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeTraducir}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeTransformar}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.screen}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceFilterTema}"]`)?.textContent).toBe(
      studyInterfaceTexts.temaLabels.besingular,
    )
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.deskLesson}"]`) as HTMLButtonElement).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceDesk}"]`)).toBeNull()
  })
})

function groupedCatalog(): StudyDocument {
  return {
    id: 'grouped',
    title: 'grouped',
    sections: [
      {
        id: 'file-1a',
        title: '1A · Encantado de conocerte',
        bodyText: '## Explicación\n\nHola.',
        tema: 'besingular',
        bloque: 'file1',
        bloqueEs: 'File 1 · Conocerse',
      },
      {
        id: 'file-1b',
        title: '1B · Música del mundo',
        bodyText: '## Explicación\n\nMúsica.',
        tema: 'besingular',
        bloque: 'file1',
        bloqueEs: 'File 1 · Conocerse',
      },
      {
        id: 'pe-1',
        title: 'Inglés práctico 1',
        bodyText: '## Explicación\n\nSpell.',
        tema: 'classroom',
        bloque: 'pe1',
        bloqueEs: 'Inglés práctico 1 · Deletrear',
      },
    ],
  }
}
