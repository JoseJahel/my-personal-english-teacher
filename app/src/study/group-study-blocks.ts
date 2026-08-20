import type { StudySection } from './study-types'

export interface StudyIndexItem {
  readonly index: number
  readonly section: StudySection
}

export type StudyIndexGroup =
  | {
      readonly type: 'block'
      readonly bloque: string
      readonly bloqueEs: string
      readonly items: readonly StudyIndexItem[]
    }
  | {
      readonly type: 'loose'
      readonly items: readonly StudyIndexItem[]
    }

/**
 * Groups contiguous sections that share `bloque`.
 * Same key with a gap → two boxes. Missing `bloque` → a loose row.
 */
export function groupStudyBlocks(sections: readonly StudySection[]): readonly StudyIndexGroup[] {
  const groups: StudyIndexGroup[] = []
  sections.forEach((section, index) => {
    const key = section.bloque ?? ''
    const item: StudyIndexItem = { index, section }
    const last = groups[groups.length - 1]
    if (key.length > 0 && last?.type === 'block' && last.bloque === key) {
      groups[groups.length - 1] = { ...last, items: [...last.items, item] }
      return
    }
    if (key.length > 0) {
      const bloqueEs = section.bloqueEs?.trim() || key
      groups.push({ type: 'block', bloque: key, bloqueEs, items: [item] })
      return
    }
    groups.push({ type: 'loose', items: [item] })
  })
  return groups
}
