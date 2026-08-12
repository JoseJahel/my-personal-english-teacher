/**
 * Left navigation rail for the Atelier practice shell (issue #81).
 */

import { homeScreenInterfaceTexts } from './interface-texts'
import {
  PRACTICE_SHELL_TEST_IDS,
  type PracticeModeId,
  type PracticeShellView,
} from './practice-shell-types'
import type { PracticeScenarioId } from './practice-scenarios'
import { listPracticeScenarioIds } from './practice-scenarios'

export interface PracticeRailProps {
  readonly activeView: PracticeShellView
  readonly practiceMode: PracticeModeId
  readonly selectedScenarioId: PracticeScenarioId
  readonly isScenarioSelectionLocked: boolean
  readonly firstTurnHintEn: string
  readonly offlineCompactMessage: string
  readonly isFullyOfflineReady: boolean
  readonly onNavigate: (view: PracticeShellView) => void
  readonly onSelectScenario: (scenarioId: PracticeScenarioId) => void
  readonly onSelectMode: (mode: PracticeModeId) => void
}

export function PracticeRail({
  activeView,
  practiceMode,
  selectedScenarioId,
  isScenarioSelectionLocked,
  firstTurnHintEn,
  offlineCompactMessage,
  isFullyOfflineReady,
  onNavigate,
  onSelectScenario,
  onSelectMode,
}: PracticeRailProps) {
  const shell = homeScreenInterfaceTexts.shell
  const scenarioLabels = homeScreenInterfaceTexts.practiceScenarios
  const scenarioIds = listPracticeScenarioIds()

  return (
    <aside
      className="flex w-60 shrink-0 flex-col gap-0.5 border-r border-sage-200 bg-atelier-elev px-2.5 py-3"
      data-testid={PRACTICE_SHELL_TEST_IDS.rail}
      aria-label={homeScreenInterfaceTexts.applicationTitle}
    >
      <div className="mb-2 flex items-center gap-2.5 border-b border-sage-200 px-1.5 pb-3">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-900 font-serif text-lg text-sage-50"
          aria-hidden
        >
          {homeScreenInterfaceTexts.brandMarkLetter}
        </span>
        <div className="min-w-0">
          <strong className="block text-sm tracking-tight text-ink-900">
            {homeScreenInterfaceTexts.brandShortName}
          </strong>
          <span className="block text-[0.68rem] text-ink-600">
            {homeScreenInterfaceTexts.brandProductLine}
          </span>
        </div>
      </div>

      <nav className="mb-2.5 flex flex-col gap-0.5" aria-label="Navegación principal">
        <RailNavButton
          testId={PRACTICE_SHELL_TEST_IDS.railNavPractice}
          isActive={activeView === 'practice'}
          onClick={() => onNavigate('practice')}
          icon="◎"
          label={shell.navPractice}
        />
        <RailNavButton
          testId={PRACTICE_SHELL_TEST_IDS.railNavHistory}
          isActive={activeView === 'history'}
          onClick={() => onNavigate('history')}
          icon="☰"
          label={shell.navHistory}
        />
        <RailNavButton
          testId={PRACTICE_SHELL_TEST_IDS.railNavSignals}
          isActive={activeView === 'signals'}
          onClick={() => onNavigate('signals')}
          icon="∿"
          label={shell.navSignals}
        />
      </nav>

      <div className="mt-1">
        <p className="mx-1.5 mb-1.5 mt-2 text-[0.62rem] font-semibold tracking-[0.1em] text-ink-600 uppercase">
          {shell.scenarioLabel}
        </p>
        {scenarioIds.map((scenarioId) => {
          const isSelected = scenarioId === selectedScenarioId
          return (
            <button
              key={scenarioId}
              type="button"
              disabled={isScenarioSelectionLocked}
              onClick={() => onSelectScenario(scenarioId)}
              className={`mb-0.5 block w-full rounded-lg px-2.5 py-1.5 text-left text-[0.86rem] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? 'bg-sage-100 font-semibold text-ink-900 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-sage-600)_35%,transparent)]'
                  : 'text-ink-600 hover:bg-atelier-hover hover:text-ink-900'
              }`}
            >
              {scenarioLabels.byId[scenarioId].title}
            </button>
          )
        })}
        {isScenarioSelectionLocked ? (
          <p className="mx-1.5 mt-1 text-[0.65rem] text-ink-400">
            {scenarioLabels.lockedWhileListening}
          </p>
        ) : null}
      </div>

      <div className="mt-2">
        <p className="mx-1.5 mb-1.5 mt-2 text-[0.62rem] font-semibold tracking-[0.1em] text-ink-600 uppercase">
          {shell.modeLabel}
        </p>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-sage-200 bg-sage-50 p-0.5">
          <button
            type="button"
            onClick={() => onSelectMode('conversation')}
            className={`rounded-md px-1 py-1.5 text-[0.72rem] font-semibold ${
              practiceMode === 'conversation'
                ? 'bg-atelier-elev text-ink-900 shadow-sm'
                : 'text-ink-600'
            }`}
          >
            {shell.modeConversation}
          </button>
          <button
            type="button"
            title={shell.modeDrillUnavailableTitle}
            disabled
            aria-disabled
            className="cursor-not-allowed rounded-md px-1 py-1.5 text-[0.72rem] font-semibold text-ink-400 opacity-60"
          >
            {shell.modeDrill}
          </button>
        </div>
      </div>

      <div className="mt-auto pt-3">
        <p className="mb-2 flex items-center gap-1.5 px-1.5 text-[0.72rem] text-ink-600">
          <i
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              isFullyOfflineReady ? 'bg-atelier-ok' : 'bg-ink-400'
            }`}
            aria-hidden
          />
          {offlineCompactMessage}
        </p>
        <p className="m-0 rounded-lg border border-sage-200 bg-sage-50 px-2.5 py-2 font-serif text-[0.82rem] leading-snug text-ink-600 italic">
          {firstTurnHintEn}
        </p>
      </div>
    </aside>
  )
}

function RailNavButton({
  testId,
  isActive,
  onClick,
  icon,
  label,
}: {
  testId: string
  isActive: boolean
  onClick: () => void
  icon: string
  label: string
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[0.88rem] font-medium transition-colors ${
        isActive
          ? 'bg-sage-100 font-semibold text-ink-900'
          : 'text-ink-600 hover:bg-atelier-hover hover:text-ink-900'
      }`}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="w-4 text-center text-sm opacity-75" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  )
}
