import { describe, expect, it } from 'vitest'
import {
  resolvePracticeMockAccess,
  shouldShowAsrBenchmarkScreen,
  shouldShowPracticeMockScreen,
  shouldShowShellPreviewScreen,
} from './app-routing'

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

describe('shouldShowPracticeMockScreen', () => {
  it('is true in dev for the practice-mock and ensayo-ui hashes', () => {
    expect(shouldShowPracticeMockScreen(true, '#practice-mock')).toBe(true)
    expect(shouldShowPracticeMockScreen(true, '#ensayo-ui')).toBe(true)
  })

  it('is false outside dev and for production hashes', () => {
    expect(shouldShowPracticeMockScreen(false, '#practice-mock')).toBe(false)
    expect(shouldShowPracticeMockScreen(true, '')).toBe(false)
    expect(shouldShowPracticeMockScreen(true, '#shell-preview')).toBe(false)
  })
})

describe('resolvePracticeMockAccess', () => {
  const base = {
    isDev: true,
    hash: '#practice-mock',
    search: '',
    skipStored: false,
    sessionConfirmed: false,
  }

  it('is off without the mock hash or outside dev', () => {
    expect(resolvePracticeMockAccess({ ...base, hash: '' })).toBe('off')
    expect(resolvePracticeMockAccess({ ...base, isDev: false })).toBe('off')
  })

  it('opens a confirmation gate on first visit to the mock hash', () => {
    expect(resolvePracticeMockAccess(base)).toBe('gate')
    expect(resolvePracticeMockAccess({ ...base, hash: '#ensayo-ui' })).toBe('gate')
    expect(resolvePracticeMockAccess({ ...base, search: '?ensayo=1' })).toBe('gate')
  })

  it('stays off after the user chose the real microphone, even if the hash returns', () => {
    expect(resolvePracticeMockAccess({ ...base, skipStored: true })).toBe('off')
    expect(
      resolvePracticeMockAccess({ ...base, skipStored: true, search: '?ensayo=1' }),
    ).toBe('off')
  })

  it('enters the mock session only after confirm or an explicit force query', () => {
    expect(resolvePracticeMockAccess({ ...base, sessionConfirmed: true })).toBe('session')
    expect(resolvePracticeMockAccess({ ...base, search: '?forzar-ensayo=1' })).toBe(
      'session',
    )
    expect(
      resolvePracticeMockAccess({
        ...base,
        skipStored: true,
        search: '?forzar-ensayo=1',
      }),
    ).toBe('session')
  })
})

