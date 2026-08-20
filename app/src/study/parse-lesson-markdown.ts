import { STUDY_KEY_PATTERN, type ProcessedLesson } from './study-types'

export type MarkdownInline =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'strong'; readonly children: readonly MarkdownInline[] }
  | { readonly type: 'em'; readonly children: readonly MarkdownInline[] }

export type MarkdownBlock =
  | { readonly type: 'heading'; readonly level: 1 | 2 | 3; readonly children: readonly MarkdownInline[] }
  | { readonly type: 'paragraph'; readonly children: readonly MarkdownInline[] }
  | { readonly type: 'list'; readonly ordered: boolean; readonly items: readonly (readonly MarkdownInline[])[] }
  | {
      readonly type: 'table'
      readonly headers: readonly (readonly MarkdownInline[])[]
      readonly rows: readonly (readonly (readonly MarkdownInline[])[])[]
    }
  | { readonly type: 'hr' }

const FRONTMATTER_OPEN = /^---\r?\n/
const DEFAULT_ORDER = 999

export function parseLessonMarkdown(raw: string, sourcePath = ''): ProcessedLesson {
  const { fields, body } = splitFrontmatter(raw)
  const id = readOptionalString(fields, 'id', sourcePath) ?? fallbackIdFromPath(sourcePath)
  const order = readOrder(fields, sourcePath) ?? fallbackOrderFromPath(sourcePath) ?? DEFAULT_ORDER
  const title = readOptionalString(fields, 'title', sourcePath) ?? fallbackTitle(id, sourcePath)
  const titleEn = readOptionalString(fields, 'titleEn', sourcePath)
  const tema = readOptionalString(fields, 'tema', sourcePath, STUDY_KEY_PATTERN)
  const bloque = readOptionalString(fields, 'bloque', sourcePath, STUDY_KEY_PATTERN)
  const bloqueEs = readOptionalString(fields, 'bloqueEs', sourcePath)
  const objetivo = readOptionalString(fields, 'objetivo', sourcePath)
  return {
    id,
    order,
    title,
    sourcePath,
    bodyMarkdown: body,
    ...(titleEn !== undefined ? { titleEn } : {}),
    ...(tema !== undefined ? { tema } : {}),
    ...(bloque !== undefined ? { bloque } : {}),
    ...(bloqueEs !== undefined ? { bloqueEs } : {}),
    ...(objetivo !== undefined ? { objetivo } : {}),
  }
}

function splitFrontmatter(raw: string): { fields: Record<string, string>; body: string } {
  const opened = raw.match(FRONTMATTER_OPEN)
  if (!opened) {
    return { fields: {}, body: raw.trim() }
  }
  const afterOpen = raw.slice(opened[0].length)
  const close = afterOpen.search(/\r?\n---[ \t]*(?:\r?\n|$)/)
  if (close === -1) {
    console.warn('Dropped lesson frontmatter without a closing fence.')
    return { fields: {}, body: raw.trim() }
  }
  const yaml = afterOpen.slice(0, close)
  const rest = afterOpen.slice(close).replace(/^\r?\n---[ \t]*/, '')
  return { fields: parseYamlFields(yaml), body: rest.replace(/^\r?\n/, '').trim() }
}

function parseYamlFields(yaml: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const line of yaml.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue
    }
    const colon = trimmed.indexOf(':')
    if (colon <= 0) {
      console.warn('Dropped invalid lesson frontmatter line.', { line: trimmed })
      continue
    }
    const key = trimmed.slice(0, colon).trim()
    const value = unquote(trimmed.slice(colon + 1).trim())
    if (key.length === 0) {
      console.warn('Dropped invalid lesson frontmatter line.', { line: trimmed })
      continue
    }
    fields[key] = value
  }
  return fields
}

