/**
 * Presentational scenario selector for guided practice (Avance 2).
 */

import type { PracticeScenarioId } from './practice-scenarios'
import { listPracticeScenarioIds } from './practice-scenarios'
import { homeScreenInterfaceTexts } from './interface-texts'

export interface ScenarioPickerProps {
  selectedScenarioId: PracticeScenarioId
  isSelectionLocked: boolean
  onSelectScenario: (scenarioId: PracticeScenarioId) => void
}

export function ScenarioPicker({
  selectedScenarioId,
  isSelectionLocked,
  onSelectScenario,
}: ScenarioPickerProps) {
  const scenarioIds = listPracticeScenarioIds()
  const labels = homeScreenInterfaceTexts.practiceScenarios

  return (
    <section className="text-left" aria-label={labels.sectionAriaLabel}>
      <h2 className="text-sm font-semibold text-ink-900">{labels.sectionTitle}</h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-400">{labels.sectionHint}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {scenarioIds.map((scenarioId) => {
          const isSelected = scenarioId === selectedScenarioId
          const copy = labels.byId[scenarioId]
          return (
            <button
              key={scenarioId}
              type="button"
              disabled={isSelectionLocked}
              onClick={() => onSelectScenario(scenarioId)}
              className={`rounded-lg border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                isSelected
                  ? 'border-sage-800 bg-sage-100 text-sage-800'
                  : 'border-sage-200 bg-white text-ink-900 hover:border-sage-300'
              }`}
            >
              <span className="block text-sm font-semibold">{copy.title}</span>
              <span className="mt-1 block text-xs text-ink-600">{copy.description}</span>
            </button>
          )
        })}
      </div>
      {isSelectionLocked ? (
        <p className="mt-2 text-xs text-ink-400">{labels.lockedWhileListening}</p>
      ) : null}
    </section>
  )
}
