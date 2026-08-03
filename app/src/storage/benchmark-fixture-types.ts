/**
 * Serializable benchmark fixture records: reference text + raw audio samples
 * used to regression-test ASR/scoring quality across model changes.
 *
 * Pure module: no IndexedDB here (that lives in benchmark-fixture-store.ts,
 * Task 3.8). This file only defines the shape and JSON (de)serialization.
 */

/** One benchmark fixture: reference sentence + the audio recorded for it. */
export interface BenchmarkFixtureRecord {
  readonly id: string
  readonly referenceTextEn: string
  readonly sampleRateInHertz: number
  readonly samplesBuffer: ArrayBuffer
  readonly createdAtIso: string
}

export interface CreateBenchmarkFixtureInput {
  readonly referenceTextEn: string
  readonly sampleRateInHertz: number
  readonly samplesBuffer: ArrayBuffer
}

/** Build a fixture record (pure; no IDB). */
export function createBenchmarkFixtureRecord(
  input: CreateBenchmarkFixtureInput,
  options?: {
    readonly id?: string
    readonly createdAtIso?: string
  },
): BenchmarkFixtureRecord {
  return {
    id: options?.id ?? createBenchmarkFixtureId(),
    referenceTextEn: input.referenceTextEn.trim(),
    sampleRateInHertz: input.sampleRateInHertz,
    samplesBuffer: input.samplesBuffer,
    createdAtIso: options?.createdAtIso ?? new Date().toISOString(),
  }
}

export function createBenchmarkFixtureId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** JSON-safe form of a fixture: audio bytes as base64 instead of an ArrayBuffer. */
export interface SerializedBenchmarkFixture {
  readonly id: string
  readonly referenceTextEn: string
  readonly sampleRateInHertz: number
  readonly samplesBase64: string
  readonly createdAtIso: string
}

export function serializeFixtureForExport(
  record: BenchmarkFixtureRecord,
): SerializedBenchmarkFixture {
  return {
    id: record.id,
    referenceTextEn: record.referenceTextEn,
    sampleRateInHertz: record.sampleRateInHertz,
    samplesBase64: arrayBufferToBase64(record.samplesBuffer),
    createdAtIso: record.createdAtIso,
  }
}

export function deserializeFixtureFromImport(
  serialized: SerializedBenchmarkFixture,
): BenchmarkFixtureRecord {
  return {
    id: serialized.id,
    referenceTextEn: serialized.referenceTextEn,
    sampleRateInHertz: serialized.sampleRateInHertz,
    samplesBuffer: base64ToArrayBuffer(serialized.samplesBase64),
    createdAtIso: serialized.createdAtIso,
  }
}

/** Converts byte-by-byte (no spread/apply) so large audio buffers never overflow the call stack. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/** Whole-file export shape: a versioned envelope around a list of fixtures. */
export interface BenchmarkFixtureExportFile {
  readonly formatVersion: 1
  readonly exportedAtIso: string
  readonly fixtures: readonly SerializedBenchmarkFixture[]
}

/**
 * JSON export to carry fixtures to another machine (never committed to Git).
 */
export function exportFixturesToJson(fixtures: readonly BenchmarkFixtureRecord[]): string {
  const exportFile: BenchmarkFixtureExportFile = {
    formatVersion: 1,
    exportedAtIso: new Date().toISOString(),
    fixtures: fixtures.map(serializeFixtureForExport),
  }
  return JSON.stringify(exportFile, null, 2)
}

/**
 * Validates only the top-level shape (that `fixtures` is an array). Malformed
 * elements (missing/invalid `samplesBase64`, etc.) surface as raw exceptions
 * from JSON.parse/atob, not as this function's domain error — acceptable
 * since this is a dev-only tool, not a user-facing import path.
 */
export function importFixturesFromJson(json: string): readonly BenchmarkFixtureRecord[] {
  const parsed = JSON.parse(json) as Partial<BenchmarkFixtureExportFile>
  if (!Array.isArray(parsed.fixtures)) {
    throw new Error('Invalid benchmark fixture export file: missing "fixtures" array.')
  }
  return parsed.fixtures.map(deserializeFixtureFromImport)
}
