/**
 * Dev-only routing gates (never in production builds).
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
    hash === '#shell-preview-listening'
  )
}
