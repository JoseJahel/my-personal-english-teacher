import { describe, expect, it, vi } from 'vitest'
import {
  applyPracticeSrsResult,
  createPracticeSrsCard,
  isPracticeSrsDue,
  lookupPracticeSrsCard,
  normalizePracticeSrsCard,
  pickNextPracticeIndex,
  PRACTICE_SRS_FAIL_DELAY_MS,
  PRACTICE_SRS_INTERVAL_HOURS,
  srsItemId,
} from './practice-srs'

const NOW = 1_700_000_000_000

describe('normalizePracticeSrsCard', () => {
  it('returns a new-style eligible card from createPracticeSrsCard', () => {
    const card = createPracticeSrsCard('v1', 'besingular')
    expect(card.intervalIdx).toBe(-1)
    expect(card.dueMs).toBe(0)
    expect(isPracticeSrsDue(card, NOW)).toBe(true)
  })

  it('returns null for a missing or empty itemId and ignores extras', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(normalizePracticeSrsCard(null)).toBeNull()
    expect(normalizePracticeSrsCard({ title: 'x' })).toBeNull()
    expect(normalizePracticeSrsCard({ itemId: '   ' })).toBeNull()
    const card = normalizePracticeSrsCard({
      itemId: ' v1 ',
      intervalIdx: 1,
      dueMs: 10,
      ease: 2.5,
      reps: 3,
      lapses: 1,
      lastResult: 'ok',
      lastRatedAtIso: 't',
      tema: 'besingular',
      extra: true,
    })
    expect(card).toEqual({
      itemId: 'v1',
      intervalIdx: 1,
      dueMs: 10,
      ease: 2.5,
      reps: 3,
      lapses: 1,
      lastResult: 'ok',
      lastRatedAtIso: 't',
      tema: 'besingular',
    })
    expect(card).not.toHaveProperty('extra')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('applyPracticeSrsResult', () => {
  it('schedules a first hit ~30 minutes out and hides it until then', () => {
    const hit = applyPracticeSrsResult(null, 'v1', true, NOW, 'besingular')
    expect(hit.intervalIdx).toBe(0)
    expect(hit.dueMs).toBe(NOW + PRACTICE_SRS_INTERVAL_HOURS[0]! * 3_600_000)
    expect(isPracticeSrsDue(hit, NOW)).toBe(false)
    expect(isPracticeSrsDue(hit, NOW + PRACTICE_SRS_INTERVAL_HOURS[0]! * 3_600_000 + 60_000)).toBe(
      true,
    )
    expect(hit.reps).toBe(1)
    expect(hit.lastResult).toBe('ok')
  })

  it('brings a miss back after one minute, not tomorrow', () => {
    const miss = applyPracticeSrsResult(null, 'v1', false, NOW, 'besingular')
    expect(miss.intervalIdx).toBe(-1)
    expect(miss.dueMs).toBe(NOW + PRACTICE_SRS_FAIL_DELAY_MS)
    expect(miss.lapses).toBe(1)
    expect(isPracticeSrsDue(miss, NOW + 10_000)).toBe(false)
    expect(isPracticeSrsDue(miss, NOW + PRACTICE_SRS_FAIL_DELAY_MS + 1_000)).toBe(true)
  })
})

describe('srsItemId / lookupPracticeSrsCard', () => {
  it('namespaces bilingual ids and treats a plain id as ES→EN only', () => {
    expect(srsItemId('v1')).toBe('v1')
    expect(srsItemId('v1', null)).toBe('v1')
    expect(srsItemId('v1', 'es-en')).toBe('v1#es-en')
    expect(srsItemId('v1', 'en-es')).toBe('v1#en-es')
    const legacy = createPracticeSrsCard('v1')
    const keyed = createPracticeSrsCard('v1#es-en')
    expect(lookupPracticeSrsCard({ v1: legacy }, 'v1', 'es-en')).toBe(legacy)
    expect(lookupPracticeSrsCard({ v1: legacy }, 'v1', 'en-es')).toBeUndefined()
    expect(lookupPracticeSrsCard({ 'v1#es-en': keyed, v1: legacy }, 'v1', 'es-en')).toBe(keyed)
  })
})

describe('pickNextPracticeIndex', () => {
  const items = [{ id: 'a' }, { id: 'b' }]

  it('skips the current index when another card is due', () => {
    const cardsById = {
      a: createPracticeSrsCard('a'),
      b: createPracticeSrsCard('b'),
    }
    expect(
      pickNextPracticeIndex({
        items,
        cardsById,
        nowMs: NOW,
        currentIndex: 0,
        random: () => 0,
      }).index,
    ).toBe(1)
  })

  it('returns -1 when nobody is due', () => {
    const later = applyPracticeSrsResult(null, 'a', true, NOW)
    const laterB = applyPracticeSrsResult(null, 'b', true, NOW)
    expect(
      pickNextPracticeIndex({
        items,
        cardsById: { a: later, b: laterB },
        nowMs: NOW,
        currentIndex: 0,
        random: () => 0,
      }).index,
    ).toBe(-1)
  })

  it('treats a bilingual item as due if the other facing is still due', () => {
    const hitEs = applyPracticeSrsResult(null, srsItemId('a', 'es-en'), true, NOW)
    const pick = pickNextPracticeIndex({
      items: [{ id: 'a' }],
      cardsById: { [srsItemId('a', 'es-en')]: hitEs },
      nowMs: NOW,
      currentIndex: 0,
      mixed: true,
      random: () => 0.9,
    })
    expect(pick.index).toBe(0)
    expect(pick.facing).toBe('en-es')
  })
})
