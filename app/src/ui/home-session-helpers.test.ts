import { describe, expect, it } from 'vitest'
import {
  formatFormantsSummaryMessage,
  pickBestIntentPhrase,
  resolvePrimaryActivityMessage,
} from './home-session-helpers'

describe('pickBestIntentPhrase', () => {
  it('prefers corrected text when content stays comparable', () => {
    expect(pickBestIntentPhrase('i want water', 'I want water.')).toBe('I want water.')
  })

  it('keeps short ASR when the corrector invents a long essay', () => {
    const raw = 'table for two'
    const essay =
      'I would like to reserve a table for two people near the window please thank you'
    expect(pickBestIntentPhrase(raw, essay)).toBe(raw)
  })

  it('falls back when corrected is empty', () => {
    expect(pickBestIntentPhrase('hello', '   ')).toBe('hello')
  })
})

describe('formatFormantsSummaryMessage', () => {
  it('returns null when all formants are null', () => {
    expect(
      formatFormantsSummaryMessage({
        f1InHertz: null,
        f2InHertz: null,
        f3InHertz: null,
      }),
    ).toBeNull()
  })

  it('formats rounded hertz values', () => {
    const message = formatFormantsSummaryMessage({
      f1InHertz: 501.2,
      f2InHertz: 1500.6,
      f3InHertz: null,
    })
    expect(message).toMatch(/501/)
    expect(message).toMatch(/1501/)
  })
})

describe('resolvePrimaryActivityMessage', () => {
  const base = {
    isTutorSpeaking: false,
    isStarting: false,
    isListening: false,
    isPreparingModels: false,
    microphoneStatusMessage: 'listo',
    tutorGenerationStatus: 'idle' as const,
    pronunciationStatus: 'idle' as const,
    speechSynthesisStatus: 'idle' as const,
    transcriptionStatus: 'idle' as const,
  }

  it('prioritizes listening over other statuses', () => {
    expect(resolvePrimaryActivityMessage({ ...base, isListening: true })).toMatch(/escuch/i)
  })

  it('surfaces scoring while pronunciation runs', () => {
    expect(
      resolvePrimaryActivityMessage({ ...base, pronunciationStatus: 'scoring' }),
    ).toMatch(/pronunci/i)
  })
})
