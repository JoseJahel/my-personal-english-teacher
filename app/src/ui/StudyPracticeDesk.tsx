import { useEffect, useState } from 'react'
import { itemsForMode } from '../study/practice-bank'
import {
  checkCompletarChoice,
  checkWrittenAnswer,
  createPracticeSession,
  currentPracticeIndex,
  goToNextPracticeItem,
  rateVocabAndNext,
  revealPracticeItem,
  selectPracticeMode,
  selectPracticeTema,
} from '../study/practice-session'
import {
  PRACTICE_MODES,
  type PracticeBank,
  type PracticeItem,
  type PracticeMode,
  type VocabPracticeItem,
} from '../study/study-types'
import { STUDY_TEST_IDS, labelForStudyTema, studyInterfaceTexts } from './study-interface-texts'

const MODE_LABEL: Record<PracticeMode, string> = {
  vocab: studyInterfaceTexts.modeVocabLabel,
  completar: studyInterfaceTexts.modeCompletarLabel,
  traducir: studyInterfaceTexts.modeTraducirLabel,
  transformar: studyInterfaceTexts.modeTransformarLabel,
}

export function StudyPracticeDesk(props: {
  readonly bank: PracticeBank
  readonly tema: string | null
  readonly lessonTema: string | null
  readonly onTemaChange: (tema: string | null) => void
  readonly onBackToLesson: () => void
}) {
  const copy = studyInterfaceTexts
  const [session, setSession] = useState(() => createPracticeSession('vocab', props.tema))
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setSession((current) => selectPracticeTema(current, props.tema))
  }, [props.tema])

  useEffect(() => {
    setDraft('')
  }, [session.index, session.mode, props.tema])

  const items = itemsForMode(props.bank, session.mode, props.tema)
  const index = currentPracticeIndex(session, items.length)
  const item = items[index]
  const chipTema = props.lessonTema ?? props.tema

  return (
    <section
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-atelier-elev shadow-sm ring-1 ring-sage-200"
      data-testid={STUDY_TEST_IDS.practiceDesk}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-sage-200 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid={STUDY_TEST_IDS.practiceFilterTema}
            className={chipClass(props.tema !== null && props.tema === chipTema)}
            disabled={chipTema === null}
            onClick={() => {
              if (chipTema) {
                props.onTemaChange(chipTema)
              }
            }}
          >
            {chipTema ? labelForStudyTema(chipTema) : copy.filterAllLabel}
          </button>
          <button
            type="button"
            data-testid={STUDY_TEST_IDS.practiceFilterAll}
            className={chipClass(props.tema === null)}
            onClick={() => props.onTemaChange(null)}
          >
            {copy.filterAllLabel}
          </button>
        </div>
        <button
          type="button"
          data-testid={STUDY_TEST_IDS.practiceBackLesson}
          className="rounded-lg border border-sage-200 bg-sage-50 px-3 py-1.5 text-sm font-semibold text-ink-600 hover:border-sage-600"
          onClick={props.onBackToLesson}
        >
          {copy.backToLessonLabel}
        </button>
      </header>

      <div className="flex shrink-0 flex-wrap gap-2 border-b border-sage-200 px-4 py-2">
        {PRACTICE_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            data-testid={`study-practice-mode-${mode}`}
            aria-pressed={session.mode === mode}
            className={chipClass(session.mode === mode)}
            onClick={() => setSession((current) => selectPracticeMode(current, mode))}
          >
            {MODE_LABEL[mode]}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4">
        {item ? (
          <PracticeItemPane
            item={item}
            revealed={session.revealed}
            grade={session.grade}
            draft={draft}
            onDraft={setDraft}
            onReveal={() => setSession(revealPracticeItem)}
            onRateVocab={() => setSession((current) => rateVocabAndNext(current, items.length))}
            onChoose={(optionIndex) =>
              setSession((current) => {
                const correctIndex = choiceCorrectIndex(item)
                return correctIndex === null
                  ? current
                  : checkCompletarChoice(current, optionIndex, correctIndex, items.length)
              })
            }
            onCheck={() =>
              setSession((current) => {
                const expected = writtenExpected(item)
                return expected === null
                  ? current
                  : checkWrittenAnswer(current, draft, expected, items.length)
              })
            }
            onNext={() => setSession((current) => goToNextPracticeItem(current, items.length))}
          />
        ) : (
          <div className="m-auto max-w-md text-center" data-testid={STUDY_TEST_IDS.practiceEmpty}>
            <p className="m-0 font-serif text-xl text-ink-900">{copy.emptyModeLead}</p>
            <p className="mt-2 text-sm text-ink-600">{copy.emptyModeHint}</p>
          </div>
        )}
      </div>
    </section>
  )
}

