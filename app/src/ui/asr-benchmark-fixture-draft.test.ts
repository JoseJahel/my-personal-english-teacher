import { describe, expect, it } from 'vitest'
import {
  benchmarkFixtureDraftErrorMessageFor,
  validateBenchmarkFixtureDraft,
} from './asr-benchmark-fixture-draft'
import { homeScreenInterfaceTexts } from './interface-texts'

describe('validateBenchmarkFixtureDraft', () => {
  it('rejects a blank reference text', () => {
    expect(validateBenchmarkFixtureDraft('   ', 16000, 16000)).toEqual({
      isValid: false,
      reason: 'missing-reference-text',
    })
  })

  it('rejects an empty recording', () => {
    expect(validateBenchmarkFixtureDraft('Hello.', 0, 16000)).toEqual({
      isValid: false,
      reason: 'empty-recording',
    })
  })

  it('rejects a recording shorter than 0.5 s', () => {
    expect(validateBenchmarkFixtureDraft('Hi.', 4000, 16000)).toEqual({
      isValid: false,
      reason: 'too-short',
    })
  })

  it('rejects a recording longer than 30 s', () => {
    expect(validateBenchmarkFixtureDraft('Long story.', 16000 * 31, 16000)).toEqual({
      isValid: false,
      reason: 'too-long',
    })
  })

  it('accepts a well-formed draft', () => {
    expect(validateBenchmarkFixtureDraft('Where is gate B10?', 16000 * 3, 16000)).toEqual({
      isValid: true,
    })
  })

  it('accepts a recording of exactly 0.5 s (inclusive lower bound)', () => {
    expect(validateBenchmarkFixtureDraft('Hi.', 8000, 16000)).toEqual({
      isValid: true,
    })
  })

  it('accepts a recording of exactly 30 s (inclusive upper bound)', () => {
    expect(validateBenchmarkFixtureDraft('Long.', 16000 * 30, 16000)).toEqual({
      isValid: true,
    })
  })
})

describe('benchmarkFixtureDraftErrorMessageFor', () => {
  it('maps every reason to its Spanish copy in interface-texts.ts', () => {
    expect(benchmarkFixtureDraftErrorMessageFor('missing-reference-text')).toBe(
      homeScreenInterfaceTexts.asrBenchmark.fixtureDraftErrorMessages.missingReferenceText,
    )
    expect(benchmarkFixtureDraftErrorMessageFor('empty-recording')).toBe(
      homeScreenInterfaceTexts.asrBenchmark.fixtureDraftErrorMessages.emptyRecording,
    )
    expect(benchmarkFixtureDraftErrorMessageFor('too-short')).toBe(
      homeScreenInterfaceTexts.asrBenchmark.fixtureDraftErrorMessages.tooShort,
    )
    expect(benchmarkFixtureDraftErrorMessageFor('too-long')).toBe(
      homeScreenInterfaceTexts.asrBenchmark.fixtureDraftErrorMessages.tooLong,
    )
  })
})
