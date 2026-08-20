/**
 * Product study desk (English File syllabus). Not dev-gated.
 */
export function shouldShowStudyScreen(hash: string): boolean {
  return hash === '#estudio'
}

/**
 * Dev-only routing gates. The practice-mock path can also be compiled into a
 * local preview build with `VITE_ENSAYO_UI=1` (issue #70). Default production
 * builds stay on the real microphone pipeline.
 */
export function shouldShowAsrBenchmarkScreen(isDev: boolean, hash: string): boolean {
  return isDev && hash === '#asr-benchmark'
}

/** Atelier shell visual fixtures for Playwright (#81). */
export function shouldShowShellPreviewScreen(isDev: boolean, hash: string): boolean {
  if (!isDev) {
    return false
  }
  return (
    hash === '#shell-preview' ||
    hash === '#shell-preview-idle' ||
    hash === '#shell-preview-filled' ||
    hash === '#shell-preview-listening' ||
    hash === '#shell-preview-composing'
  )
}

export const PRACTICE_MOCK_SKIP_STORAGE_KEY = 'mpet-skip-practice-mock'
export const PRACTICE_MOCK_FORCE_QUERY = 'forzar-ensayo'

export type PracticeMockAccess = 'off' | 'gate' | 'session'

export interface PracticeMockAccessInput {
  readonly isDev: boolean
  readonly hash: string
  readonly search: string
  readonly skipStored: boolean
  readonly sessionConfirmed: boolean
  /** `VITE_ENSAYO_UI` baked at build time. `'1'` unlocks the mock in preview. */
  readonly ensayoUiFlag?: string
}

export function isPracticeMockBuildEnabled(
  isDev: boolean,
  ensayoUiFlag?: string,
): boolean {
  return isDev || ensayoUiFlag === '1'
}

/** Real HomeScreen + injected mocks (issues #98 / #70). */
export function shouldShowPracticeMockScreen(
  isDev: boolean,
  hash: string,
  ensayoUiFlag?: string,
): boolean {
  if (!isPracticeMockBuildEnabled(isDev, ensayoUiFlag)) {
    return false
  }
  return hash === '#practice-mock' || hash === '#ensayo-ui'
}

export function hasForcePracticeMockQuery(search: string): boolean {
  const query = search.startsWith('?') ? search.slice(1) : search
  return new URLSearchParams(query).get(PRACTICE_MOCK_FORCE_QUERY) === '1'
}

/**
 * Accidental #practice-mock must not mount fake ASR.
 * First visit → confirmation gate. After “real mic”, stay off unless
 * ?forzar-ensayo=1 (César / #70).
 */
export function resolvePracticeMockAccess(input: PracticeMockAccessInput): PracticeMockAccess {
  if (!shouldShowPracticeMockScreen(input.isDev, input.hash, input.ensayoUiFlag)) {
    return 'off'
  }
  const forced = hasForcePracticeMockQuery(input.search)
  if (input.skipStored && !forced) {
    return 'off'
  }
  if (input.sessionConfirmed || forced) {
    return 'session'
  }
  return 'gate'
}

export function readPracticeMockSkipFlag(): boolean {
  try {
    return window.localStorage.getItem(PRACTICE_MOCK_SKIP_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writePracticeMockSkipFlag(skip: boolean): void {
  try {
    if (skip) {
      window.localStorage.setItem(PRACTICE_MOCK_SKIP_STORAGE_KEY, '1')
    } else {
      window.localStorage.removeItem(PRACTICE_MOCK_SKIP_STORAGE_KEY)
    }
  } catch {
    // Private mode / blocked storage: session-only gate still applies.
  }
}
