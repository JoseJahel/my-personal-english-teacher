import { describe, expect, it } from 'vitest'
import {
  buildBenchmarkRunPlan,
  exportBenchmarkResultsToCsv,
  exportBenchmarkResultsToJson,
  summarizeBenchmarkResults,
} from './asr-benchmark-results'
import type { BenchmarkFixtureRunResult } from './asr-benchmark-results'

describe('buildBenchmarkRunPlan', () => {
  it('builds the cartesian product of candidates × devices', () => {
    const plan = buildBenchmarkRunPlan(['tiny-en', 'base-en'], ['wasm', 'webgpu'])
    expect(plan).toEqual([
      { candidateId: 'tiny-en', device: 'wasm' },
      { candidateId: 'tiny-en', device: 'webgpu' },
      { candidateId: 'base-en', device: 'wasm' },
      { candidateId: 'base-en', device: 'webgpu' },
    ])
  })
})

const sampleResults: BenchmarkFixtureRunResult[] = [
  {
    combination: { candidateId: 'tiny-en', device: 'wasm' },
    fixtureId: 'a',
    referenceTextEn: 'one',
    hypothesisTextEn: 'one',
    latencyMilliseconds: 100,
    modelLoadMilliseconds: 500,
    wordErrorRate: 0,
  },
  {
    combination: { candidateId: 'tiny-en', device: 'wasm' },
    fixtureId: 'b',
    referenceTextEn: 'two',
    hypothesisTextEn: 'too',
    latencyMilliseconds: 200,
    modelLoadMilliseconds: null,
    wordErrorRate: 1,
  },
  {
    combination: { candidateId: 'small-en', device: 'webgpu' },
    fixtureId: 'a',
    referenceTextEn: 'one',
    hypothesisTextEn: 'one',
    latencyMilliseconds: 400,
    modelLoadMilliseconds: 1500,
    wordErrorRate: 0,
  },
  {
    combination: { candidateId: 'base-en', device: 'wasm' },
    fixtureId: 'a',
    referenceTextEn: 'three',
    hypothesisTextEn: 'free',
    latencyMilliseconds: 300,
    modelLoadMilliseconds: null,
    wordErrorRate: 0.25,
  },
]

describe('summarizeBenchmarkResults', () => {
  it('groups by candidate + device and averages metrics', () => {
    const summaries = summarizeBenchmarkResults(sampleResults)
    const tinyWasm = summaries.find(
      (s) => s.combination.candidateId === 'tiny-en' && s.combination.device === 'wasm',
    )!
    expect(tinyWasm.fixtureCount).toBe(2)
    expect(tinyWasm.averageWordErrorRate).toBeCloseTo(0.5)
    expect(tinyWasm.averageLatencyMilliseconds).toBeCloseTo(150)
    expect(tinyWasm.modelLoadMilliseconds).toBe(500)

    const smallWebgpu = summaries.find(
      (s) => s.combination.candidateId === 'small-en' && s.combination.device === 'webgpu',
    )!
    expect(smallWebgpu.fixtureCount).toBe(1)
    expect(smallWebgpu.averageWordErrorRate).toBe(0)
  })
})

describe('exportBenchmarkResultsToCsv', () => {
  it('writes a header and one row per combination', () => {
    const summaries = summarizeBenchmarkResults(sampleResults)
    const csv = exportBenchmarkResultsToCsv(summaries)
    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'candidateId,device,fixtureCount,averageWordErrorRate,averageLatencyMilliseconds,modelLoadMilliseconds',
    )
    expect(lines).toHaveLength(summaries.length + 1)
  })

  it('formats a non-null modelLoadMilliseconds row exactly', () => {
    const summaries = summarizeBenchmarkResults(sampleResults)
    const csv = exportBenchmarkResultsToCsv(summaries)
    const lines = csv.split('\n')
    expect(lines).toContain('tiny-en,wasm,2,0.5000,150.0,500.0')
  })

  it('formats a null modelLoadMilliseconds row as an empty trailing cell', () => {
    const summaries = summarizeBenchmarkResults(sampleResults)
    const csv = exportBenchmarkResultsToCsv(summaries)
    const lines = csv.split('\n')
    expect(lines).toContain('base-en,wasm,1,0.2500,300.0,')
  })
})

describe('exportBenchmarkResultsToJson', () => {
  it('round-trips through JSON.parse', () => {
    const summaries = summarizeBenchmarkResults(sampleResults)
    const json = exportBenchmarkResultsToJson(summaries)
    expect(JSON.parse(json)).toEqual(summaries)
  })
})
