import { describe, expect, it } from 'vitest'
import { isNonSpeechTranscript } from './transcription-text'

describe('isNonSpeechTranscript', () => {
  it('returns true for empty or whitespace-only text', () => {
    expect(isNonSpeechTranscript('')).toBe(true)
    expect(isNonSpeechTranscript('   ')).toBe(true)
  })

  it('returns true for bracketed Whisper non-speech tags', () => {
    expect(isNonSpeechTranscript('[Music]')).toBe(true)
    expect(isNonSpeechTranscript('(dramatic music)')).toBe(true)
    expect(isNonSpeechTranscript('[BLANK_AUDIO]')).toBe(true)
  })

  it('returns true for plain non-speech labels', () => {
    expect(isNonSpeechTranscript('music')).toBe(true)
    expect(isNonSpeechTranscript('Dramatic music.')).toBe(true)
  })

  it('returns false for real English speech', () => {
    expect(isNonSpeechTranscript('Hello, how are you?')).toBe(false)
    expect(isNonSpeechTranscript('I go to school every day.')).toBe(false)
  })
})
