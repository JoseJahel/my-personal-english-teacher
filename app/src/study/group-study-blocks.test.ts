import { describe, expect, it } from 'vitest'
import { groupStudyBlocks } from './group-study-blocks'
import type { StudySection } from './study-types'

function section(
  id: string,
  title: string,
  extra: Partial<StudySection> = {},
): StudySection {
  return { id, title, bodyText: title, ...extra }
}

describe('groupStudyBlocks', () => {
  it('boxes contiguous sections that share bloque', () => {
    const groups = groupStudyBlocks([
      section('file-1a', '1A', { bloque: 'file1', bloqueEs: 'File 1 · Conocerse' }),
      section('file-1b', '1B', { bloque: 'file1', bloqueEs: 'File 1 · Conocerse' }),
      section('pe-1', 'PE1', { bloque: 'pe1', bloqueEs: 'Inglés práctico 1 · Deletrear' }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      type: 'block',
      bloque: 'file1',
      bloqueEs: 'File 1 · Conocerse',
    })
    if (groups[0]?.type !== 'block') {
      return
    }
    expect(groups[0].items.map((item) => item.section.id)).toEqual(['file-1a', 'file-1b'])
    expect(groups[0].items.map((item) => item.index)).toEqual([0, 1])
    expect(groups[1]).toMatchObject({ type: 'block', bloque: 'pe1' })
  })

  it('splits the same bloque when a different lesson sits in between', () => {
    const groups = groupStudyBlocks([
      section('a', 'A', { bloque: 'file1', bloqueEs: 'File 1' }),
      section('x', 'X', { bloque: 'pe1', bloqueEs: 'PE' }),
      section('b', 'B', { bloque: 'file1', bloqueEs: 'File 1' }),
    ])
    expect(groups.map((group) => (group.type === 'block' ? group.bloque : 'loose'))).toEqual([
      'file1',
      'pe1',
      'file1',
    ])
  })

  it('keeps sections without bloque as loose rows', () => {
    const groups = groupStudyBlocks([
      section('solo', 'Suelta'),
      section('file-1a', '1A', { bloque: 'file1', bloqueEs: 'File 1' }),
    ])
    expect(groups[0]).toMatchObject({ type: 'loose' })
    if (groups[0]?.type !== 'loose') {
      return
    }
    expect(groups[0].items[0]?.section.id).toBe('solo')
    expect(groups[1]?.type).toBe('block')
  })

  it('falls back to the bloque key when bloqueEs is missing', () => {
    const groups = groupStudyBlocks([section('a', 'A', { bloque: 'file1' })])
    expect(groups[0]).toMatchObject({ type: 'block', bloqueEs: 'file1' })
  })
})
