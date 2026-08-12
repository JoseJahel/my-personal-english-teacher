/**
 * Product-focused home screen: primary path first, technical detail on demand.
 */

import { useState, type RefObject } from 'react'
import type { WordPronunciationHighlight } from '../dsp/word-pronunciation-highlights'
import type { PracticeTurnRecord } from '../storage/practice-session-types'
import type { CommunicationSuggestion } from '../ia/communication-suggestions'
import { homeScreenInterfaceTexts } from './interface-texts'
import type { PracticeChatMessage } from './practice-chat-messages'
import type { PracticeScenarioId } from './practice-scenarios'
import { PracticeChatPanel } from './PracticeChatPanel'
import { CommunicationSuggestionsPanel } from './CommunicationSuggestionsPanel'
import { PracticeHistoryPanel } from './PracticeHistoryPanel'
import { PronunciationWordHighlights } from './PronunciationWordHighlights'
import { ScenarioPicker } from './ScenarioPicker'

export interface HomeScreenProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  spectrogramCanvasRef: RefObject<HTMLCanvasElement | null>
  pitchTrackCanvasRef: RefObject<HTMLCanvasElement | null>
  isStarting: boolean
  isListening: boolean
  isTutorSpeaking: boolean
  /** True after at least one mic stop produced samples (show signal panels). */
  hasCompletedCapture: boolean
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
  speechSynthesisStatusMessage: string
  tutorGenerationStatusMessage: string
  isTutorPreparingConversationModel: boolean
  isTutorComposingReply: boolean
  pronunciationStatusMessage: string
  pronunciationDetailMessage: string | null
  pronunciationScore0to100: number | null
  pronunciationWordHighlights: readonly WordPronunciationHighlight[]
  formantsSummaryMessage: string | null
  practiceHistoryTurns: readonly PracticeTurnRecord[]
  practiceHistoryStatusMessage: string
  /** Friendly single-line pipeline status for the hero area. */
  primaryActivityMessage: string
  isPreparingModels: boolean
  selectedScenarioId: PracticeScenarioId
  chatMessages: readonly PracticeChatMessage[]
  communicationSuggestions: readonly CommunicationSuggestion[]
  firstTurnHintEn: string
  onSelectScenario: (scenarioId: PracticeScenarioId) => void
  onStartMicrophone: () => void
  onStopMicrophone: () => void
}

