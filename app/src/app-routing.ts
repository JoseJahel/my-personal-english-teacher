/**
 * Dev-only routing gate for the ASR benchmark screen (never in production).
 */
export function shouldShowAsrBenchmarkScreen(isDev: boolean, hash: string): boolean {
  return isDev && hash === '#asr-benchmark'
}
