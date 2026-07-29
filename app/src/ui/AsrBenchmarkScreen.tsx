/**
 * Dev-only ASR benchmark screen (Sección 1 del diseño). Gated in App.tsx by
 * `import.meta.env.DEV && location.hash === '#asr-benchmark'` — never ships
 * to production and is invisible without the hash.
 */

import { useState } from 'react'
import { asrModelCandidates } from '../ia/model-registry'
import type { AsrModelCandidateId } from '../ia/model-registry'
import type { OnnxInferenceDevice } from '../ia/resolve-inference-device'
import { homeScreenInterfaceTexts } from './interface-texts'
import { useAsrBenchmark } from './use-asr-benchmark'

const ALL_CANDIDATE_IDS = Object.keys(asrModelCandidates) as AsrModelCandidateId[]
const ALL_DEVICES: OnnxInferenceDevice[] = ['wasm', 'webgpu']

function downloadTextFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function AsrBenchmarkScreen() {
  const texts = homeScreenInterfaceTexts.asrBenchmark
  const candidateDisplayNames = homeScreenInterfaceTexts.asrCandidateDisplayNames
  const benchmark = useAsrBenchmark()
  // Import parsing is a screen-local concern (file picking + reading), not
  // hook state: importFixturesJson rejects on a malformed file so the
  // screen can show its own copy for it (see use-asr-benchmark.ts).
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null)

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-8 font-sans text-ink-900">
      <h1 className="text-2xl font-bold">{texts.pageTitle}</h1>
      <p className="mt-2 text-sm text-ink-600">{texts.pageHint}</p>

      {benchmark.storageErrorMessage ? (
        <p className="mt-4 rounded-lg bg-blush-500/10 px-3 py-2 text-sm text-blush-600">
          {benchmark.storageErrorMessage}
        </p>
      ) : null}

      <section className="mt-6 rounded-2xl bg-sage-50 p-4">
        <h2 className="text-lg font-semibold">{texts.fixturesSectionTitle}</h2>

        <label className="mt-3 block text-sm font-medium" htmlFor="fixture-reference-text">
          {texts.fixtureReferenceTextLabel}
        </label>
        <input
          id="fixture-reference-text"
          type="text"
          className="mt-1 w-full rounded-lg border border-sage-300 px-3 py-2 text-sm"
          placeholder={texts.fixtureReferenceTextPlaceholder}
          value={benchmark.fixtureDraftReferenceText}
          onChange={(event) => benchmark.setFixtureDraftReferenceText(event.target.value)}
          disabled={benchmark.isRecordingFixture}
        />

        {benchmark.fixtureDraftErrorMessage ? (
          <p className="mt-2 text-sm text-blush-600">{benchmark.fixtureDraftErrorMessage}</p>
        ) : null}

        <button
          type="button"
          className="mt-3 rounded-lg bg-sage-600 px-4 py-2 text-sm font-semibold text-white"
          onClick={() =>
            void (benchmark.isRecordingFixture
              ? benchmark.stopFixtureRecordingAndSave()
              : benchmark.startFixtureRecording())
          }
        >
          {benchmark.isRecordingFixture
            ? texts.recordingFixtureButtonLabel
            : texts.recordFixtureButtonLabel}
        </button>

        <ul className="mt-4 space-y-2">
          {benchmark.fixtures.length === 0 ? (
            <li className="text-sm text-ink-400">{texts.noFixturesMessage}</li>
          ) : (
            benchmark.fixtures.map((fixture) => (
              <li
                key={fixture.id}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
              >
                <span>{fixture.referenceTextEn}</span>
                <button
                  type="button"
                  className="text-blush-600"
                  onClick={() => void benchmark.deleteFixture(fixture.id)}
                >
                  {texts.deleteFixtureButtonLabel}
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-sage-400 px-3 py-2 text-sm"
            onClick={() =>
              downloadTextFile(
                'asr-fixtures.json',
                benchmark.exportFixturesJson(),
                'application/json',
              )
            }
          >
            {texts.exportFixturesJsonButtonLabel}
          </button>
          <label className="cursor-pointer rounded-lg border border-sage-400 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-sage-400">
            {texts.importFixturesJsonButtonLabel}
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) {
                  return
                }
                setImportErrorMessage(null)
                void file
                  .text()
                  .then((json) => benchmark.importFixturesJson(json))
                  .catch((error: unknown) => {
                    console.warn('Failed to import benchmark fixtures.', error)
                    setImportErrorMessage(texts.importErrorMessage)
                  })
                event.target.value = ''
              }}
            />
          </label>
        </div>

        {importErrorMessage ? (
          <p className="mt-2 text-sm text-blush-600">{importErrorMessage}</p>
        ) : null}
      </section>

      <section className="mt-6 rounded-2xl bg-sage-50 p-4">
        <h2 className="text-lg font-semibold">{texts.runSectionTitle}</h2>

        <fieldset className="mt-3">
          <legend className="text-sm font-medium">{texts.candidatesLabel}</legend>
          {ALL_CANDIDATE_IDS.map((candidateId) => (
            <label key={candidateId} className="mt-1 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={benchmark.selectedCandidateIds.includes(candidateId)}
                onChange={() => benchmark.toggleCandidateSelected(candidateId)}
              />
              {candidateDisplayNames[candidateId]}
            </label>
          ))}
        </fieldset>

        <fieldset className="mt-3">
          <legend className="text-sm font-medium">{texts.devicesLabel}</legend>
          {ALL_DEVICES.map((device) => (
            <label key={device} className="mt-1 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={benchmark.selectedDevices.includes(device)}
                onChange={() => benchmark.toggleDeviceSelected(device)}
              />
              {texts.deviceLabels[device]}
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          className="mt-4 rounded-lg bg-sage-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={benchmark.isRunningBenchmark || benchmark.fixtures.length === 0}
          onClick={() => void benchmark.runBenchmark()}
        >
          {texts.runBenchmarkButtonLabel}
        </button>
        {benchmark.runProgressLabel ? (
          <p className="mt-2 text-sm text-ink-600">{benchmark.runProgressLabel}</p>
        ) : null}
      </section>

      <section className="mt-6 rounded-2xl bg-sage-50 p-4">
        <h2 className="text-lg font-semibold">{texts.resultsSectionTitle}</h2>
        {benchmark.summaries.length === 0 ? (
          <p className="mt-2 text-sm text-ink-400">{texts.noResultsMessage}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="pr-4">{texts.resultsTableHeaders.candidate}</th>
                  <th className="pr-4">{texts.resultsTableHeaders.device}</th>
                  <th className="pr-4">{texts.resultsTableHeaders.fixtureCount}</th>
                  <th className="pr-4">{texts.resultsTableHeaders.averageWer}</th>
                  <th className="pr-4">{texts.resultsTableHeaders.averageLatency}</th>
                  <th className="pr-4">{texts.resultsTableHeaders.modelLoad}</th>
                </tr>
              </thead>
              <tbody>
                {benchmark.summaries.map((summary) => (
                  <tr key={`${summary.combination.candidateId}-${summary.combination.device}`}>
                    <td className="pr-4">
                      {candidateDisplayNames[summary.combination.candidateId]}
                    </td>
                    <td className="pr-4">{texts.deviceLabels[summary.combination.device]}</td>
                    <td className="pr-4">{summary.fixtureCount}</td>
                    <td className="pr-4">{summary.averageWordErrorRate.toFixed(3)}</td>
                    <td className="pr-4">{summary.averageLatencyMilliseconds.toFixed(0)}</td>
                    <td className="pr-4">
                      {summary.modelLoadMilliseconds === null
                        ? '—'
                        : summary.modelLoadMilliseconds.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {benchmark.summaries.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-sage-400 px-3 py-2 text-sm"
              onClick={() =>
                downloadTextFile(
                  'asr-benchmark-results.json',
                  benchmark.exportResultsJson(),
                  'application/json',
                )
              }
            >
              {texts.exportResultsJsonButtonLabel}
            </button>
            <button
              type="button"
              className="rounded-lg border border-sage-400 px-3 py-2 text-sm"
              onClick={() =>
                downloadTextFile(
                  'asr-benchmark-results.csv',
                  benchmark.exportResultsCsv(),
                  'text/csv',
                )
              }
            >
              {texts.exportResultsCsvButtonLabel}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