export function HomeScreen({
  canvasRef,
  spectrogramCanvasRef,
  pitchTrackCanvasRef,
  isStarting,
  isListening,
  isTutorSpeaking,
  hasCompletedCapture,
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
  speechSynthesisStatusMessage,
  tutorGenerationStatusMessage,
  isTutorPreparingConversationModel,
  isTutorComposingReply,
  pronunciationStatusMessage,
  pronunciationDetailMessage,
  pronunciationScore0to100,
  pronunciationWordHighlights,
  formantsSummaryMessage,
  practiceHistoryTurns,
  practiceHistoryStatusMessage,
  primaryActivityMessage,
  isPreparingModels,
  selectedScenarioId,
  chatMessages,
  communicationSuggestions,
  firstTurnHintEn,
  onSelectScenario,
  onStartMicrophone,
  onStopMicrophone,
}: HomeScreenProps) {
  const [showSignalLab, setShowSignalLab] = useState(false)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const levelPercent = Math.round(Math.min(1, Math.max(0, liveInputLevel01)) * 100)
  const isLevelSilentWhileListening = isListening && livePeak < 0.01
  const isScenarioSelectionLocked = isStarting || isListening || isTutorSpeaking
  const showMockEnvironmentWarning =
    environmentDiagnosticsMessage?.includes('NO (hay un mock') ?? false
  const hasResults =
    Boolean(transcribedText) ||
    Boolean(correctedGrammarText) ||
    pronunciationScore0to100 !== null

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 pb-28 pt-8 font-sans text-ink-900 sm:px-5">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          {homeScreenInterfaceTexts.applicationTitle}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600 sm:text-base">
          {homeScreenInterfaceTexts.productLead}
        </p>
      </header>

      {showMockEnvironmentWarning && environmentDiagnosticsMessage ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 ring-1 ring-amber-200">
          {environmentDiagnosticsMessage}
        </p>
      ) : null}

      {isPreparingModels ? (
        <p className="mt-4 rounded-lg bg-sage-100 px-3 py-2 text-center text-sm text-sage-800 ring-1 ring-sage-200">
          {homeScreenInterfaceTexts.modelsWarmingUpMessage}
        </p>
      ) : null}

      <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-sage-200/80">
        <ScenarioPicker
          selectedScenarioId={selectedScenarioId}
          isSelectionLocked={isScenarioSelectionLocked}
          onSelectScenario={onSelectScenario}
        />
      </section>

      {/* Primary action — above the fold, not buried under empty charts */}
      <section className="mt-5 rounded-2xl bg-sage-950 p-4 text-white shadow-lg">
        <p className="text-center text-sm font-medium text-sage-300">
          {primaryActivityMessage}
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onStartMicrophone}
            disabled={isStarting || isListening || isTutorSpeaking}
            className="min-h-12 flex-1 rounded-xl bg-sage-700 px-5 py-3 text-base font-bold text-white transition hover:bg-sage-600 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:opacity-70 sm:max-w-[220px]"
          >
            {isListening
              ? homeScreenInterfaceTexts.listeningButtonLabel
              : homeScreenInterfaceTexts.startMicrophoneButtonLabel}
          </button>
          <button
            type="button"
            onClick={onStopMicrophone}
            disabled={!isListening}
            className="min-h-12 flex-1 rounded-xl bg-blush-600 px-5 py-3 text-base font-bold text-white transition hover:bg-blush-500 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:opacity-70 sm:max-w-[220px]"
          >
            {homeScreenInterfaceTexts.stopMicrophoneButtonLabel}
          </button>
        </div>
       <p className="mt-3 text-center text-xs text-sage-300">
  {isTutorSpeaking
    ? homeScreenInterfaceTexts.tutorSpeakingHint
    : homeScreenInterfaceTexts.micHelperHint}
    </p>

        <div
          className={`mt-4 text-left ${isListening || isStarting ? '' : 'hidden'}`}
        >
          {activeMicrophoneLabel ? (
            <p className="mb-2 text-xs text-sage-300">
              {homeScreenInterfaceTexts.activeMicrophoneLabel(activeMicrophoneLabel)}
            </p>
          ) : null}
          <div className="mb-1 flex justify-between text-xs text-sage-300">
            <span>
              {homeScreenInterfaceTexts.inputLevelLabel}: {levelPercent}%
            </span>
            <span>
              {isLevelSilentWhileListening
                ? homeScreenInterfaceTexts.inputLevelHintSilentShort
                : homeScreenInterfaceTexts.inputLevelHintActiveShort}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-sage-track">
            <div
              className={`h-full rounded-full transition-[width] duration-75 ${
                isLevelSilentWhileListening ? 'bg-amber-400' : 'bg-sage-400'
              }`}
              style={{ width: `${levelPercent}%` }}
            />
          </div>
        </div>
        {/* Always mounted so the session ref stays valid for start/stop animation. */}
        <canvas
          ref={canvasRef}
          width={600}
          height={100}
          className={`mt-3 h-[100px] w-full rounded-lg bg-sage-900 ${
            isListening || isStarting ? '' : 'hidden'
          }`}
        />
      </section>

      <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-sage-200/80">
        <PracticeChatPanel
          messages={chatMessages}
          firstTurnHintEn={firstTurnHintEn}
          isTutorPreparingConversationModel={isTutorPreparingConversationModel}
          isTutorComposingReply={isTutorComposingReply}
          tutorGenerationStatusMessage={tutorGenerationStatusMessage}
        />
      </section>

      <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-sage-200/80">
        <CommunicationSuggestionsPanel suggestions={communicationSuggestions} />
      </section>

      {hasResults ? (
        <section className="mt-5 space-y-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-sage-200/80">
          <h2 className="text-sm font-semibold text-ink-900">
            {homeScreenInterfaceTexts.resultsSectionTitle}
          </h2>

          {transcribedText ? (
            <div>
              <p className="text-xs font-medium text-ink-400">
                {homeScreenInterfaceTexts.transcriptionPanelLabel}
              </p>
              <p className="mt-1 rounded-lg bg-sage-50 px-3 py-2 font-mono text-sm text-ink-900">
                {transcribedText}
              </p>
            </div>
          ) : null}

          {correctedGrammarText ? (
            <div>
              <p className="text-xs font-medium text-ink-400">
                {homeScreenInterfaceTexts.grammarCorrectionPanelLabel}
              </p>
              <p className="mt-1 rounded-lg bg-emerald-50 px-3 py-2 font-mono text-sm text-emerald-950">
                {correctedGrammarText}
              </p>
              {grammarCorrectionMadeNoChangesToTranscription ? (
                <p className="mt-1 text-xs italic text-ink-400">
                  {homeScreenInterfaceTexts.grammarCorrectionStatusMessages.noCorrectionsNeeded}
                </p>
              ) : null}
            </div>
          ) : null}

          {pronunciationScore0to100 !== null ? (
            <div>
              <p className="text-xs font-medium text-ink-400">
                {homeScreenInterfaceTexts.pronunciationPanelLabel}
              </p>
              <p className="mt-1 text-sm text-ink-600">{pronunciationStatusMessage}</p>
              <div className="mt-2">
                <div className="mb-1 flex justify-between text-xs text-ink-400">
                  <span>0</span>
                  <span className="font-semibold text-sage-800">
                    {pronunciationScore0to100.toFixed(1)}
                  </span>
                  <span>100</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-sage-200">
                  <div
                    className="h-full rounded-full bg-sage-600 transition-[width] duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, pronunciationScore0to100))}%`,
                    }}
                  />
                </div>
              </div>
              <PronunciationWordHighlights highlights={pronunciationWordHighlights} />
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Signal lab: collapsed; canvases always mounted so drawings survive expand. */}
      <section
        className={`mt-5 rounded-2xl bg-white shadow-sm ring-1 ring-sage-200/80 ${
          hasCompletedCapture ? '' : 'hidden'
        }`}
      >
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-ink-900"
          onClick={() => setShowSignalLab((open) => !open)}
          aria-expanded={showSignalLab}
        >
          <span>{homeScreenInterfaceTexts.signalLabTitle}</span>
          <span className="text-ink-400">{showSignalLab ? '−' : '+'}</span>
        </button>
        <div
          className={`space-y-4 border-t border-sage-200 px-4 pb-4 pt-3 text-left ${
            showSignalLab ? '' : 'hidden'
          }`}
        >
          <div>
            <p className="mb-1 text-xs font-semibold text-ink-600">
              {homeScreenInterfaceTexts.spectrogramPanelLabel}
            </p>
            <canvas
              ref={spectrogramCanvasRef}
              width={600}
              height={140}
              className="h-[140px] w-full rounded-lg bg-sage-900"
            />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-ink-600">
              {homeScreenInterfaceTexts.pitchTrackPanelLabel}
            </p>
            <canvas
              ref={pitchTrackCanvasRef}
              width={600}
              height={100}
              className="h-[100px] w-full rounded-lg bg-sage-900"
            />
          </div>
          <div className="rounded-lg bg-sage-50 px-3 py-2 text-sm">
            <p className="text-xs font-semibold text-ink-600">
              {homeScreenInterfaceTexts.formantsPanelLabel}
            </p>
            <p className="mt-1 font-mono text-ink-900">
              {formantsSummaryMessage ?? homeScreenInterfaceTexts.formantsUnavailable}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-2xl bg-white shadow-sm ring-1 ring-sage-200/80">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-ink-900"
          onClick={() => setShowHistory((open) => !open)}
          aria-expanded={showHistory}
        >
          <span>{homeScreenInterfaceTexts.practiceHistory.sectionTitle}</span>
          <span className="text-ink-400">
            {practiceHistoryTurns.length > 0
              ? `(${practiceHistoryTurns.length}) `
              : ''}
            {showHistory ? '−' : '+'}
          </span>
        </button>
        {showHistory ? (
          <div className="border-t border-sage-200 px-4 pb-4">
            <PracticeHistoryPanel
              turns={practiceHistoryTurns}
              statusMessage={practiceHistoryStatusMessage}
            />
          </div>
        ) : null}
      </section>

      <section className="mt-5 rounded-2xl bg-white shadow-sm ring-1 ring-sage-200/80">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-ink-900"
          onClick={() => setShowTechnicalDetails((open) => !open)}
          aria-expanded={showTechnicalDetails}
        >
          <span>{homeScreenInterfaceTexts.technicalDetailsTitle}</span>
          <span className="text-ink-400">{showTechnicalDetails ? '−' : '+'}</span>
        </button>
        {showTechnicalDetails ? (
          <div className="space-y-2 border-t border-sage-200 px-4 pb-4 pt-3 text-left text-xs text-ink-600">
            <StatusLine
              label={homeScreenInterfaceTexts.statusFieldLabel}
              value={microphoneStatusMessage}
            />
            <StatusLine
              label={homeScreenInterfaceTexts.transcriptionPanelLabel}
              value={transcriptionStatusMessage}
            />
            <StatusLine
              label={homeScreenInterfaceTexts.grammarCorrectionPanelLabel}
              value={grammarCorrectionStatusMessage}
            />
            <StatusLine
              label={homeScreenInterfaceTexts.tutorGeneration.panelLabel}
              value={tutorGenerationStatusMessage}
            />
            <StatusLine
              label={homeScreenInterfaceTexts.speechSynthesisPanelLabel}
              value={speechSynthesisStatusMessage}
            />
            <StatusLine
              label={homeScreenInterfaceTexts.pronunciationPanelLabel}
              value={pronunciationStatusMessage}
            />
            {pronunciationDetailMessage ? (
              <p className="text-[11px] text-ink-400">{pronunciationDetailMessage}</p>
            ) : null}
            {captureDiagnosticsMessage ? (
              <p className="text-[11px] text-ink-400">
                <strong>{homeScreenInterfaceTexts.captureDiagnosticsLabel}:</strong>{' '}
                {captureDiagnosticsMessage}
              </p>
            ) : null}
            {environmentDiagnosticsMessage && !showMockEnvironmentWarning ? (
              <p className="text-[11px] text-ink-400">{environmentDiagnosticsMessage}</p>
            ) : null}
            <p className="pt-1 text-[11px] text-ink-400">
              {homeScreenInterfaceTexts.liveMetersDetail(liveRms, livePeak)}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <strong className="text-ink-600">{label}:</strong> {value}
    </p>
  )
}
