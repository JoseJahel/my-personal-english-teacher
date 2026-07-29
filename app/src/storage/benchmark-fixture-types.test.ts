import { describe, expect, it } from 'vitest'
import {
  createBenchmarkFixtureRecord,
  deserializeFixtureFromImport,
  exportFixturesToJson,
  importFixturesFromJson,
  serializeFixtureForExport,
} from './benchmark-fixture-types'

function samplesBufferFor(values: number[]): ArrayBuffer {
  return new Float32Array(values).buffer
}

describe('createBenchmarkFixtureRecord', () => {
  it('trims the reference text and fills defaults', () => {
    const record = createBenchmarkFixtureRecord(
      {
        referenceTextEn: '  Where is gate B10?  ',
        sampleRateInHertz: 16000,
        samplesBuffer: samplesBufferFor([0.1, -0.1]),
      },
      { id: 'fixture-1', createdAtIso: '2026-07-28T00:00:00.000Z' },
    )
    expect(record.referenceTextEn).toBe('Where is gate B10?')
    expect(record.id).toBe('fixture-1')
    expect(record.createdAtIso).toBe('2026-07-28T00:00:00.000Z')
    expect(record.sampleRateInHertz).toBe(16000)
  })
})

describe('serializeFixtureForExport / deserializeFixtureFromImport', () => {
  it('round-trips the audio bytes exactly', () => {
    const original = createBenchmarkFixtureRecord(
      {
        referenceTextEn: 'Two coffees, please.',
        sampleRateInHertz: 16000,
        samplesBuffer: samplesBufferFor([0, 0.25, -0.25, 0.5, -1]),
      },
      { id: 'fixture-2', createdAtIso: '2026-07-28T00:00:00.000Z' },
    )

    const serialized = serializeFixtureForExport(original)
    const restored = deserializeFixtureFromImport(serialized)

    expect(restored.id).toBe(original.id)
    expect(restored.referenceTextEn).toBe(original.referenceTextEn)
    expect(restored.sampleRateInHertz).toBe(original.sampleRateInHertz)
    expect(restored.createdAtIso).toBe(original.createdAtIso)
    expect(Array.from(new Float32Array(restored.samplesBuffer))).toEqual(
      Array.from(new Float32Array(original.samplesBuffer)),
    )
  })
})

describe('exportFixturesToJson / importFixturesFromJson', () => {
  it('round-trips a list of fixtures through JSON', () => {
    const fixtures = [
      createBenchmarkFixtureRecord(
        {
          referenceTextEn: 'One.',
          sampleRateInHertz: 16000,
          samplesBuffer: samplesBufferFor([1, 2]),
        },
        { id: 'a', createdAtIso: '2026-07-28T00:00:00.000Z' },
      ),
      createBenchmarkFixtureRecord(
        {
          referenceTextEn: 'Two.',
          sampleRateInHertz: 16000,
          samplesBuffer: samplesBufferFor([3, 4, 5]),
        },
        { id: 'b', createdAtIso: '2026-07-28T00:01:00.000Z' },
      ),
    ]

    const json = exportFixturesToJson(fixtures)
    const imported = importFixturesFromJson(json)

    expect(imported).toHaveLength(2)
    expect(imported[0]!.id).toBe('a')
    expect(imported[1]!.referenceTextEn).toBe('Two.')
    expect(Array.from(new Float32Array(imported[1]!.samplesBuffer))).toEqual([3, 4, 5])
  })

  it('throws on a malformed export file', () => {
    expect(() => importFixturesFromJson('{"nope": true}')).toThrow(
      'Invalid benchmark fixture export file',
    )
  })
})
