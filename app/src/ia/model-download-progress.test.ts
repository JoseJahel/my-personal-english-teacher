import { describe, expect, it } from 'vitest'
import { AggregateModelDownloadProgress } from './model-download-progress'

describe('AggregateModelDownloadProgress', () => {
  it('aggregates multi-file downloads into one increasing overall percent', () => {
    const tracker = new AggregateModelDownloadProgress()

    // Tiny config finishes first (would look like 100% if shown per-file).
    expect(
      tracker.handleEvent({
        status: 'progress',
        file: 'config.json',
        progress: 100,
        loaded: 1000,
        total: 1000,
      }),
    ).toBe(100)

    // Large weights start: scale high-water so UI does not stick at 100% early,
    // then climb with real bytes.
    const afterNewFile = tracker.handleEvent({
      status: 'progress',
      file: 'model.onnx',
      progress: 0,
      loaded: 0,
      total: 9_000,
    })
    expect(afterNewFile).toBe(10) // 1000/10000 after scaling 100 * 1000/10000

    const mid = tracker.handleEvent({
      status: 'progress',
      file: 'model.onnx',
      progress: 50,
      loaded: 4_500,
      total: 9_000,
    })
    expect(mid).toBe(55) // (1000+4500)/10000

    const doneOnnx = tracker.handleEvent({
      status: 'progress',
      file: 'model.onnx',
      progress: 100,
      loaded: 9_000,
      total: 9_000,
    })
    expect(doneOnnx).toBe(100)
  })

  it('never decreases percent within a stable total', () => {
    const tracker = new AggregateModelDownloadProgress()

    const first = tracker.handleEvent({
      status: 'progress',
      file: 'a.bin',
      progress: 40,
      loaded: 40,
      total: 100,
    })
    expect(first).toBe(40)

    // Out-of-order / lower report for same totals must not go backwards.
    const second = tracker.handleEvent({
      status: 'progress',
      file: 'a.bin',
      progress: 20,
      loaded: 20,
      total: 100,
    })
    expect(second).toBe(40)
  })

  it('marks complete at 100', () => {
    const tracker = new AggregateModelDownloadProgress()
    expect(tracker.markComplete()).toBe(100)
  })

  it('treats done events as full file progress', () => {
    const tracker = new AggregateModelDownloadProgress()
    tracker.handleEvent({
      status: 'progress',
      file: 'tok.json',
      progress: 50,
      loaded: 50,
      total: 100,
    })
    const afterDone = tracker.handleEvent({ status: 'done', file: 'tok.json' })
    expect(afterDone).toBe(100)
  })
})
