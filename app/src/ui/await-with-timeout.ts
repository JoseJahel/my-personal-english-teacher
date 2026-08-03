/**
 * Wall-clock guard for a promise that might hang forever — e.g. a WebGPU
 * driver that wedges and never settles a queued call. Used to keep UI state
 * (mic gating, "synthesizing"/"playing" status) from being blocked forever
 * by a stuck inference or playback promise.
 */

/** Rejects with the given error if the promise does not settle within timeoutMs. */
export function awaitWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: Error,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(timeoutError)
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle)
    }
  })
}
