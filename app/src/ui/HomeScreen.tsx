/**
 * Atelier practice shell: rail + centered chat + feedback artifact panel (#81).
 */

import { useState, type RefObject } from 'react'
import type { FormantTriple } from '../dsp/formant-estimation'
import type { WordPronunciationHighlight } from '../dsp/word-pronunciation-highlights'
import type { PracticeTurnRecord } from '../storage/practice-session-types'
import type { CommunicationSuggestion } from '../ia/communication-suggestions'
import type { DrillUiStatus } from './home-screen-status'
import type { OfflineReadiness } from './offline-readiness'
import {
  offlineReadinessCompactMessageFor,
  offlineReadinessMessageFor,
} from './offline-readiness'
import { homeScreenInterfaceTexts } from './interface-texts'
import type { PracticeChatMessage } from './practice-chat-messages'
import type { PracticeScenarioId } from './practice-scenarios'
import {
  PRACTICE_SHELL_TEST_IDS,
  type PracticeFeedbackTab,
  type PracticeModeId,
  type PracticeShellView,
} from './practice-shell-types'
import { resolveAsrDemoProfile } from '../ia/model-registry'
import { FeedbackPanel } from './FeedbackPanel'
import { PracticeChatPanel } from './PracticeChatPanel'
import { CommunicationSuggestionsPanel } from './CommunicationSuggestionsPanel'
import { DrillPanel } from './DrillPanel'
import { PracticeComposer } from './PracticeComposer'
import { PracticeHistoryPanel } from './PracticeHistoryPanel'
import { OverlayView } from './overlay-view'
import { PracticeRail } from './PracticeRail'

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
  pronunciationMfccScore0to100: number | null
  pronunciationPitchScore0to100: number | null
  pronunciationWordHighlights: readonly WordPronunciationHighlight[]
  formantsSummaryMessage: string | null
  medianFormants: FormantTriple | null
  practiceHistoryTurns: readonly PracticeTurnRecord[]
  practiceHistoryStatusMessage: string
  /** Friendly single-line pipeline status for the composer. */
  primaryActivityMessage: string
  isPreparingModels: boolean
  /** Full offline readiness message (also used in rail compact form). */
  offlineReadinessMessage: string
  offlineReadiness: OfflineReadiness
  selectedScenarioId: PracticeScenarioId
  chatMessages: readonly PracticeChatMessage[]
  communicationSuggestions: readonly CommunicationSuggestion[]
  lastTutorLineEn: string
  drillStatus: DrillUiStatus
  drillScore0to100: number | null
  drillWordHighlights: readonly WordPronunciationHighlight[]
  isDrillListening: boolean
  onStartDrill: () => void
  onStopDrill: () => void
  firstTurnHintEn: string
  onSelectScenario: (scenarioId: PracticeScenarioId) => void
  onStartMicrophone: () => void
  onStopMicrophone: () => void
}

