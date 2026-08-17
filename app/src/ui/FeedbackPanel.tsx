/**
 * Right artifact panel: turn feedback, suggestions placeholder, signals, tech.
 */

import type { ReactNode, RefObject } from 'react'
import type { FormantTriple } from '../dsp/formant-estimation'
import type { WordPronunciationHighlight } from '../dsp/word-pronunciation-highlights'
import type { PracticeTurnRecord } from '../storage/practice-session-types'
import { FormantVowelMap } from './FormantVowelMap'
import { GrammarCorrectionDiff } from './GrammarCorrectionDiff'
import { homeScreenInterfaceTexts } from './interface-texts'
import { PronunciationWordHighlights } from './PronunciationWordHighlights'
import {
  PRACTICE_SHELL_TEST_IDS,
  type PracticeFeedbackTab,
} from './practice-shell-types'

export interface FeedbackPanelProps {
  readonly isOpen: boolean
  readonly activeTab: PracticeFeedbackTab
  readonly hasTurnResults: boolean
  readonly transcribedText: string
  readonly correctedGrammarText: string
  readonly grammarCorrectionMadeNoChangesToTranscription: boolean
  readonly pronunciationScore0to100: number | null
  readonly pronunciationStatusMessage: string
  readonly pronunciationDetailMessage: string | null
  readonly pronunciationMfccScore0to100: number | null
  readonly pronunciationPitchScore0to100: number | null
  readonly pronunciationWordHighlights: readonly WordPronunciationHighlight[]
  readonly formantsSummaryMessage: string | null
  readonly medianFormants: FormantTriple | null
  readonly practiceHistoryTurns: readonly PracticeTurnRecord[]
  readonly spectrogramCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly pitchTrackCanvasRef: RefObject<HTMLCanvasElement | null>
  readonly hasCompletedCapture: boolean
  readonly microphoneStatusMessage: string
  readonly transcriptionStatusMessage: string
  readonly grammarCorrectionStatusMessage: string
  readonly tutorGenerationStatusMessage: string
  readonly speechSynthesisStatusMessage: string
  readonly pronunciationPipelineStatusMessage: string
  readonly captureDiagnosticsMessage: string | null
  readonly environmentDiagnosticsMessage: string | null
  readonly liveRms: number
  readonly livePeak: number
  readonly isListening: boolean
  readonly isStarting: boolean
  readonly onClose: () => void
  readonly onSelectTab: (tab: PracticeFeedbackTab) => void
}

