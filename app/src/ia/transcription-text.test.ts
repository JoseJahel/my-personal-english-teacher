import { describe, expect, it } from 'vitest'
import {
  isDegenerateTranscript,
  isNonSpeechTranscript,
  isUnusableTranscript,
} from './transcription-text'

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

describe('isDegenerateTranscript', () => {
  it('detects massive token loops like the WebGPU/q8 failure mode', () => {
    const loop = Array.from({ length: 40 }, () => 'biasesVIDEO').join(' ')
    expect(isDegenerateTranscript(loop, 3)).toBe(true)
  })

  it('detects compact substring loops', () => {
    expect(isDegenerateTranscript('bidmie'.repeat(30), 2)).toBe(true)
  })

  it('detects absurd length for short audio', () => {
    const longText = 'word '.repeat(200)
    expect(isDegenerateTranscript(longText, 2)).toBe(true)
  })

  it('allows normal short English', () => {
    expect(isDegenerateTranscript('I would like a glass of water please.', 3)).toBe(false)
  })
})

describe('isUnusableTranscript', () => {
  it('is true for non-speech or degenerate text', () => {
    expect(isUnusableTranscript('[Music]')).toBe(true)
    expect(isUnusableTranscript('biasesVIDEO '.repeat(20), 2)).toBe(true)
    expect(isUnusableTranscript('Hello there.', 1)).toBe(false)
  })
})