export function HomeScreen(props: HomeScreenProps) {
  const {
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
    pronunciationMfccScore0to100,
    pronunciationPitchScore0to100,
    pronunciationWordHighlights,
    formantsSummaryMessage,
    medianFormants,
    practiceHistoryTurns,
    practiceHistoryStatusMessage,
    primaryActivityMessage,
    isPreparingModels,
    offlineReadiness,
    selectedScenarioId,
    chatMessages,
    communicationSuggestions,
    lastTutorLineEn,
    drillStatus,
    drillScore0to100,
    drillWordHighlights,
    isDrillListening,
    onStartDrill,
    onStopDrill,
    firstTurnHintEn,
    onSelectScenario,
    onStartMicrophone,
    onStopMicrophone,
  } = props

  const [activeView, setActiveView] = useState<PracticeShellView>('practice')
  const [practiceMode, setPracticeMode] = useState<PracticeModeId>('conversation')
  const [feedbackTab, setFeedbackTab] = useState<PracticeFeedbackTab>('turn')
  /** User explicitly opened the panel (overrides auto-open rules). */
  const [panelManuallyOpen, setPanelManuallyOpen] = useState(false)
  /**
   * Fingerprint of the last turn the user dismissed. A new turn (different
   * fingerprint) auto-opens the panel again without an effect.
   */
  const [dismissedTurnFingerprint, setDismissedTurnFingerprint] = useState<string | null>(null)

  const hasTurnResults =
    Boolean(transcribedText) ||
    Boolean(correctedGrammarText) ||
    pronunciationScore0to100 !== null

  const turnFingerprint = hasTurnResults
    ? `${transcribedText}\u0000${correctedGrammarText}\u0000${String(pronunciationScore0to100)}`
    : ''

  // ChatGPT-style artifact panel: auto-open when there is turn data the user
  // has not dismissed; manual open always wins.
  const isFeedbackPanelOpen =
    panelManuallyOpen ||
    (turnFingerprint !== '' && turnFingerprint !== dismissedTurnFingerprint)

  const openFeedbackPanel = (tab: PracticeFeedbackTab = 'turn') => {
    setFeedbackTab(tab)
    setPanelManuallyOpen(true)
    setDismissedTurnFingerprint(null)
  }

  const closeFeedbackPanel = () => {
    setPanelManuallyOpen(false)
    if (turnFingerprint !== '') {
      setDismissedTurnFingerprint(turnFingerprint)
    }
  }

  const toggleFeedbackPanel = () => {
    if (isFeedbackPanelOpen) {
      closeFeedbackPanel()
    } else {
      openFeedbackPanel(feedbackTab)
    }
  }

  const isScenarioSelectionLocked = isStarting || isListening || isTutorSpeaking
  const scenarioTitle =
    homeScreenInterfaceTexts.practiceScenarios.byId[selectedScenarioId].title
  const showMockEnvironmentWarning =
    environmentDiagnosticsMessage?.includes('NO (hay un mock') ?? false
  const shell = homeScreenInterfaceTexts.shell
  const offlineCompact = offlineReadinessCompactMessageFor(offlineReadiness)
  const offlineFull = offlineReadinessMessageFor(offlineReadiness)

  const handleNavigate = (view: PracticeShellView) => {
    if (view === 'signals') {
      // Rail highlight + open artifact panel on Señales (single canvas pair).
      setActiveView('signals')
      openFeedbackPanel('signals')
      return
    }
    setActiveView(view)
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-sage-50 font-sans text-ink-900"
      data-testid={PRACTICE_SHELL_TEST_IDS.shell}
      data-shell-variant="chatgpt"
    >
      {showMockEnvironmentWarning && environmentDiagnosticsMessage ? (
        <p className="shrink-0 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 ring-1 ring-amber-200">
          {environmentDiagnosticsMessage}
        </p>
      ) : null}

      {isPreparingModels ? (
        <p className="shrink-0 bg-sage-100 px-4 py-1.5 text-center text-xs text-sage-800">
          {homeScreenInterfaceTexts.modelsWarmingUpMessage}
        </p>
      ) : null}

      <div className="relative flex min-h-0 flex-1">
        <PracticeRail
          activeView={activeView}
          practiceMode={practiceMode}
          selectedScenarioId={selectedScenarioId}
          isScenarioSelectionLocked={isScenarioSelectionLocked}
          firstTurnHintEn={firstTurnHintEn}
          offlineCompactMessage={offlineCompact}
          isFullyOfflineReady={offlineReadiness === 'fully-cached'}
          asrDemoProfile={resolveAsrDemoProfile()}
          onNavigate={handleNavigate}
          onSelectScenario={onSelectScenario}
          onSelectMode={setPracticeMode}
        />

        <main
          className="flex min-w-0 flex-1 flex-col bg-sage-50"
          data-testid={PRACTICE_SHELL_TEST_IDS.center}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-sage-200 bg-atelier-elev px-5 py-2.5">
            <div>
              <h1 className="m-0 text-[1.05rem] font-bold tracking-tight text-ink-900">
                {scenarioTitle}
              </h1>
              <p className="m-0 mt-0.5 text-xs text-ink-600">{shell.centerSubtitle}</p>
            </div>
            <button
              type="button"
              data-testid={PRACTICE_SHELL_TEST_IDS.panelToggle}
              onClick={() => {
                if (activeView === 'history') {
                  setActiveView('practice')
                }
                toggleFeedbackPanel()
              }}
              className={`rounded-lg border px-3 py-1.5 text-[0.78rem] font-semibold transition ${
                isFeedbackPanelOpen
                  ? 'border-sage-600/40 bg-sage-100 text-sage-700'
                  : 'border-sage-200 bg-sage-50 text-ink-600 hover:border-sage-600 hover:text-ink-900'
              }`}
              title={shell.feedbackToggle}
            >
              {shell.feedbackToggle}
            </button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 py-4">
            <p
              className="mb-3 w-full max-w-[44rem] rounded-lg bg-atelier-elev px-3 py-2 text-center text-[0.72rem] text-ink-600 ring-1 ring-sage-200"
              title={offlineFull}
            >
              {offlineFull}
            </p>
            <PracticeChatPanel
              messages={chatMessages}
              firstTurnHintEn={firstTurnHintEn}
              isTutorPreparingConversationModel={isTutorPreparingConversationModel}
              isTutorComposingReply={isTutorComposingReply}
              tutorGenerationStatusMessage={tutorGenerationStatusMessage}
              showSectionChrome={false}
              onOpenTurnSignals={() => {
                setActiveView('signals')
                openFeedbackPanel('signals')
              }}
            />
            <div className="mt-3 w-full max-w-[44rem] rounded-2xl bg-white p-4 shadow-sm ring-1 ring-sage-200/80">
              <CommunicationSuggestionsPanel suggestions={communicationSuggestions} />
            </div>

            <div className="mt-3 w-full max-w-[44rem] rounded-2xl bg-white p-4 shadow-sm ring-1 ring-sage-200/80">
              <DrillPanel
                lastTutorLineEn={lastTutorLineEn}
                drillStatus={drillStatus}
                drillScore0to100={drillScore0to100}
                drillWordHighlights={drillWordHighlights}
                isDrillListening={isDrillListening}
                onStartDrill={onStartDrill}
                onStopDrill={onStopDrill}
              />
            </div>
          </div>

          <PracticeComposer
            canvasRef={canvasRef}
            isStarting={isStarting}
            isListening={isListening}
            isDrillListening={isDrillListening}
            isTutorSpeaking={isTutorSpeaking}
            isPreparingModels={isPreparingModels}
            liveInputLevel01={liveInputLevel01}
            livePeak={livePeak}
            activeMicrophoneLabel={activeMicrophoneLabel}
            primaryActivityMessage={primaryActivityMessage}
            onStartMicrophone={() => {
              openFeedbackPanel('signals')
              onStartMicrophone()
            }}
            onStopMicrophone={onStopMicrophone}
          />
        </main>

        <FeedbackPanel
          isOpen={isFeedbackPanelOpen}
          activeTab={feedbackTab}
          hasTurnResults={hasTurnResults}
          transcribedText={transcribedText}
          correctedGrammarText={correctedGrammarText}
          grammarCorrectionMadeNoChangesToTranscription={
            grammarCorrectionMadeNoChangesToTranscription
          }
          pronunciationScore0to100={pronunciationScore0to100}
          pronunciationStatusMessage={pronunciationStatusMessage}
          pronunciationDetailMessage={pronunciationDetailMessage}
          pronunciationMfccScore0to100={pronunciationMfccScore0to100}
          pronunciationPitchScore0to100={pronunciationPitchScore0to100}
          pronunciationWordHighlights={pronunciationWordHighlights}
          formantsSummaryMessage={formantsSummaryMessage}
          medianFormants={medianFormants}
          practiceHistoryTurns={practiceHistoryTurns}
          spectrogramCanvasRef={spectrogramCanvasRef}
          pitchTrackCanvasRef={pitchTrackCanvasRef}
          hasCompletedCapture={hasCompletedCapture}
          microphoneStatusMessage={microphoneStatusMessage}
          transcriptionStatusMessage={transcriptionStatusMessage}
          grammarCorrectionStatusMessage={grammarCorrectionStatusMessage}
          tutorGenerationStatusMessage={tutorGenerationStatusMessage}
          speechSynthesisStatusMessage={speechSynthesisStatusMessage}
          pronunciationPipelineStatusMessage={pronunciationStatusMessage}
          captureDiagnosticsMessage={captureDiagnosticsMessage}
          environmentDiagnosticsMessage={environmentDiagnosticsMessage}
          liveRms={liveRms}
          livePeak={livePeak}
          isListening={isListening}
          isStarting={isStarting}
          onClose={closeFeedbackPanel}
          onSelectTab={setFeedbackTab}
        />

        {activeView === 'history' ? (
          <OverlayView
            testId={PRACTICE_SHELL_TEST_IDS.historyOverlay}
            title={shell.historyOverlayTitle}
            onBack={() => setActiveView('practice')}
          >
            <PracticeHistoryPanel
              turns={practiceHistoryTurns}
              statusMessage={practiceHistoryStatusMessage}
            />
          </OverlayView>
        ) : null}

      </div>
    </div>
  )
}
