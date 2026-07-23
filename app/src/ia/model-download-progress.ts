/**
 * Aggregates transformers.js per-file download events into one overall %
 * for the UI. Raw `event.progress` resets on every new file (30 → 18 → 45);
 * this tracker uses bytes across files and stays monotonic when possible.
 */

export type ModelDownloadProgressEvent = {
  readonly status: string
  readonly file?: string
  readonly progress?: number
  readonly loaded?: number
  readonly total?: number
}

type FileByteProgress = {
  loaded: number
  total: number
}

/**
 * Stateful aggregator: one instance per model load attempt.
 * Call `handleEvent` for each transformers.js progress callback payload.
 * Returns the percent to show (0–100), or `null` if the event should not
 * update the UI (e.g. pipeline `ready` without bytes).
 */
export class AggregateModelDownloadProgress {
  private readonly files = new Map<string, FileByteProgress>()
  private lastReportedPercent = 0
  private lastKnownTotalBytes = 0

  /** Reset when starting a new load (e.g. WebGPU → WASM retry). */
  reset(): void {
    this.files.clear()
    this.lastReportedPercent = 0
    this.lastKnownTotalBytes = 0
  }

  handleEvent(event: ModelDownloadProgressEvent): number | null {
    const fileName = event.file
    if (!fileName) {
      return null
    }

    switch (event.status) {
      case 'initiate':
      case 'download': {
        if (!this.files.has(fileName)) {
          this.files.set(fileName, { loaded: 0, total: 0 })
        }
        return this.computeDisplayPercent()
      }
      case 'progress': {
        const loaded = event.loaded ?? 0
        const total = event.total ?? 0
        this.files.set(fileName, { loaded, total })
        return this.computeDisplayPercent()
      }
      case 'done': {
        const previous = this.files.get(fileName)
        if (previous && previous.total > 0) {
          this.files.set(fileName, { loaded: previous.total, total: previous.total })
        } else if (previous) {
          this.files.set(fileName, {
            loaded: previous.loaded,
            total: previous.total > 0 ? previous.total : previous.loaded,
          })
        } else {
          this.files.set(fileName, { loaded: 1, total: 1 })
        }
        return this.computeDisplayPercent()
      }
      default:
        return null
    }
  }

  /** Force 100% when the pipeline reports ready / load finished. */
  markComplete(): number {
    this.lastReportedPercent = 100
    return 100
  }

  private computeDisplayPercent(): number {
    let loadedBytes = 0
    let totalBytes = 0

    for (const fileProgress of this.files.values()) {
      loadedBytes += fileProgress.loaded
      totalBytes += fileProgress.total
    }

    if (totalBytes <= 0) {
      return this.lastReportedPercent
    }

    // New files appear after small configs finish: scale the high-water mark
    // so the bar does not jump 100% → 2% when a large ONNX file is discovered.
    if (this.lastKnownTotalBytes > 0 && totalBytes > this.lastKnownTotalBytes) {
      this.lastReportedPercent = Math.floor(
        (this.lastReportedPercent * this.lastKnownTotalBytes) / totalBytes,
      )
    }
    this.lastKnownTotalBytes = totalBytes

    const overallPercent = Math.min(100, Math.floor((loadedBytes / totalBytes) * 100))
    this.lastReportedPercent = Math.max(this.lastReportedPercent, overallPercent)
    return this.lastReportedPercent
  }
}
