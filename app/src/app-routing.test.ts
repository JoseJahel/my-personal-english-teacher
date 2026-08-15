import { describe, expect, it } from 'vitest'
import { shouldShowAsrBenchmarkScreen, shouldShowShellPreviewScreen } from './app-routing'

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

describe('shouldShowShellPreviewScreen', () => {
  it('is true in dev for shell preview hashes', () => {
    expect(shouldShowShellPreviewScreen(true, '#shell-preview')).toBe(true)
    expect(shouldShowShellPreviewScreen(true, '#shell-preview-filled')).toBe(true)
    expect(shouldShowShellPreviewScreen(true, '#shell-preview-listening')).toBe(true)
    expect(shouldShowShellPreviewScreen(true, '#shell-preview-composing')).toBe(true)
  })

  it('is false outside dev', () => {
    expect(shouldShowShellPreviewScreen(false, '#shell-preview')).toBe(false)
  })

  it('is false for unrelated hashes', () => {
    expect(shouldShowShellPreviewScreen(true, '#asr-benchmark')).toBe(false)
    expect(shouldShowShellPreviewScreen(true, '')).toBe(false)
  })
})

