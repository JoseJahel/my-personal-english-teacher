import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadProcessedLessons, loadProcessedLessonsFromModules } from './load-processed-lessons'
import { buildPracticeBank, itemsForMode } from './practice-bank'
import { PROCESSED_CATALOG_ID } from './study-types'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('loadProcessedLessonsFromModules', () => {
  it('sorts lessons by order and maps them to catalog sections', () => {
    const document = loadProcessedLessonsFromModules({
      '02-airport.md': `---
id: airport
order: 2
title: En el aeropuerto
---
Gate body.
`,
      '01-restaurant.md': `---
id: restaurant
order: 1
title: En el restaurante
titleEn: At the restaurant
---
Menu body.
`,
    })
    expect(document).not.toBeNull()
    expect(document?.id).toBe(PROCESSED_CATALOG_ID)
    expect(document?.sections.map((section) => section.id)).toEqual(['restaurant', 'airport'])
    expect(document?.sections[0]?.title).toBe('En el restaurante')
    expect(document?.sections[0]?.titleEn).toBe('At the restaurant')
    expect(document?.sections[0]?.bodyText).toContain('Menu body.')
  })

  it('returns null for an empty module map', () => {
    expect(loadProcessedLessonsFromModules({})).toBeNull()
  })

  it('keeps a lesson when a sibling module is unreadable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const document = loadProcessedLessonsFromModules({
      '01-ok.md': { default: '---\nid: ok\norder: 1\ntitle: Ok\n---\nBody' },
      '02-bad.md': { default: 12 },
    })
    expect(document?.sections).toHaveLength(1)
    expect(document?.sections[0]?.id).toBe('ok')
    expect(warn).toHaveBeenCalled()
  })

  it('loads the packaged glob into the English File lessons in order', () => {
    const document = loadProcessedLessons()
    expect(document?.id).toBe(PROCESSED_CATALOG_ID)
    expect(document?.sections).toHaveLength(36)
    expect(document?.sections.map((section) => section.id)).toEqual([
      'file-1a',
      'file-1b',
      'pe-1',
      'file-2a',
      'file-2b',
      'revise-1-2',
      'file-3a',
      'file-3b',
      'pe-2',
      'file-4a',
      'file-4b',
      'revise-3-4',
      'file-5a',
      'file-5b',
      'pe-3',
      'file-6a',
      'file-6b',
      'revise-5-6',
      'file-7a',
      'file-7b',
      'pe-4',
      'file-8a',
      'file-8b',
      'revise-7-8',
      'file-9a',
      'file-9b',
      'pe-5',
      'file-10a',
      'file-10b',
      'revise-9-10',
      'file-11a',
      'file-11b',
      'pe-6',
      'file-12a',
      'file-12b',
      'revise-11-12',
    ])
    expect(document?.sections[0]?.title).toMatch(/Encantado de conocerte/)
    expect(document?.sections[0]?.bodyText).not.toMatch(/^---/)
    expect(document?.sections[0]?.tema).toBe('besingular')
    expect(document?.sections[0]?.bloque).toBe('file1')
    expect(document?.sections[0]?.bloqueEs).toBe('File 1 · Conocerse')
    expect(document?.sections[1]?.tema).toBe('besingular')
    expect(document?.sections[2]?.tema).toBe('classroom')
    const bank = buildPracticeBank(
      (document?.sections ?? []).map((section) => ({
        id: section.id,
        bodyMarkdown: section.bodyText,
        ...(section.tema !== undefined ? { tema: section.tema } : {}),
      })),
    )
    expect(bank.vocab.length).toBeGreaterThan(20)
    expect(bank.traducir.length).toBeGreaterThan(20)
    expect(bank.completar.length).toBeGreaterThan(0)
    expect(itemsForMode(bank, 'transformar', 'besingular').length).toBeGreaterThan(0)
    expect(itemsForMode(bank, 'transformar', 'dates')).toEqual([])
  })

  it('does not drop a file when titleEn is invalid', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const document = loadProcessedLessonsFromModules({
      '01-hotel.md': `---
id: hotel
order: 1
title: En el hotel
titleEn:
---
Room body.
`,
    })
    expect(document?.sections[0]?.id).toBe('hotel')
    expect(document?.sections[0]?.titleEn).toBeUndefined()
    expect(document?.sections[0]?.bodyText).toContain('Room body.')
    expect(warn).toHaveBeenCalled()
  })

  it('keeps a lesson when tema is invalid', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const document = loadProcessedLessonsFromModules({
      '01-hotel.md': `---
id: hotel
order: 1
title: En el hotel
tema: be_singular
bloque: File_1
---
Room body.
`,
    })
    expect(document?.sections[0]?.id).toBe('hotel')
    expect(document?.sections[0]?.tema).toBeUndefined()
    expect(document?.sections[0]?.bloque).toBeUndefined()
    expect(document?.sections[0]?.bodyText).toContain('Room body.')
    expect(warn).toHaveBeenCalled()
  })
})