function unquote(value: string): string {
  if (value.length >= 2) {
    const start = value[0]
    const end = value[value.length - 1]
    if ((start === '"' && end === '"') || (start === "'" && end === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}

function readOptionalString(
  fields: Record<string, string>,
  field: string,
  sourcePath: string,
  pattern?: RegExp,
): string | undefined {
  if (!(field in fields)) {
    return undefined
  }
  const value = fields[field]?.trim() ?? ''
  if (value.length === 0 || (pattern !== undefined && !pattern.test(value))) {
    console.warn('Dropped invalid lesson frontmatter field.', { field, sourcePath, value: fields[field] })
    return undefined
  }
  return value
}

function readOrder(fields: Record<string, string>, sourcePath: string): number | undefined {
  if (!('order' in fields)) {
    return undefined
  }
  const raw = fields.order?.trim() ?? ''
  if (!/^[0-9]+$/.test(raw)) {
    console.warn('Dropped invalid lesson frontmatter field.', { field: 'order', sourcePath, value: fields.order })
    return undefined
  }
  const order = Number(raw)
  if (!Number.isInteger(order) || order < 1) {
    console.warn('Dropped invalid lesson frontmatter field.', { field: 'order', sourcePath, value: fields.order })
    return undefined
  }
  return order
}

function fallbackIdFromPath(sourcePath: string): string {
  const stem = fileStem(sourcePath)
  const withoutOrder = stem.replace(/^\d+[.-]/, '')
  const id = (withoutOrder.length > 0 ? withoutOrder : stem).trim()
  return id.length > 0 ? id : 'lesson'
}

function fallbackOrderFromPath(sourcePath: string): number | undefined {
  const match = fileStem(sourcePath).match(/^(\d+)/)
  if (!match) {
    return undefined
  }
  const order = Number(match[1])
  if (!Number.isInteger(order) || order < 1) {
    return undefined
  }
  return order
}

function fallbackTitle(id: string, sourcePath: string): string {
  const fromId = id.replace(/[-_]+/g, ' ').trim()
  if (fromId.length > 0 && fromId !== 'lesson') {
    return fromId
  }
  const stem = fallbackIdFromPath(sourcePath).replace(/[-_]+/g, ' ').trim()
  return stem.length > 0 ? stem : 'Lesson'
}

function fileStem(sourcePath: string): string {
  const base = sourcePath.replace(/\\/g, '/').split('/').pop() ?? sourcePath
  return base.replace(/\.md$/i, '')
}

export function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      index += 1
      continue
    }
    if (isHorizontalRule(trimmed)) {
      blocks.push({ type: 'hr' })
      index += 1
      continue
    }
    const heading = matchHeading(trimmed)
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading.level,
        children: parseMarkdownInlines(heading.text),
      })
      index += 1
      continue
    }
    if (isUnorderedItem(line)) {
      const collected = collectList(lines, index, false)
      blocks.push({ type: 'list', ordered: false, items: collected.items })
      index = collected.nextIndex
      continue
    }
    if (isOrderedItem(line)) {
      const collected = collectList(lines, index, true)
      blocks.push({ type: 'list', ordered: true, items: collected.items })
      index = collected.nextIndex
      continue
    }
    if (isTableRow(trimmed)) {
      const collected = collectTable(lines, index)
      if (collected.table) {
        blocks.push(collected.table)
        index = collected.nextIndex
        continue
      }
    }
    const paragraph = collectParagraph(lines, index)
    blocks.push({ type: 'paragraph', children: parseMarkdownInlines(paragraph.text) })
    index = paragraph.nextIndex
  }
  return blocks
}

function matchHeading(trimmed: string): { level: 1 | 2 | 3; text: string } | null {
  const match = trimmed.match(/^(#{1,3}) (.+)$/)
  if (!match) {
    return null
  }
  const level = match[1]!.length as 1 | 2 | 3
  const text = match[2]!.trim()
  if (text.length === 0) {
    return null
  }
  return { level, text }
}

function isHorizontalRule(trimmed: string): boolean {
  return /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)
}

function isUnorderedItem(line: string): boolean {
  return /^[*+-] /.test(line.trimStart())
}

function isOrderedItem(line: string): boolean {
  return /^\d+\. /.test(line.trimStart())
}

function isTableRow(trimmed: string): boolean {
  return trimmed.startsWith('|') && trimmed.includes('|', 1)
}

function isTableSeparator(trimmed: string): boolean {
  if (!isTableRow(trimmed)) {
    return false
  }
  return /^[\s|:-]+$/.test(trimmed)
}

function splitTableCells(trimmed: string): string[] {
  const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '')
  return inner.split('|').map((cell) => cell.trim())
}

