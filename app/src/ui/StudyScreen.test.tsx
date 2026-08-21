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

function lessonButton(host: HTMLElement, title: string): HTMLButtonElement {
  const catalog = host.querySelector(`[data-testid="${STUDY_TEST_IDS.catalog}"]`)
  const button = [...(catalog?.querySelectorAll('button.indice-fila') ?? [])].find((node) =>
    node.textContent?.includes(title),
  )
  if (!button) {
    throw new Error(`Lesson button not found: ${title}`)
  }
  return button as HTMLButtonElement
}

function changeSearch(host: HTMLElement, value: string): void {
  const input = host.querySelector(`[data-testid="${STUDY_TEST_IDS.search}"]`) as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function bookmarkButton(host: HTMLElement): HTMLButtonElement {
  return host.querySelector(`[data-testid="${STUDY_TEST_IDS.bookmark}"]`) as HTMLButtonElement
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

  it('shows the lesson index sheet without opening a lesson', async () => {
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
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.screen}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.catalog}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.search}"]`)).not.toBeNull()
    expect(host.textContent).toContain(studyInterfaceTexts.indexTitle)
    expect(host.querySelectorAll(`[data-testid="${STUDY_TEST_IDS.syllabusBlock}"]`).length).toBe(2)
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)).toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionBody}"]`)).toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.continue}"]`)).toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCta}"]`)).toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.saveChip}"]`)?.textContent).toBe(
      studyInterfaceTexts.saveChipOn,
    )

    const firstBlock = host.querySelector(`[data-testid="${STUDY_TEST_IDS.syllabusBlock}"]`)
    const cab = firstBlock?.querySelector('header')
    expect(cab?.textContent).toContain('File 1 · Conocerse')
    expect(cab?.textContent).toContain('2 subtemas')
    expect(cab?.closest('button')).toBeNull()
    expect(cab?.querySelector('button')).toBeNull()
    expect(firstBlock?.querySelectorAll('button.indice-fila').length).toBe(2)

    const row = lessonButton(host, '1A · Encantado de conocerte')
    expect(row.tagName).toBe('BUTTON')
    expect(row.textContent).toContain('1')
    expect(row.textContent).toContain(studyInterfaceTexts.openLesson)
    expect(lessonButton(host, 'Repaso extra').closest(`[data-testid="${STUDY_TEST_IDS.syllabusBlock}"]`)).toBeNull()
  })

  it('opens the reader from a lesson row and returns via Índice', async () => {
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
    await act(async () => {
      lessonButton(host, 'En el restaurante').click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.catalog}"]`)).toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.lessonNav}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.lessonTag}"]`)?.textContent).toBe(
      studyInterfaceTexts.lessonTag(1),
    )
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)?.textContent).toBe(
      'En el restaurante',
    )
    const body = host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionBody}"]`)
    expect(body?.querySelector('h2')?.textContent).toMatch(/Qué vas a aprender/)
    expect(body?.textContent).not.toContain('##')
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.backToCatalog}"]`)?.textContent).toContain(
      studyInterfaceTexts.catalogButton,
    )
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.backToCatalog}"]`) as HTMLButtonElement).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.catalog}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)).toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionBody}"]`)).toBeNull()
  })

  it('does not show Continúa after opening a lesson without planting', async () => {
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
    await act(async () => {
      lessonButton(host, '1B · Música').click()
    })
    expect(bookmarkButton(host).getAttribute('aria-pressed')).toBe('false')
    expect(bookmarkButton(host).className).not.toContain('marcapaginas-plantado')
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.backToCatalog}"]`) as HTMLButtonElement).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.continue}"]`)).toBeNull()
  })

  it('plants a bookmark, persists it, and Continúa opens that lesson', async () => {
    const catalog = groupedCatalog()
    const store = memoryStore()
    await act(async () => {
      root?.render(
        <StudyScreen
          sessionOptions={{
            createStore: async () => store,
            loadCatalog: () => catalog,
          }}
        />,
      )
    })
    await flush()
    await act(async () => {
      lessonButton(host, '1B · Música').click()
    })
    await act(async () => {
      bookmarkButton(host).click()
    })
    await flush()
    expect(bookmarkButton(host).getAttribute('aria-pressed')).toBe('true')
    expect(bookmarkButton(host).className).toContain('marcapaginas-plantado')
    expect(bookmarkButton(host).className).toContain('marcapaginas-animando')

    act(() => {
      root?.unmount()
    })
    host.remove()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => {
      root?.render(
        <StudyScreen
          sessionOptions={{
            createStore: async () => store,
            loadCatalog: () => catalog,
          }}
        />,
      )
    })
    await flush()
    const continueBtn = host.querySelector(`[data-testid="${STUDY_TEST_IDS.continue}"]`) as HTMLButtonElement
    expect(continueBtn.textContent).toMatch(/Música/)
    await act(async () => {
      continueBtn.click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)?.textContent).toMatch(/Música/)
    expect(bookmarkButton(host).getAttribute('aria-pressed')).toBe('true')
  })

  it('removes the bookmark on a second click so Continúa disappears after remount', async () => {
    const catalog = groupedCatalog()
    const store = memoryStore()
    await act(async () => {
      root?.render(
        <StudyScreen
          sessionOptions={{
            createStore: async () => store,
            loadCatalog: () => catalog,
          }}
        />,
      )
    })
    await flush()
    await act(async () => {
      lessonButton(host, '1A · Encantado de conocerte').click()
    })
    await act(async () => {
      bookmarkButton(host).click()
    })
    await flush()

    act(() => {
      root?.unmount()
    })
    host.remove()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => {
      root?.render(
        <StudyScreen
          sessionOptions={{
            createStore: async () => store,
            loadCatalog: () => catalog,
          }}
        />,
      )
    })
    await flush()
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.continue}"]`) as HTMLButtonElement).click()
    })
    await act(async () => {
      bookmarkButton(host).click()
    })
    await flush()
    expect(bookmarkButton(host).getAttribute('aria-pressed')).toBe('false')
    expect(bookmarkButton(host).className).toContain('marcapaginas-retrayendo')

    act(() => {
      root?.unmount()
    })
    host.remove()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => {
      root?.render(
        <StudyScreen
          sessionOptions={{
            createStore: async () => store,
            loadCatalog: () => catalog,
          }}
        />,
      )
    })
    await flush()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.continue}"]`)).toBeNull()
  })

  it('asks before moving the bookmark and keeps or moves it from the dialog', async () => {
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
    await act(async () => {
      lessonButton(host, '1A · Encantado de conocerte').click()
    })
    await act(async () => {
      bookmarkButton(host).click()
    })
    await flush()
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.next}"]`) as HTMLButtonElement).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)?.textContent).toMatch(/Música/)
    await act(async () => {
      bookmarkButton(host).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.bookmarkDialog}"]`)).not.toBeNull()
    expect(host.textContent).toContain(studyInterfaceTexts.bookmarkMoveTitle)
    expect(host.textContent).toContain('1A · Encantado de conocerte')
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.bookmarkCancel}"]`) as HTMLButtonElement).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.bookmarkDialog}"]`)).toBeNull()
    expect(bookmarkButton(host).getAttribute('aria-pressed')).toBe('false')
    await act(async () => {
      bookmarkButton(host).click()
    })
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.bookmarkConfirm}"]`) as HTMLButtonElement).click()
    })
    await flush()
    expect(bookmarkButton(host).getAttribute('aria-pressed')).toBe('true')
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.backToCatalog}"]`) as HTMLButtonElement).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.continue}"]`)?.textContent).toMatch(/Música/)
  })

  it('does not move the bookmark with next or previous', async () => {
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
    await act(async () => {
      lessonButton(host, 'En el restaurante').click()
    })
    await act(async () => {
      bookmarkButton(host).click()
    })
    await flush()
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.next}"]`) as HTMLButtonElement).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)?.textContent).toMatch(/aeropuerto/i)
    expect(bookmarkButton(host).getAttribute('aria-pressed')).toBe('false')
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.previous}"]`) as HTMLButtonElement).click()
    })
    expect(bookmarkButton(host).getAttribute('aria-pressed')).toBe('true')
  })

  it('filters the index with the search box', async () => {
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
    await act(async () => {
      changeSearch(host, 'Música')
    })
    expect(lessonButton(host, '1B · Música').textContent).toContain('2')
    expect(() => lessonButton(host, '1A · Encantado')).toThrow(/Lesson button not found/)
    expect(host.textContent).not.toContain(studyInterfaceTexts.searchEmpty)
    await act(async () => {
      changeSearch(host, 'zzzz-sin-match')
    })
    expect(host.textContent).toContain(studyInterfaceTexts.searchEmpty)
    expect(host.querySelector('button.indice-fila')).toBeNull()
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
    await act(async () => {
      lessonButton(host, 'En el restaurante').click()
    })
    const firstTitle = host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)?.textContent
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.next}"]`) as HTMLButtonElement).click()
    })
    const secondTitle = host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)?.textContent
    expect(secondTitle).toMatch(/aeropuerto/i)
    expect(secondTitle).not.toBe(firstTitle)
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.previous}"]`) as HTMLButtonElement).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)?.textContent).toBe(firstTitle)
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
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.catalog}"]`)).toBeNull()
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

  it('groups contiguous lessons into topic headings with clickable lessons', async () => {
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
      lessonButton(host, '1B · Música').click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)?.textContent).toMatch(/Música/)
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.studyObjetivo}"]`)?.textContent).toContain(
      'Hablar de música',
    )
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.lessonTag}"]`)?.textContent).toBe(
      studyInterfaceTexts.lessonTag(2),
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
    await act(async () => {
      lessonButton(host, '1A · Encantado de conocerte').click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCta}"]`)).not.toBeNull()
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCta}"]`) as HTMLButtonElement).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceDesk}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceModeVocab}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceFilterTema}"]`)?.textContent).toBe(
      studyInterfaceTexts.temaLabels.besingular,
    )
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.deskLesson}"]`) as HTMLButtonElement).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.catalog}"]`)).not.toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)).toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceDesk}"]`)).toBeNull()
  })

  it('returns to the reader from practice via back to lesson', async () => {
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
    await act(async () => {
      lessonButton(host, '1A · Encantado de conocerte').click()
    })
    await act(async () => {
      ;(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceCta}"]`) as HTMLButtonElement).click()
    })
    await act(async () => {
      ;(
        host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceBackLesson}"]`) as HTMLButtonElement
      ).click()
    })
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.sectionTitle}"]`)?.textContent).toMatch(
      /Encantado/,
    )
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.catalog}"]`)).toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.practiceDesk}"]`)).toBeNull()
    expect(host.querySelector(`[data-testid="${STUDY_TEST_IDS.backToCatalog}"]`)).not.toBeNull()
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
        titleEn: 'Nice to meet you',
        bodyText: '## Explicación\n\nHola.',
        tema: 'besingular',
        bloque: 'file1',
        bloqueEs: 'File 1 · Conocerse',
        objetivo: 'Presentarte en clase',
      },
      {
        id: 'file-1b',
        title: '1B · Música del mundo',
        titleEn: 'World music',
        bodyText: '## Explicación\n\nMúsica.',
        tema: 'besingular',
        bloque: 'file1',
        bloqueEs: 'File 1 · Conocerse',
        objetivo: 'Hablar de música',
      },
      {
        id: 'pe-1',
        title: 'Inglés práctico 1',
        bodyText: '## Explicación\n\nSpell.',
        tema: 'classroom',
        bloque: 'pe1',
        bloqueEs: 'Inglés práctico 1 · Deletrear',
        objetivo: 'Deletrear nombres',
      },
      {
        id: 'loose-1',
        title: 'Repaso extra',
        bodyText: '## Extra\n\nOk.',
      },
    ],
  }
}