export function FeedbackPanel({
  isOpen,
  activeTab,
  hasTurnResults,
  transcribedText,
  correctedGrammarText,
  grammarCorrectionMadeNoChangesToTranscription,
  pronunciationScore0to100,
  pronunciationStatusMessage,
  pronunciationDetailMessage,
  pronunciationMfccScore0to100,
  pronunciationPitchScore0to100,
  pronunciationWordHighlights,
  formantsSummaryMessage,
  medianFormants,
  practiceHistoryTurns,
  spectrogramCanvasRef,
  pitchTrackCanvasRef,
  hasCompletedCapture,
  microphoneStatusMessage,
  transcriptionStatusMessage,
  grammarCorrectionStatusMessage,
  tutorGenerationStatusMessage,
  speechSynthesisStatusMessage,
  pronunciationPipelineStatusMessage,
  captureDiagnosticsMessage,
  environmentDiagnosticsMessage,
  liveRms,
  livePeak,
  isListening,
  isStarting,
  onClose,
  onSelectTab,
}: FeedbackPanelProps) {
  const shell = homeScreenInterfaceTexts.shell
  const micTechLabel = isListening
    ? shell.techMicListening
    : isStarting
      ? shell.techMicStarting
      : shell.techMicInactive

  // Keep the panel mounted (hidden when closed) so signal canvas refs stay valid.
  return (
    <aside
      className={`flex w-[22rem] max-w-[22rem] shrink-0 flex-col border-l border-sage-200 bg-atelier-elev ${
        isOpen ? '' : 'hidden'
      }`}
      data-testid={PRACTICE_SHELL_TEST_IDS.panel}
      data-open={isOpen ? 'true' : 'false'}
      aria-hidden={!isOpen}
      aria-label={shell.feedbackPanelTitle}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-sage-200 px-3.5 py-2.5">
        <h2 className="m-0 text-[0.88rem] font-bold text-ink-900">{shell.feedbackPanelTitle}</h2>
        <button
          type="button"
          data-testid={PRACTICE_SHELL_TEST_IDS.panelClose}
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-ink-600 hover:bg-atelier-hover hover:text-ink-900"
          aria-label={shell.closePanelAria}
        >
          ✕
        </button>
      </header>

      <div
        className="flex shrink-0 gap-0.5 border-b border-sage-200 px-2 pt-1.5"
        role="tablist"
        aria-label={shell.feedbackPanelTitle}
      >
        <PanelTab
          testId={PRACTICE_SHELL_TEST_IDS.tabTurn}
          label={shell.tabTurn}
          isActive={activeTab === 'turn'}
          onClick={() => onSelectTab('turn')}
        />
        <PanelTab
          testId={PRACTICE_SHELL_TEST_IDS.tabSuggest}
          label={shell.tabSuggest}
          isActive={activeTab === 'suggest'}
          onClick={() => onSelectTab('suggest')}
        />
        <PanelTab
          testId={PRACTICE_SHELL_TEST_IDS.tabSignals}
          label={shell.tabSignals}
          isActive={activeTab === 'signals'}
          onClick={() => onSelectTab('signals')}
        />
        <PanelTab
          testId={PRACTICE_SHELL_TEST_IDS.tabTech}
          label={shell.tabTech}
          isActive={activeTab === 'tech'}
          onClick={() => onSelectTab('tech')}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === 'turn' ? (
          hasTurnResults ? (
            <div data-testid={PRACTICE_SHELL_TEST_IDS.panelFilled} className="space-y-2.5">
              {pronunciationScore0to100 !== null ? (
                <div className="flex items-baseline justify-between rounded-[10px] border border-sage-200 bg-sage-50 px-3 py-2.5">
                  <span className="text-[0.65rem] font-semibold tracking-wider text-ink-600 uppercase">
                    {shell.scoreBlockLabel}
                  </span>
                  <strong className="font-serif text-[2rem] font-medium leading-none text-sage-600">
                    {pronunciationScore0to100.toFixed(0)}
                  </strong>
                </div>
              ) : null}

              {transcribedText ? (
                <FeedbackBlock title={homeScreenInterfaceTexts.transcriptionPanelLabel}>
                  <p className="m-0 font-mono text-[0.88rem] leading-snug text-ink-900">
                    {transcribedText}
                  </p>
                </FeedbackBlock>
              ) : null}

              {correctedGrammarText ? (
                <FeedbackBlock title={homeScreenInterfaceTexts.grammarCorrectionPanelLabel}>
                  <GrammarCorrectionDiff
                    originalText={transcribedText}
                    correctedText={correctedGrammarText}
                  />
                  {grammarCorrectionMadeNoChangesToTranscription ? (
                    <p className="mt-1.5 text-[0.78rem] text-ink-600 italic">
                      {
                        homeScreenInterfaceTexts.grammarCorrectionStatusMessages
                          .noCorrectionsNeeded
                      }
                    </p>
                  ) : null}
                </FeedbackBlock>
              ) : null}

              <FeedbackBlock title={homeScreenInterfaceTexts.pronunciationPanelLabel}>
                <p className="m-0 text-[0.88rem] text-ink-900">{pronunciationStatusMessage}</p>
                {pronunciationScore0to100 !== null ? (
                  <>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-sage-200">
                      <div
                        className="h-full rounded-full bg-sage-600 transition-[width] duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(0, pronunciationScore0to100))}%`,
                        }}
                      />
                    </div>
                    <PronunciationWordHighlights highlights={pronunciationWordHighlights} />
                  </>
                ) : null}
              </FeedbackBlock>

              <FeedbackBlock title={shell.breakdownTitle}>
                <div className="grid grid-cols-2 gap-2">
                  <Metric
                    label={shell.metricMfcc}
                    value={
                      pronunciationMfccScore0to100 !== null
                        ? pronunciationMfccScore0to100.toFixed(0)
                        : shell.metricUnavailable
                    }
                  />
                  <Metric
                    label={shell.metricPitch}
                    value={
                      pronunciationPitchScore0to100 !== null
                        ? pronunciationPitchScore0to100.toFixed(0)
                        : shell.metricUnavailable
                    }
                  />
                  <Metric label={shell.metricEnergy} value={shell.metricUnavailable} />
                  <Metric label={shell.metricFormants} value={shell.metricUnavailable} />
                </div>
                <p className="mt-2 font-mono text-[0.7rem] text-ink-400">
                  {formantsSummaryMessage ?? homeScreenInterfaceTexts.formantsUnavailable}
                </p>
                {pronunciationDetailMessage ? (
                  <p className="mt-1 text-[0.7rem] text-ink-400">{pronunciationDetailMessage}</p>
                ) : null}
              </FeedbackBlock>
            </div>
          ) : (
            <div
              data-testid={PRACTICE_SHELL_TEST_IDS.panelEmpty}
              className="px-3 py-8 text-center"
            >
              <p className="m-0 mb-1.5 text-[0.95rem] font-semibold text-ink-900">
                {shell.emptyPanelTitle}
              </p>
              <p className="m-0 text-[0.82rem] leading-snug text-ink-600">
                {shell.emptyPanelDescription}
              </p>
            </div>
          )
        ) : null}

        {activeTab === 'suggest' ? (
          <ul className="m-0 list-none space-y-2 p-0">
            <li className="rounded-[10px] border border-sage-200 bg-sage-50 px-3 py-2.5 text-[0.82rem] text-ink-600">
              {shell.suggestionsEmpty}
            </li>
            <li className="text-[0.75rem] text-ink-400">{shell.suggestionsPlaceholderHint}</li>
          </ul>
        ) : null}

        {/*
          Signal canvases stay mounted whenever the panel is open so session refs
          remain valid after capture (same pattern as the pre-Atelier lab).
        */}
        <div className={activeTab === 'signals' ? 'space-y-3' : 'hidden'}>
          <p className="m-0 text-[0.78rem] text-ink-600">{shell.signalsOverlayHint}</p>
          <div>
            <p className="mb-1 text-[0.65rem] font-semibold tracking-wider text-ink-600 uppercase">
              {homeScreenInterfaceTexts.spectrogramPanelLabel}
            </p>
            <canvas
              ref={spectrogramCanvasRef}
              data-testid={PRACTICE_SHELL_TEST_IDS.spectrogramCanvas}
              width={320}
              height={100}
              className={`h-[100px] w-full rounded-lg bg-sage-950 ${
                hasCompletedCapture || isListening ? '' : 'opacity-40'
              }`}
            />
          </div>
          <div>
            <p className="mb-1 text-[0.65rem] font-semibold tracking-wider text-ink-600 uppercase">
              {homeScreenInterfaceTexts.pitchTrackPanelLabel}
            </p>
            <canvas
              ref={pitchTrackCanvasRef}
              data-testid={PRACTICE_SHELL_TEST_IDS.pitchTrackCanvas}
              width={320}
              height={72}
              className={`h-[72px] w-full rounded-lg bg-sage-950 ${
                hasCompletedCapture || isListening ? '' : 'opacity-40'
              }`}
            />
          </div>
          <FormantVowelMap
            current={medianFormants}
            historyTurns={practiceHistoryTurns}
            isReady={hasCompletedCapture || isListening}
          />
          <div className="rounded-[10px] border border-sage-200 bg-sage-50 px-3 py-2">
            <p className="m-0 text-[0.65rem] font-semibold tracking-wider text-ink-600 uppercase">
              {homeScreenInterfaceTexts.formantsPanelLabel}
            </p>
            <p className="mt-1 font-mono text-sm text-ink-900">
              {formantsSummaryMessage ?? homeScreenInterfaceTexts.formantsUnavailable}
            </p>
          </div>
        </div>

        {activeTab === 'tech' ? (
          <div className="space-y-3">
            <ul className="m-0 list-none space-y-1.5 p-0 text-[0.8rem]">
              <TechRow label={shell.techMicLabel} value={micTechLabel} />
              <TechRow label={shell.techAsrLabel} value={shell.techAsrValue} />
              <TechRow label={shell.techGrammarLabel} value={shell.techGrammarValue} />
              <TechRow label={shell.techTutorLabel} value={shell.techTutorValue} />
              <TechRow label={shell.techTtsLabel} value={shell.techTtsValue} />
              <TechRow label={shell.techScoreLabel} value={shell.techScoreValue} />
            </ul>
            <div className="space-y-1 border-t border-sage-200 pt-2 text-[0.72rem] text-ink-600">
              <p>
                <strong>{homeScreenInterfaceTexts.statusFieldLabel}:</strong>{' '}
                {microphoneStatusMessage}
              </p>
              <p>
                <strong>{homeScreenInterfaceTexts.transcriptionPanelLabel}:</strong>{' '}
                {transcriptionStatusMessage}
              </p>
              <p>
                <strong>{homeScreenInterfaceTexts.grammarCorrectionPanelLabel}:</strong>{' '}
                {grammarCorrectionStatusMessage}
              </p>
              <p>
                <strong>{homeScreenInterfaceTexts.tutorGeneration.panelLabel}:</strong>{' '}
                {tutorGenerationStatusMessage}
              </p>
              <p>
                <strong>{homeScreenInterfaceTexts.speechSynthesisPanelLabel}:</strong>{' '}
                {speechSynthesisStatusMessage}
              </p>
              <p>
                <strong>{homeScreenInterfaceTexts.pronunciationPanelLabel}:</strong>{' '}
                {pronunciationPipelineStatusMessage}
              </p>
              {captureDiagnosticsMessage ? (
                <p className="text-ink-400">
                  <strong>{homeScreenInterfaceTexts.captureDiagnosticsLabel}:</strong>{' '}
                  {captureDiagnosticsMessage}
                </p>
              ) : null}
              {environmentDiagnosticsMessage ? (
                <p className="text-ink-400">{environmentDiagnosticsMessage}</p>
              ) : null}
              <p className="font-mono text-[0.7rem] text-ink-400">
                {homeScreenInterfaceTexts.liveMetersDetail(liveRms, livePeak)}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  )
}

function PanelTab({
  testId,
  label,
  isActive,
  onClick,
}: {
  testId: string
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      data-testid={testId}
      aria-selected={isActive}
      onClick={onClick}
      className={`mb-[-1px] flex-1 border-b-2 px-0.5 py-2 text-[0.7rem] font-semibold ${
        isActive
          ? 'border-sage-600 text-ink-900'
          : 'border-transparent text-ink-600 hover:text-ink-900'
      }`}
    >
      {label}
    </button>
  )
}

function FeedbackBlock({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[10px] border border-sage-200 bg-sage-50 px-2.5 py-2">
      <h3 className="m-0 mb-1 text-[0.62rem] font-semibold tracking-[0.1em] text-ink-600 uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-sage-200 bg-atelier-elev px-2 py-1.5">
      <span className="block text-[0.6rem] tracking-wide text-ink-400 uppercase">{label}</span>
      <b className="font-mono text-sm font-semibold text-ink-900">{value}</b>
    </div>
  )
}

function TechRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-sage-200 bg-sage-50 px-2.5 py-1.5">
      <span className="text-ink-600">{label}</span>
      <em className="not-italic font-mono text-[0.75rem] text-ink-900">{value}</em>
    </li>
  )
}
