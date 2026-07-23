/**
 * Presentational home screen: buttons, status panels, waveform canvas.
 */

import type { RefObject } from 'react'
import { homeScreenInterfaceTexts } from './interface-texts'

export interface HomeScreenProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  isStarting: boolean
  isListening: boolean
  liveInputLevel01: number
  liveRms: number
  livePeak: number
  activeMicrophoneLabel: string
  environmentDiagnosticsMessage: string | null
  microphoneStatusMessage: string
  transcriptionStatusMessage: string
  transcribedText: string
  captureDiagnosticsMessage: string | null
  grammarCorrectionStatusMessage: string
  correctedGrammarText: string
  grammarCorrectionMadeNoChangesToTranscription: boolean
  onStartMicrophone: () => void
  onStopMicrophone: () => void
}

export function HomeScreen({
  canvasRef,
  isStarting,
  isListening,
  liveInputLevel01,
  liveRms,
  livePeak,
  activeMicrophoneLabel,
  environmentDiagnosticsMessage,
  microphoneStatusMessage,
  transcriptionStatusMessage,
  transcribedText,
  captureDiagnosticsMessage,
  grammarCorrectionStatusMessage,
  correctedGrammarText,
  grammarCorrectionMadeNoChangesToTranscription,
  onStartMicrophone,
  onStopMicrophone,
}: HomeScreenProps) {
  const levelPercent = Math.round(Math.min(1, Math.max(0, liveInputLevel01)) * 100)
  const isLevelSilentWhileListening = isListening && livePeak < 0.01

  return (
    <div className="mx-auto my-10 max-w-2xl px-5 text-center font-sans">
      <span className="rounded-2xl bg-indigo-100 px-3 py-1 text-sm text-indigo-800">
        {homeScreenInterfaceTexts.projectPhaseBadgeLabel}
      </span>

      <h1 className="mt-4 text-3xl font-bold text-slate-800">
        {homeScreenInterfaceTexts.applicationTitle}
      </h1>
      <p className="text-slate-500">{homeScreenInterfaceTexts.applicationSubtitle}</p>

      {environmentDiagnosticsMessage && (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-left text-xs ${
            environmentDiagnosticsMessage.includes('NO (hay un mock')
              ? 'bg-amber-100 text-amber-900'
              : 'bg-slate-50 text-slate-600'
          }`}
        >
          {environmentDiagnosticsMessage}
        </p>
      )}

      <div className="my-6">
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          className="h-[150px] w-full rounded-lg bg-[#1e1e1e]"
        />
      </div>

      {(isListening || isStarting) && (
        <div className="mb-4 text-left">
          {activeMicrophoneLabel ? (
            <p className="mb-2 text-xs font-medium text-slate-600">
              {homeScreenInterfaceTexts.activeMicrophoneLabel(activeMicrophoneLabel)}
            </p>
          ) : null}
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>
              <strong>{homeScreenInterfaceTexts.inputLevelLabel}:</strong> {levelPercent}%
              <span className="ml-2 font-mono text-xs text-slate-500">
                {homeScreenInterfaceTexts.inputLevelMeters(liveRms, livePeak)}
              </span>
            </span>
            <span className="text-xs text-slate-500">
              {isLevelSilentWhileListening
                ? homeScreenInterfaceTexts.inputLevelHintSilent
                : isListening
                  ? homeScreenInterfaceTexts.inputLevelHintActive
                  : ''}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-[width] duration-75 ${
                isLevelSilentWhileListening ? 'bg-amber-500' : 'bg-green-600'
              }`}
              style={{ width: `${levelPercent}%` }}
            />
          </div>
        </div>
      )}

      <div className="my-6 flex justify-center gap-4">
        <button
          type="button"
          onClick={onStartMicrophone}
          disabled={isStarting || isListening}
          className="min-w-[200px] justify-center rounded-lg bg-green-800 px-6 py-3 text-base font-bold text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-300 disabled:opacity-70"
        >
          {homeScreenInterfaceTexts.startMicrophoneButtonLabel}
        </button>
        <button
          type="button"
          onClick={onStopMicrophone}
          disabled={!isListening}
          className="min-w-[200px] justify-center rounded-lg bg-red-700 px-6 py-3 text-base font-bold text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-300 disabled:opacity-70"
        >
          {homeScreenInterfaceTexts.stopMicrophoneButtonLabel}
        </button>
      </div>

      <div className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        <strong>{homeScreenInterfaceTexts.statusFieldLabel}:</strong> {microphoneStatusMessage}
      </div>

      <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        <strong>{homeScreenInterfaceTexts.transcriptionPanelLabel}:</strong>{' '}
        {transcriptionStatusMessage}
        {transcribedText && (
          <p className="mt-2 rounded-md bg-white p-2 text-left font-mono text-slate-900">
            {transcribedText}
          </p>
        )}
        {captureDiagnosticsMessage && (
          <p className="mt-2 text-left text-xs text-slate-500">
            <strong>{homeScreenInterfaceTexts.captureDiagnosticsLabel}:</strong>{' '}
            {captureDiagnosticsMessage}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
        <strong>{homeScreenInterfaceTexts.grammarCorrectionPanelLabel}:</strong>{' '}
        {grammarCorrectionStatusMessage}
        {correctedGrammarText && (
          <p className="mt-2 rounded-md bg-white p-2 text-left font-mono text-slate-900">
            {correctedGrammarText}
          </p>
        )}
        {grammarCorrectionMadeNoChangesToTranscription && (
          <p className="mt-2 text-slate-500 italic">
            {homeScreenInterfaceTexts.grammarCorrectionStatusMessages.noCorrectionsNeeded}
          </p>
        )}
      </div>
    </div>
  )
}
