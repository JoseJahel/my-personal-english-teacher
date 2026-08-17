import { describe, expect, it } from 'vitest'
import {
  VOWEL_MAP_F1_MAX_HZ,
  VOWEL_MAP_F2_MAX_HZ,
  collectFormantMapHistory,
  formantTripleToMapPoint,
  mapFormantHzToCanvasPoint,
} from './formant-vowel-map'
import type { PracticeTurnRecord } from '../storage/practice-session-types'

const canvas = { width: 320, height: 200 }

function turn(overrides: Partial<PracticeTurnRecord>): PracticeTurnRecord {
  return {
    id: 'turn',
    sessionId: 'session',
    scenarioId: 'restaurant',
    createdAtIso: '2026-08-17T12:00:00.000Z',
    transcribedText: 'hello',
    correctedText: 'hello',
    tutorReplyText: 'hi',
    tutorUsedFallback: false,
    pronunciationScore0to100: 70,
    mfccScore0to100: 70,
    pitchScore0to100: null,
    formantF1InHertz: null,
    formantF2InHertz: null,
    formantF3InHertz: null,
    wordHighlightSummary: '',
    spokenProgress: null,
    ...overrides,
  }
}

describe('formantTripleToMapPoint', () => {
  it('returns null without both positive formants', () => {
    expect(formantTripleToMapPoint(null)).toBeNull()
    expect(formantTripleToMapPoint({ f1InHertz: 500, f2InHertz: null })).toBeNull()
  })
})

describe('mapFormantHzToCanvasPoint', () => {
  it('returns null when F1 or F2 is missing', () => {
    expect(mapFormantHzToCanvasPoint({ f1InHertz: null, f2InHertz: 1400 }, canvas)).toBeNull()
    expect(mapFormantHzToCanvasPoint({ f1InHertz: 500, f2InHertz: null }, canvas)).toBeNull()
  })

  it('places high F2 (front) to the left of low F2 (back)', () => {
    const front = mapFormantHzToCanvasPoint({ f1InHertz: 300, f2InHertz: VOWEL_MAP_F2_MAX_HZ }, canvas)
    const back = mapFormantHzToCanvasPoint({ f1InHertz: 300, f2InHertz: 800 }, canvas)
    expect(front).not.toBeNull()
    expect(back).not.toBeNull()
    expect(front!.x).toBeLessThan(back!.x)
  })

  it('places low F1 (high vowel) above high F1 (low vowel)', () => {
    const highVowel = mapFormantHzToCanvasPoint({ f1InHertz: 250, f2InHertz: 1500 }, canvas)
    const lowVowel = mapFormantHzToCanvasPoint(
      { f1InHertz: VOWEL_MAP_F1_MAX_HZ, f2InHertz: 1500 },
      canvas,
    )
    expect(highVowel).not.toBeNull()
    expect(lowVowel).not.toBeNull()
    expect(highVowel!.y).toBeLessThan(lowVowel!.y)
  })
})

describe('collectFormantMapHistory', () => {
  it('keeps only turns with F1 and F2, newest first, capped', () => {
    const points = collectFormantMapHistory(
      [
        turn({ id: 'old', createdAtIso: '2026-08-01T00:00:00.000Z', formantF1InHertz: 400, formantF2InHertz: 1200 }),
        turn({ id: 'skip', formantF1InHertz: 400, formantF2InHertz: null }),
        turn({ id: 'new', createdAtIso: '2026-08-17T00:00:00.000Z', formantF1InHertz: 520, formantF2InHertz: 1420 }),
      ],
      { limit: 8 },
    )
    expect(points).toEqual([
      { id: 'new', f1InHertz: 520, f2InHertz: 1420 },
      { id: 'old', f1InHertz: 400, f2InHertz: 1200 },
    ])
  })
})