function choiceCorrectIndex(item: PracticeItem): number | null {
  if (item.kind === 'completar') return item.correctIndex
  if (item.kind !== 'transformar' || !item.options?.length) return null
  const index = item.options.indexOf(item.answer)
  return index >= 0 ? index : null
}

function writtenExpected(item: PracticeItem): string | null {
  if (item.kind === 'traducir') return item.answerEn
  if (item.kind === 'transformar') return item.answer
  return null
}

function chipClass(active: boolean): string {
  return active
    ? 'rounded-lg bg-sage-100 px-3 py-1.5 text-sm font-semibold text-ink-900 ring-1 ring-sage-600'
    : 'rounded-lg border border-sage-200 bg-sage-50 px-3 py-1.5 text-sm font-semibold text-ink-600 hover:border-sage-600'
}

function PracticeItemPane(props: {
  readonly item: PracticeItem
  readonly revealed: boolean
  readonly grade: 'correct' | 'incorrect' | null
  readonly draft: string
  readonly onDraft: (value: string) => void
  readonly onReveal: () => void
  readonly onRateVocab: () => void
  readonly onChoose: (optionIndex: number) => void
  readonly onCheck: () => void
  readonly onNext: () => void
}) {
  const item = props.item
  if (item.kind === 'vocab') {
    return <VocabPane item={item} revealed={props.revealed} onReveal={props.onReveal} onRate={props.onRateVocab} />
  }
  if (item.kind === 'completar') {
    return (
      <ChoicePane
        prompt={item.phrase}
        options={item.options}
        solution={item.options[item.correctIndex] ?? ''}
        grade={props.grade}
        onChoose={props.onChoose}
        onNext={props.onNext}
      />
    )
  }
  if (item.kind === 'traducir') {
    return (
      <WrittenPane
        prompt={studyInterfaceTexts.translatePrompt}
        stimulus={item.promptEs}
        expected={item.answerEn}
        draft={props.draft}
        grade={props.grade}
        onDraft={props.onDraft}
        onCheck={props.onCheck}
        onNext={props.onNext}
      />
    )
  }
  if (item.options && item.options.length > 0) {
    return (
      <ChoicePane
        prompt={`${item.prompt} · ${item.stimulus}`}
        options={item.options}
        solution={item.answer}
        grade={props.grade}
        onChoose={props.onChoose}
        onNext={props.onNext}
      />
    )
  }
  return (
    <WrittenPane
      prompt={item.prompt}
      stimulus={item.stimulus}
      expected={item.answer}
      draft={props.draft}
      grade={props.grade}
      onDraft={props.onDraft}
      onCheck={props.onCheck}
      onNext={props.onNext}
    />
  )
}

function VocabPane(props: {
  readonly item: VocabPracticeItem
  readonly revealed: boolean
  readonly onReveal: () => void
  readonly onRate: () => void
}) {
  const copy = studyInterfaceTexts
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        data-testid={STUDY_TEST_IDS.practiceCard}
        aria-pressed={props.revealed}
        className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl bg-sage-50 px-6 py-8 text-center ring-1 ring-sage-200"
        onClick={props.onReveal}
      >
        <p
          data-testid={STUDY_TEST_IDS.practiceCardFront}
          className={props.revealed ? 'hidden' : 'm-0 font-serif text-3xl text-ink-900'}
        >
          {props.item.frontEs}
        </p>
        <p
          data-testid={STUDY_TEST_IDS.practiceCardBack}
          className={props.revealed ? 'm-0 font-serif text-3xl text-ink-900' : 'hidden'}
        >
          {props.item.backEn}
        </p>
        {props.revealed ? null : <p className="mt-4 text-sm text-ink-600">{copy.flipHint}</p>}
      </button>
      <div className="mt-3 flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          data-testid={STUDY_TEST_IDS.practiceKnew}
          className="rounded-lg bg-sage-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sage-700 disabled:opacity-40"
          disabled={!props.revealed}
          onClick={props.onRate}
        >
          {copy.knewLabel}
        </button>
        <button
          type="button"
          data-testid={STUDY_TEST_IDS.practiceDidnt}
          className="rounded-lg border border-sage-200 bg-sage-50 px-4 py-2 text-sm font-semibold text-ink-600 hover:border-sage-600 disabled:opacity-40"
          disabled={!props.revealed}
          onClick={props.onRate}
        >
          {copy.didntKnowLabel}
        </button>
      </div>
    </div>
  )
}

