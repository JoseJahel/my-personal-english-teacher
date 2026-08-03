/**
 * Pure helpers for the ASR benchmark screen: cartesian run plan, per
 * combination averages, and JSON/CSV export for the course report.
 */

import type { AsrModelCandidateId } from '../ia/model-registry'
import type { OnnxInferenceDevice } from '../ia/resolve-inference-device'

export interface BenchmarkRunCombination {
  readonly candidateId: AsrModelCandidateId
  readonly device: OnnxInferenceDevice
}

export interface BenchmarkFixtureRunResult {
  readonly combination: BenchmarkRunCombination
  readonly fixtureId: string
  readonly referenceTextEn: string
  readonly hypothesisTextEn: string
  readonly latencyMilliseconds: number
  readonly modelLoadMilliseconds: number | null
  readonly wordErrorRate: number
}

export interface BenchmarkCombinationSummary {
  readonly combination: BenchmarkRunCombination
  readonly fixtureCount: number
  readonly averageWordErrorRate: number
  readonly averageLatencyMilliseconds: number
  readonly modelLoadMilliseconds: number | null
}

/** Cartesian product of candidates × devices, in that iteration order. */
export function buildBenchmarkRunPlan(
  candidateIds: readonly AsrModelCandidateId[],
  devices: readonly OnnxInferenceDevice[],
): BenchmarkRunCombination[] {
  const plan: BenchmarkRunCombination[] = []
  for (const candidateId of candidateIds) {
    for (const device of devices) {
      plan.push({ candidateId, device })
    }
  }
  return plan
}

function combinationKey(combination: BenchmarkRunCombination): string {
  return `${combination.candidateId}::${combination.device}`
}

/**
 * Groups results by candidate + device and averages WER and latency.
 * Takes the first non-null `modelLoadMilliseconds` in each bucket: the model
 * loads once per combination, and the remaining fixtures report `null`.
 */
export function summarizeBenchmarkResults(
  results: readonly BenchmarkFixtureRunResult[],
): BenchmarkCombinationSummary[] {
  const buckets = new Map<string, BenchmarkFixtureRunResult[]>()
  for (const result of results) {
    const key = combinationKey(result.combination)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(result)
    } else {
      buckets.set(key, [result])
    }
  }

  const summaries: BenchmarkCombinationSummary[] = []
  for (const bucket of buckets.values()) {
    const fixtureCount = bucket.length
    const totalWordErrorRate = bucket.reduce((sum, item) => sum + item.wordErrorRate, 0)
    const totalLatencyMilliseconds = bucket.reduce((sum, item) => sum + item.latencyMilliseconds, 0)
    const modelLoadMilliseconds =
      bucket.find((item) => item.modelLoadMilliseconds !== null)?.modelLoadMilliseconds ?? null

    summaries.push({
      combination: bucket[0]!.combination,
      fixtureCount,
      averageWordErrorRate: totalWordErrorRate / fixtureCount,
      averageLatencyMilliseconds: totalLatencyMilliseconds / fixtureCount,
      modelLoadMilliseconds,
    })
  }
  return summaries
}

const CSV_HEADER =
  'candidateId,device,fixtureCount,averageWordErrorRate,averageLatencyMilliseconds,modelLoadMilliseconds'

/** CSV with a fixed header and one row per combination, for the course report. */
export function exportBenchmarkResultsToCsv(
  summaries: readonly BenchmarkCombinationSummary[],
): string {
  // CSV-safe by construction: candidateId/device are closed unions; do not
  // add raw-text columns without escaping.
  const rows = summaries.map((summary) => {
    const modelLoadCell =
      summary.modelLoadMilliseconds === null ? '' : summary.modelLoadMilliseconds.toFixed(1)
    return [
      summary.combination.candidateId,
      summary.combination.device,
      summary.fixtureCount,
      summary.averageWordErrorRate.toFixed(4),
      summary.averageLatencyMilliseconds.toFixed(1),
      modelLoadCell,
    ].join(',')
  })
  return [CSV_HEADER, ...rows].join('\n')
}

/** Pretty-printed JSON export of the summaries, for archival/tooling use. */
export function exportBenchmarkResultsToJson(
  summaries: readonly BenchmarkCombinationSummary[],
): string {
  return JSON.stringify(summaries, null, 2)
}
