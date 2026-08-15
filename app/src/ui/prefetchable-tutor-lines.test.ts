import { describe, expect, it } from 'vitest'
import { listPrefetchableTutorLinesEn } from './prefetchable-tutor-lines'
import { getPracticeScenarioById } from './practice-scenarios'

describe('listPrefetchableTutorLinesEn', () => {
  it('includes every curated opening and follow-up so SpeechT5 can warm the cache', () => {
    const lines = listPrefetchableTutorLinesEn()
    const restaurant = getPracticeScenarioById('restaurant')

    expect(lines).toContain(restaurant.tutorOpeningLineEn)
    for (const followUp of restaurant.tutorFollowUpLinesEn) {
      expect(lines).toContain(followUp)
    }
    expect(lines.some((line) => line.toLowerCase().includes('gate'))).toBe(true)
    expect(new Set(lines).size).toBe(lines.length)
  })
})