function ChoicePane(props: {
  readonly prompt: string
  readonly options: readonly string[]
  readonly solution: string
  readonly grade: 'correct' | 'incorrect' | null
  readonly onChoose: (optionIndex: number) => void
  readonly onNext: () => void
}) {
  const copy = studyInterfaceTexts
  const locked = props.grade !== null
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="m-0 font-serif text-2xl text-ink-900">{props.prompt}</p>
      <div className="mt-4 flex flex-col gap-2">
        {props.options.map((option, optionIndex) => (
          <button
            key={`${option}-${optionIndex}`}
            type="button"
            data-testid={STUDY_TEST_IDS.practiceOption}
            className="rounded-lg border border-sage-200 bg-sage-50 px-4 py-2 text-left text-sm font-semibold text-ink-900 hover:border-sage-600 disabled:opacity-60"
            disabled={locked}
            onClick={() => props.onChoose(optionIndex)}
          >
            {option}
          </button>
        ))}
      </div>
      {props.grade === 'incorrect' ? (
        <div className="mt-4">
          <p className="m-0 text-sm text-ink-600" data-testid={STUDY_TEST_IDS.practiceSolution}>
            {copy.incorrectLabel} {props.solution}
          </p>
          <button
            type="button"
            data-testid={STUDY_TEST_IDS.practiceNext}
            className="mt-3 rounded-lg bg-sage-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sage-700"
            onClick={props.onNext}
          >
            {copy.nextItemLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function WrittenPane(props: {
  readonly prompt: string
  readonly stimulus: string
  readonly expected: string
  readonly draft: string
  readonly grade: 'correct' | 'incorrect' | null
  readonly onDraft: (value: string) => void
  readonly onCheck: () => void
  readonly onNext: () => void
}) {
  const copy = studyInterfaceTexts
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="m-0 text-sm font-semibold uppercase tracking-wide text-ink-600">{props.prompt}</p>
      <p className="mt-2 font-serif text-2xl text-ink-900">{props.stimulus}</p>
      <input
        data-testid={STUDY_TEST_IDS.practiceTranslateInput}
        className="mt-4 rounded-lg border border-sage-200 bg-sage-50 px-3 py-2 text-sm text-ink-900"
        value={props.draft}
        placeholder={copy.translatePlaceholder}
        disabled={props.grade === 'incorrect'}
        onChange={(event) => props.onDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          if (props.grade === 'incorrect') props.onNext()
          else props.onCheck()
        }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid={STUDY_TEST_IDS.practiceCheck}
          className="rounded-lg bg-sage-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sage-700 disabled:opacity-40"
          disabled={props.grade === 'incorrect'}
          onClick={props.onCheck}
        >
          {copy.checkLabel}
        </button>
        {props.grade === 'incorrect' ? (
          <button
            type="button"
            data-testid={STUDY_TEST_IDS.practiceNext}
            className="rounded-lg border border-sage-200 bg-sage-50 px-4 py-2 text-sm font-semibold text-ink-600"
            onClick={props.onNext}
          >
            {copy.nextItemLabel}
          </button>
        ) : null}
      </div>
      {props.grade === 'incorrect' ? (
        <p className="mt-3 text-sm text-ink-600" data-testid={STUDY_TEST_IDS.practiceSolution}>
          {copy.incorrectLabel} {props.expected}
        </p>
      ) : null}
    </div>
  )
}
