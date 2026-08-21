import type { PracticeFacing } from './practice-direction'

export const PRACTICE_SRS_INTERVAL_HOURS = [0.5, 4, 24, 72, 168, 336, 720, 1440] as const
export const PRACTICE_SRS_FAIL_DELAY_MS = 60_000
export const PRACTICE_SRS_MIN_EASE = 1.3
export const PRACTICE_SRS_MAX_EASE = 3
export const PRACTICE_SRS_DEFAULT_EASE = 2.3

export type PracticeSrsResult = 'ok' | 'mal'

export interface PracticeSrsCard {
  readonly itemId: string
  readonly intervalIdx: number
  readonly dueMs: number
  readonly ease: number
  readonly reps: number
  readonly lapses: number
  readonly lastResult: PracticeSrsResult | null
  readonly lastRatedAtIso: string
  readonly tema: string | null
}

export function srsItemId(itemId: string, facing?: PracticeFacing | null): string {
  if (!facing) {
    return itemId
  }
  return `${itemId}#${facing}`
}

/** Legacy plain `itemId` counts as ES→EN only. Do not rewrite the store. */
export function lookupPracticeSrsCard(
  cardsById: Readonly<Record<string, PracticeSrsCard>>,
  itemId: string,
  facing?: PracticeFacing | null,
): PracticeSrsCard | undefined {
  if (!facing) {
    return cardsById[itemId]
  }
  const keyed = cardsById[srsItemId(itemId, facing)]
  if (keyed) {
    return keyed
  }
  if (facing === 'es-en') {
    return cardsById[itemId]
  }
  return undefined
}

export function createPracticeSrsCard(itemId: string, tema: string | null = null): PracticeSrsCard {
  return {
    itemId,
    intervalIdx: -1,
    dueMs: 0,
    ease: PRACTICE_SRS_DEFAULT_EASE,
    reps: 0,
    lapses: 0,
    lastResult: null,
    lastRatedAtIso: '',
    tema,
  }
}

export function isPracticeSrsCardNew(card: PracticeSrsCard): boolean {
  return card.reps === 0 && card.lapses === 0 && card.lastResult === null
}

export function isPracticeSrsDue(card: PracticeSrsCard, nowMs: number): boolean {
  return card.dueMs <= nowMs
}

/**
 * Invalid `itemId` drops the card (not a parent record). Extra keys are ignored.
 * Other bad fields fall back to defaults.
 */
export function normalizePracticeSrsCard(raw: unknown): PracticeSrsCard | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    console.warn('Dropped invalid practice SRS card.')
    return null
  }
  const record = raw as Record<string, unknown>
  const itemId = typeof record.itemId === 'string' ? record.itemId.trim() : ''
  if (itemId.length === 0) {
    console.warn('Dropped practice SRS card with invalid itemId.')
    return null
  }
  const intervalIdx = Number(record.intervalIdx)
  const dueMs = Number(record.dueMs)
  const ease = Number(record.ease)
  const reps = Number(record.reps)
  const lapses = Number(record.lapses)
  const lastResult = record.lastResult === 'ok' || record.lastResult === 'mal' ? record.lastResult : null
  const lastRatedAtIso = typeof record.lastRatedAtIso === 'string' ? record.lastRatedAtIso : ''
  const tema = typeof record.tema === 'string' ? record.tema : null
  return {
    itemId,
    intervalIdx: Number.isFinite(intervalIdx) ? Math.trunc(intervalIdx) : -1,
    dueMs: Number.isFinite(dueMs) && dueMs >= 0 ? dueMs : 0,
    ease: Number.isFinite(ease) && ease > 0 ? ease : PRACTICE_SRS_DEFAULT_EASE,
    reps: Number.isFinite(reps) && reps > 0 ? Math.trunc(reps) : 0,
    lapses: Number.isFinite(lapses) && lapses > 0 ? Math.trunc(lapses) : 0,
    lastResult,
    lastRatedAtIso,
    tema,
  }
}