function collectTable(
  lines: readonly string[],
  start: number,
): {
  table: Extract<MarkdownBlock, { type: 'table' }> | null
  nextIndex: number
} {
  const bodyRows: string[][] = []
  let index = start
  let headers: string[] | null = null
  while (index < lines.length) {
    const trimmed = (lines[index] ?? '').trim()
    if (trimmed.length === 0 || !isTableRow(trimmed)) {
      break
    }
    if (isTableSeparator(trimmed)) {
      index += 1
      continue
    }
    const cells = splitTableCells(trimmed)
    if (headers === null) {
      headers = cells
    } else {
      bodyRows.push(cells)
    }
    index += 1
  }
  if (headers === null) {
    return { table: null, nextIndex: start }
  }
  return {
    table: {
      type: 'table',
      headers: headers.map((cell) => parseMarkdownInlines(cell)),
      rows: bodyRows.map((row) => row.map((cell) => parseMarkdownInlines(cell))),
    },
    nextIndex: index,
  }
}

function isBlockStart(line: string): boolean {
  const trimmed = line.trim()
  return (
    isHorizontalRule(trimmed) ||
    matchHeading(trimmed) !== null ||
    isUnorderedItem(line) ||
    isOrderedItem(line) ||
    isTableRow(trimmed)
  )
}

function collectList(
  lines: readonly string[],
  start: number,
  ordered: boolean,
): { items: (readonly MarkdownInline[])[]; nextIndex: number } {
  const items: (readonly MarkdownInline[])[] = []
  let index = start
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (line.trim().length === 0) {
      break
    }
    const isItem = ordered ? isOrderedItem(line) : isUnorderedItem(line)
    if (!isItem) {
      break
    }
    const text = line.trim().replace(ordered ? /^\d+\. / : /^[*+-] /, '')
    items.push(parseMarkdownInlines(text))
    index += 1
  }
  return { items, nextIndex: index }
}

function collectParagraph(
  lines: readonly string[],
  start: number,
): { text: string; nextIndex: number } {
  const parts: string[] = []
  let index = start
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (line.trim().length === 0 || isBlockStart(line)) {
      break
    }
    parts.push(line.trim())
    index += 1
  }
  return { text: parts.join(' '), nextIndex: index }
}

export function parseMarkdownInlines(text: string): MarkdownInline[] {
  const nodes: MarkdownInline[] = []
  let cursor = 0
  let textStart = 0

  function flush(end: number): void {
    if (end > textStart) {
      nodes.push({ type: 'text', value: text.slice(textStart, end) })
    }
  }

  while (cursor < text.length) {
    if (text.startsWith('**', cursor)) {
      const close = text.indexOf('**', cursor + 2)
      if (close !== -1) {
        flush(cursor)
        nodes.push({ type: 'strong', children: parseMarkdownInlines(text.slice(cursor + 2, close)) })
        cursor = close + 2
        textStart = cursor
        continue
      }
    }
    if (text[cursor] === '*' && text[cursor + 1] !== '*') {
      const close = findSingleStar(text, cursor + 1)
      if (close !== -1) {
        flush(cursor)
        nodes.push({ type: 'em', children: parseMarkdownInlines(text.slice(cursor + 1, close)) })
        cursor = close + 1
        textStart = cursor
        continue
      }
    }
    cursor += 1
  }
  flush(text.length)
  return nodes
}

function findSingleStar(text: string, from: number): number {
  let index = from
  while (index < text.length) {
    if (text.startsWith('**', index)) {
      index += 2
      continue
    }
    if (text[index] === '*') {
      return index
    }
    index += 1
  }
  return -1
}
