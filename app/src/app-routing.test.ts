import { describe, expect, it } from 'vitest'
import { shouldShowAsrBenchmarkScreen } from './app-routing'

describe('shouldShowAsrBenchmarkScreen', () => {
  it('is true only in dev with the exact benchmark hash', () => {
    expect(shouldShowAsrBenchmarkScreen(true, '#asr-benchmark')).toBe(true)
  })

  it('is false outside dev even with the right hash', () => {
    expect(shouldShowAsrBenchmarkScreen(false, '#asr-benchmark')).toBe(false)
  })

  it('is false in dev with no hash or a different hash', () => {
    expect(shouldShowAsrBenchmarkScreen(true, '')).toBe(false)
    expect(shouldShowAsrBenchmarkScreen(true, '#other')).toBe(false)
  })
})