export function applyPracticeSrsResult(
  card: PracticeSrsCard | null,
  itemId: string,
  ok: boolean,
  nowMs: number = Date.now(),
  tema: string | null = null,
): PracticeSrsCard {
  const now = nowMs
  const base = card ?? createPracticeSrsCard(itemId, tema)
  const lastRatedAtIso = new Date(now).toISOString()
  const nextTema = tema ?? base.tema
  if (ok) {
    const stepped = (Number.isFinite(base.intervalIdx) ? base.intervalIdx : -1) + 1
    const intervalIdx = Math.min(Math.max(stepped, 0), PRACTICE_SRS_INTERVAL_HOURS.length - 1)
    const hours = PRACTICE_SRS_INTERVAL_HOURS[intervalIdx] ?? 0.5
    return {
      ...base,
      itemId,
      intervalIdx,
      dueMs: now + hours * 3_600_000,
      ease: Math.min(PRACTICE_SRS_MAX_EASE, base.ease + 0.05),
      reps: base.reps + 1,
      lastResult: 'ok',
      lastRatedAtIso,
      tema: nextTema,
    }
  }
  return {
    ...base,
    itemId,
    intervalIdx: -1,
    dueMs: now + PRACTICE_SRS_FAIL_DELAY_MS,
    ease: Math.max(PRACTICE_SRS_MIN_EASE, base.ease - 0.2),
    lapses: base.lapses + 1,
    lastResult: 'mal',
    lastRatedAtIso,
    tema: nextTema,
  }
}

export function practiceSrsWeight(card: PracticeSrsCard, nowMs: number): number {
  if (!isPracticeSrsDue(card, nowMs)) {
    return 0
  }
  let weight = 1
  if (isPracticeSrsCardNew(card)) {
    weight += 16
  }
  if (card.dueMs <= nowMs) {
    weight += 8
  }
  if (card.lapses > 0) {
    weight += Math.min(6, card.lapses * 2)
  }
  return weight
}

export type PracticeSrsPick = {
  readonly index: number
  readonly facing: PracticeFacing | null
}

function facingsToScan(args: {
  readonly facing?: PracticeFacing | null
  readonly mixed?: boolean
}): readonly (PracticeFacing | null)[] {
  if (args.mixed) {
    return ['es-en', 'en-es']
  }
  return [args.facing ?? null]
}

export function pickNextPracticeIndex(args: {
  readonly items: readonly { readonly id: string }[]
  readonly cardsById: Readonly<Record<string, PracticeSrsCard>>
  readonly nowMs: number
  readonly currentIndex: number
  readonly random?: () => number
  readonly facing?: PracticeFacing | null
  readonly mixed?: boolean
}): PracticeSrsPick {
  const random = args.random ?? Math.random
  const candidates: { i: number; facing: PracticeFacing | null; peso: number }[] = []
  const facings = facingsToScan(args)
  args.items.forEach((item, index) => {
    for (const facing of facings) {
      const found = lookupPracticeSrsCard(args.cardsById, item.id, facing)
      const card = found ?? createPracticeSrsCard(srsItemId(item.id, facing))
      const peso = practiceSrsWeight(card, args.nowMs)
      if (peso > 0) {
        candidates.push({ i: index, facing, peso })
      }
    }
  })
  if (candidates.length === 0) {
    return { index: -1, facing: null }
  }
  if (candidates.length === 1) {
    return { index: candidates[0]!.i, facing: candidates[0]!.facing }
  }
  const withoutCurrent = candidates.filter((candidate) => candidate.i !== args.currentIndex)
  const pool = withoutCurrent.length > 0 ? withoutCurrent : candidates
  const total = pool.reduce((sum, candidate) => sum + candidate.peso, 0)
  let dart = random() * total
  for (const candidate of pool) {
    dart -= candidate.peso
    if (dart <= 0) {
      return { index: candidate.i, facing: candidate.facing }
    }
  }
  const last = pool[pool.length - 1]!
  return { index: last.i, facing: last.facing }
}
