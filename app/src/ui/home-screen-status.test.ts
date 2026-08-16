import { describe, expect, it } from 'vitest'
import {
  isTutorPlaybackActive,
  shouldShowTutorModelPreparingBanner,
  shouldShowTutorTypingIndicator,
  transcriptionStatusMessageFor,
  tutorGenerationStatusMessageFor,
} from './home-screen-status'
import { homeScreenInterfaceTexts } from './interface-texts'

describe('tutorGenerationStatusMessageFor', () => {
  it('shows a Spanish "preparing conversational tutor" message with progress while loading', () => {
    expect(tutorGenerationStatusMessageFor('loading-model', 42)).toBe(
      'Preparando tutor conversacional… 42%',
    )
  })

  it('shows a typing message while the LLM generates', () => {
    expect(tutorGenerationStatusMessageFor('generating', 100)).toBe('El tutor está escribiendo…')
  })

  it('distinguishes generated vs fallback done states', () => {
    expect(tutorGenerationStatusMessageFor('done-generated', 100)).toMatch(/generada/i)
    expect(tutorGenerationStatusMessageFor('done-fallback', 100)).toMatch(/respaldo/i)
  })
})

describe('shouldShowTutorModelPreparingBanner', () => {
  it('is true only while the conversation model is downloading', () => {
    expect(shouldShowTutorModelPreparingBanner('loading-model')).toBe(true)
    expect(shouldShowTutorModelPreparingBanner('idle')).toBe(false)
    expect(shouldShowTutorModelPreparingBanner('generating')).toBe(false)
  })
})

describe('shouldShowTutorTypingIndicator', () => {
  it('is true only while the tutor reply is being generated', () => {
    expect(shouldShowTutorTypingIndicator('generating')).toBe(true)
    expect(shouldShowTutorTypingIndicator('loading-model')).toBe(false)
    expect(shouldShowTutorTypingIndicator('done-generated')).toBe(false)
  })
})

describe('isTutorPlaybackActive', () => {
  it('is true only while SpeechT5 is loading, synthesizing, or playing', () => {
    expect(isTutorPlaybackActive('loading-model')).toBe(true)
    expect(isTutorPlaybackActive('synthesizing')).toBe(true)
    expect(isTutorPlaybackActive('playing')).toBe(true)
    expect(isTutorPlaybackActive('idle')).toBe(false)
    expect(isTutorPlaybackActive('done')).toBe(false)
    expect(isTutorPlaybackActive('error')).toBe(false)
  })
})

describe('transcriptionStatusMessageFor', () => {
  it('shows the approx download size and "solo la primera vez" while loading the ASR model', () => {
    const message = transcriptionStatusMessageFor('loading-model', 40, null, null, 40)
    expect(message).toBe(
      homeScreenInterfaceTexts.transcriptionStatusMessages.modelLoadingProgressMessage(40, 40),
    )
    expect(message).toContain('40 MB')
    expect(message).toContain('solo la primera vez')
  })

  it('keeps the idle/transcribing messages unchanged by the new parameter', () => {
    expect(transcriptionStatusMessageFor('idle', 0, null)).toBe(
      homeScreenInterfaceTexts.transcriptionStatusMessages.idle,
    )
    expect(transcriptionStatusMessageFor('transcribing', 100, null)).toBe(
      homeScreenInterfaceTexts.transcriptionStatusMessages.transcribing,
    )
  })
})
