/**
 * State + orchestration for the ASR benchmark dev screen (Sección 1 del
 * diseño). Recording uses the same capture pipeline as the app; running a
 * benchmark spins up one fresh InferenceClient per (candidate × device)
 * combination and disposes it before the next one (no models kept warm).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  benchmarkFixtureDraftErrorMessageFor,
  validateBenchmarkFixtureDraft,
} from './asr-benchmark-fixture-draft'
import {
  buildBenchmarkRunPlan,
  exportBenchmarkResultsToCsv,
  exportBenchmarkResultsToJson,
  summarizeBenchmarkResults,
} from './asr-benchmark-results'
import type {
  BenchmarkCombinationSummary,
  BenchmarkFixtureRunResult,
} from './asr-benchmark-results'
import { homeScreenInterfaceTexts } from './interface-texts'
import { resampleToWhisperRate, WHISPER_SAMPLE_RATE_IN_HERTZ } from '../audio/audio-resampler'
import { startMicrophoneCapture } from '../audio/microphone-capture'
import type { CapturedMicrophoneAudio, MicrophoneCaptureSession } from '../audio/microphone-capture'
import { createInferenceClient } from '../ia/inference-client'
import { DEFAULT_ASR_CANDIDATE_ID } from '../ia/model-registry'
import type { AsrModelCandidateId } from '../ia/model-registry'
import type { OnnxInferenceDevice } from '../ia/resolve-inference-device'
import { computeWordErrorRate } from '../ia/word-error-rate'
import { createBenchmarkFixtureStore } from '../storage/benchmark-fixture-store'
import type { BenchmarkFixtureStore } from '../storage/benchmark-fixture-store'
import { exportFixturesToJson, importFixturesFromJson } from '../storage/benchmark-fixture-types'
import type { BenchmarkFixtureRecord } from '../storage/benchmark-fixture-types'

export interface UseAsrBenchmarkResult {
  readonly fixtures: BenchmarkFixtureRecord[]
  readonly isRecordingFixture: boolean
  readonly fixtureDraftReferenceText: string
  readonly fixtureDraftErrorMessage: string | null
  readonly storageErrorMessage: string | null
  readonly selectedCandidateIds: AsrModelCandidateId[]
  readonly selectedDevices: OnnxInferenceDevice[]
  readonly isRunningBenchmark: boolean
  readonly runProgressLabel: string
  readonly summaries: BenchmarkCombinationSummary[]
  setFixtureDraftReferenceText: (text: string) => void
  startFixtureRecording: () => Promise<void>
  stopFixtureRecordingAndSave: () => Promise<void>
  deleteFixture: (id: string) => Promise<void>
  toggleCandidateSelected: (candidateId: AsrModelCandidateId) => void
  toggleDeviceSelected: (device: OnnxInferenceDevice) => void
  runBenchmark: () => Promise<void>
  exportFixturesJson: () => string
  importFixturesJson: (json: string) => Promise<void>
  exportResultsJson: () => string
  exportResultsCsv: () => string
}

export function useAsrBenchmark(): UseAsrBenchmarkResult {
  const storeRef = useRef<BenchmarkFixtureStore | null>(null)
  const captureSessionRef = useRef<MicrophoneCaptureSession | null>(null)

  const [fixtures, setFixtures] = useState<BenchmarkFixtureRecord[]>([])
  const [isRecordingFixture, setIsRecordingFixture] = useState(false)
  const [fixtureDraftReferenceText, setFixtureDraftReferenceText] = useState('')
  const [fixtureDraftErrorMessage, setFixtureDraftErrorMessage] = useState<string | null>(null)
  const [storageErrorMessage, setStorageErrorMessage] = useState<string | null>(null)
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<AsrModelCandidateId[]>([
    DEFAULT_ASR_CANDIDATE_ID,
  ])
  const [selectedDevices, setSelectedDevices] = useState<OnnxInferenceDevice[]>(['wasm'])
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false)
  const [runProgressLabel, setRunProgressLabel] = useState('')
  const [results, setResults] = useState<BenchmarkFixtureRunResult[]>([])

  useEffect(() => {
    let cancelled = false
    createBenchmarkFixtureStore()
      .then(async (store) => {
        if (cancelled) {
          store.close()
          return
        }
        storeRef.current = store
        const loaded = await store.listFixtures()
        if (!cancelled) {
          setFixtures(loaded)
        }
      })
      .catch((error: unknown) => {
        console.warn('Benchmark fixture store unavailable.', error)
        if (!cancelled) {
          setStorageErrorMessage(homeScreenInterfaceTexts.asrBenchmark.storageUnavailableMessage)
        }
      })

    return () => {
      cancelled = true
      storeRef.current?.close()
      storeRef.current = null
      captureSessionRef.current?.abort()
      captureSessionRef.current = null
    }
  }, [])

  const startFixtureRecording = useCallback(async () => {
    setFixtureDraftErrorMessage(null)
    try {
      const session = await startMicrophoneCapture()
      captureSessionRef.current = session
      setIsRecordingFixture(true)
    } catch (error) {
      // Permission denial is the common case here; surface it instead of an
      // unhandled rejection so the developer knows to check the browser prompt.
      console.warn('Failed to start fixture recording.', error)
      setFixtureDraftErrorMessage(homeScreenInterfaceTexts.asrBenchmark.microphoneErrorMessage)
    }
  }, [])

  const stopFixtureRecordingAndSave = useCallback(async () => {
    const session = captureSessionRef.current
    captureSessionRef.current = null
    setIsRecordingFixture(false)
    if (!session) {
      return
    }
    setFixtureDraftErrorMessage(null)

    let captured: CapturedMicrophoneAudio
    try {
      captured = await session.stop()
    } catch (error) {
      console.warn('Failed to stop fixture recording.', error)
      setFixtureDraftErrorMessage(homeScreenInterfaceTexts.asrBenchmark.microphoneErrorMessage)
      return
    }

    const resampled = resampleToWhisperRate(captured.samples, captured.sampleRate)

    const validation = validateBenchmarkFixtureDraft(
      fixtureDraftReferenceText,
      resampled.length,
      WHISPER_SAMPLE_RATE_IN_HERTZ,
    )
    if (!validation.isValid) {
      setFixtureDraftErrorMessage(benchmarkFixtureDraftErrorMessageFor(validation.reason))
      return
    }

    const store = storeRef.current
    if (!store) {
      setStorageErrorMessage(homeScreenInterfaceTexts.asrBenchmark.storageUnavailableMessage)
      return
    }

    try {
      const saved = await store.saveFixture({
        referenceTextEn: fixtureDraftReferenceText,
        sampleRateInHertz: WHISPER_SAMPLE_RATE_IN_HERTZ,
        // Fresh copy forces the buffer's static type to plain ArrayBuffer
        // (matches CreateBenchmarkFixtureInput.samplesBuffer); resampled.buffer
        // alone types as ArrayBufferLike, same idiom as benchmark-fixture-types.test.ts.
        samplesBuffer: new Float32Array(resampled).buffer,
      })
      setFixtures((current) => [...current, saved])
      setFixtureDraftReferenceText('')
    } catch (error) {
      // e.g. IndexedDB quota exceeded — same user-facing message as store-unavailable.
      console.warn('Failed to save benchmark fixture.', error)
      setStorageErrorMessage(homeScreenInterfaceTexts.asrBenchmark.storageUnavailableMessage)
    }
  }, [fixtureDraftReferenceText])

  const deleteFixture = useCallback(async (id: string) => {
    try {
      await storeRef.current?.deleteFixture(id)
      setFixtures((current) => current.filter((fixture) => fixture.id !== id))
    } catch (error) {
      console.warn('Failed to delete benchmark fixture.', error)
      setStorageErrorMessage(homeScreenInterfaceTexts.asrBenchmark.storageUnavailableMessage)
    }
  }, [])

  const toggleCandidateSelected = useCallback((candidateId: AsrModelCandidateId) => {
    setSelectedCandidateIds((current) =>
      current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId],
    )
  }, [])

  const toggleDeviceSelected = useCallback((device: OnnxInferenceDevice) => {
    setSelectedDevices((current) =>
      current.includes(device) ? current.filter((item) => item !== device) : [...current, device],
    )
  }, [])

  /**
   * Runs the full candidate × device plan sequentially. Not cancelable on
   * unmount by design — no AbortController: this is a single-operator dev
   * tool, so that plumbing is deferred. `client.dispose()` in the `finally`
   * below always runs regardless of mount state, because this async loop is
   * plain JS and keeps executing after the component unmounts (React does
   * not cancel in-flight promises). If unmounted mid-run, remaining
   * combinations still complete in the background — no orphaned worker —
   * and the trailing `setResults`/`setRunProgressLabel`/`setIsRunningBenchmark`
   * calls become harmless no-ops (React 19 has no dev warning for setState
   * after unmount).
   */
  const runBenchmark = useCallback(async () => {
    if (
      fixtures.length === 0 ||
      selectedCandidateIds.length === 0 ||
      selectedDevices.length === 0
    ) {
      return
    }

    setIsRunningBenchmark(true)
    const plan = buildBenchmarkRunPlan(selectedCandidateIds, selectedDevices)
    const collected: BenchmarkFixtureRunResult[] = []

    for (let combinationIndex = 0; combinationIndex < plan.length; combinationIndex += 1) {
      const combination = plan[combinationIndex]!
      setRunProgressLabel(
        homeScreenInterfaceTexts.asrBenchmark.runningBenchmarkLabel(
          combinationIndex + 1,
          plan.length,
        ),
      )

      const client = createInferenceClient({ forcedDevice: combination.device })
      try {
        const loadStart = performance.now()
        await client.preloadModels(combination.candidateId)
        const modelLoadMilliseconds = performance.now() - loadStart

        for (const fixture of fixtures) {
          const samplesCopy = new Float32Array(fixture.samplesBuffer.slice(0))
          const transcribeStart = performance.now()
          const hypothesisTextEn = await client.transcribe(samplesCopy, combination.candidateId)
          const latencyMilliseconds = performance.now() - transcribeStart
          const { wordErrorRate } = computeWordErrorRate(fixture.referenceTextEn, hypothesisTextEn)

          collected.push({
            combination,
            fixtureId: fixture.id,
            referenceTextEn: fixture.referenceTextEn,
            hypothesisTextEn,
            latencyMilliseconds,
            modelLoadMilliseconds,
            wordErrorRate,
          })
        }
      } catch (error) {
        console.warn('Benchmark combination failed.', combination, error)
      } finally {
        client.dispose()
      }
    }

    setResults(collected)
    setRunProgressLabel('')
    setIsRunningBenchmark(false)
  }, [fixtures, selectedCandidateIds, selectedDevices])

  const exportFixturesJson = useCallback(() => exportFixturesToJson(fixtures), [fixtures])

  const importFixturesJson = useCallback(async (json: string) => {
    // Parsing is intentionally left outside the try/catch: a malformed file
    // is a caller/domain error (SyntaxError from JSON.parse, or the
    // "missing fixtures array" error from importFixturesFromJson), and it
    // propagates as a rejected promise so the screen can map it to its own
    // import-specific error copy.
    const imported = importFixturesFromJson(json)
    const store = storeRef.current
    if (!store) {
      setStorageErrorMessage(homeScreenInterfaceTexts.asrBenchmark.storageUnavailableMessage)
      return
    }
    try {
      for (const fixture of imported) {
        await store.saveFixture({
          referenceTextEn: fixture.referenceTextEn,
          sampleRateInHertz: fixture.sampleRateInHertz,
          samplesBuffer: fixture.samplesBuffer,
        })
      }
      const reloaded = await store.listFixtures()
      setFixtures(reloaded)
    } catch (error) {
      console.warn('Failed to persist imported benchmark fixtures.', error)
      setStorageErrorMessage(homeScreenInterfaceTexts.asrBenchmark.storageUnavailableMessage)
    }
  }, [])

  const summaries = summarizeBenchmarkResults(results)
  const exportResultsJson = useCallback(() => exportBenchmarkResultsToJson(summaries), [summaries])
  const exportResultsCsv = useCallback(() => exportBenchmarkResultsToCsv(summaries), [summaries])

  return {
    fixtures,
    isRecordingFixture,
    fixtureDraftReferenceText,
    fixtureDraftErrorMessage,
    storageErrorMessage,
    selectedCandidateIds,
    selectedDevices,
    isRunningBenchmark,
    runProgressLabel,
    summaries,
    setFixtureDraftReferenceText,
    startFixtureRecording,
    stopFixtureRecordingAndSave,
    deleteFixture,
    toggleCandidateSelected,
    toggleDeviceSelected,
    runBenchmark,
    exportFixturesJson,
    importFixturesJson,
    exportResultsJson,
    exportResultsCsv,
  }
}
