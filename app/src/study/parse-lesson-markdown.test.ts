import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseLessonMarkdown, parseMarkdownBlocks } from './parse-lesson-markdown'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseLessonMarkdown', () => {
  it('reads valid frontmatter and keeps the body', () => {
    const lesson = parseLessonMarkdown(
      `---
id: restaurant
order: 1
title: En el restaurante
titleEn: At the restaurant
---

## Qué vas a aprender

Pedir mesa.
`,
      '01-en-el-restaurante.md',
    )
    expect(lesson.id).toBe('restaurant')
    expect(lesson.order).toBe(1)
    expect(lesson.title).toBe('En el restaurante')
    expect(lesson.titleEn).toBe('At the restaurant')
    expect(lesson.bodyMarkdown).toContain('Qué vas a aprender')
    expect(lesson.bodyMarkdown).not.toMatch(/^---/)
  })

  it('reads tema, bloque, bloqueEs and objetivo when they are valid keys', () => {
    const lesson = parseLessonMarkdown(
      `---
id: file-1a
order: 1
title: 1A
titleEn: Nice to meet you
tema: besingular
bloque: file1
bloqueEs: File 1 · Conocerse
objetivo: Saludar con be en singular.
---

Cuerpo.
`,
      '01-1a.md',
    )
    expect(lesson.tema).toBe('besingular')
    expect(lesson.bloque).toBe('file1')
    expect(lesson.bloqueEs).toBe('File 1 · Conocerse')
    expect(lesson.objetivo).toBe('Saludar con be en singular.')
  })

  it('discards invalid fields and keeps the file', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const lesson = parseLessonMarkdown(
      `---
id: ""
order: -2
title:
titleEn:
extra: ignored
---

Hello body.
`,
      '04-en-el-hotel.md',
    )
    expect(lesson.id).toBe('en-el-hotel')
    expect(lesson.order).toBe(4)
    expect(lesson.title).toBe('en el hotel')
    expect(lesson.titleEn).toBeUndefined()
    expect(lesson.bodyMarkdown).toContain('Hello body.')
    expect(warn).toHaveBeenCalled()
  })

  it('drops invalid tema/bloque keys without dropping the file', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const lesson = parseLessonMarkdown(
      `---
id: file-1a
order: 1
title: 1A
tema: be_singular
bloque: File1
bloqueEs:
objetivo:
---

Cuerpo intacto.
`,
      '01-1a.md',
    )
    expect(lesson.id).toBe('file-1a')
    expect(lesson.title).toBe('1A')
    expect(lesson.tema).toBeUndefined()
    expect(lesson.bloque).toBeUndefined()
    expect(lesson.bloqueEs).toBeUndefined()
    expect(lesson.objetivo).toBeUndefined()
    expect(lesson.bodyMarkdown).toContain('Cuerpo intacto.')
    expect(warn).toHaveBeenCalled()
  })

  it('uses the whole file as body when frontmatter is missing', () => {
    const lesson = parseLessonMarkdown('## Explicación\n\nSolo cuerpo.', 'notes.md')
    expect(lesson.bodyMarkdown).toContain('Solo cuerpo.')
    expect(lesson.id).toBe('notes')
    expect(lesson.order).toBe(999)
  })
})

describe('parseMarkdownBlocks', () => {
  it('parses headings, paragraphs, lists, emphasis, and rules', () => {
    const blocks = parseMarkdownBlocks(`## Qué vas a aprender

Pide la **cuenta** con *please*.

- **menu** — la carta
- **bill** — la cuenta

1. Say the phrase out loud.
2. Translate the line.

---
`)
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 2 })
    expect(blocks[1]?.type).toBe('paragraph')
    expect(blocks[2]).toMatchObject({ type: 'list', ordered: false })
    expect(blocks[3]).toMatchObject({ type: 'list', ordered: true })
    expect(blocks[4]?.type).toBe('hr')
    const paragraph = blocks[1]
    expect(paragraph?.type).toBe('paragraph')
    if (paragraph?.type !== 'paragraph') {
      return
    }
    expect(paragraph.children.some((node) => node.type === 'strong')).toBe(true)
    expect(paragraph.children.some((node) => node.type === 'em')).toBe(true)
  })

  it('parses a grammar table and skips the separator row', () => {
    const blocks = parseMarkdownBlocks(`| Pregunta | Sí | No |
|---|---|---|
| Are you Mike? | Yes, I am. | No, I'm not. |
`)
    expect(blocks).toHaveLength(1)
    const table = blocks[0]
    expect(table?.type).toBe('table')
    if (table?.type !== 'table') {
      return
    }
    expect(table.headers).toHaveLength(3)
    expect(table.rows).toHaveLength(1)
    expect(table.rows[0]?.[0]).toEqual([{ type: 'text', value: 'Are you Mike?' }])
  })

  it('treats a non-heading line as a paragraph', () => {
    const blocks = parseMarkdownBlocks('Could I see the menu, please?')
    expect(blocks).toEqual([
      {
        type: 'paragraph',
        children: [{ type: 'text', value: 'Could I see the menu, please?' }],
      },
    ])
  })
})
