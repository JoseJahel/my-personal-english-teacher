import { useState } from 'react'
import type { PracticeFacing } from '../study/practice-direction'
import { resolveBilingualSides } from '../study/practice-direction'
import { choiceCorrectIndex } from '../study/practice-session'
import type { PracticeItem } from '../study/study-types'
import { STUDY_TEST_IDS, studyInterfaceTexts } from './study-interface-texts'

type PracticeGrade = 'correct' | 'incorrect' | null

function optionClassName(
  optionIndex: number,
  correctIndex: number | null,
  chosenIndex: number | null,
  grade: PracticeGrade,
): string {
  if (grade !== 'incorrect') return 'practice-option'
  if (optionIndex === correctIndex) return 'practice-option is-correct'
  if (optionIndex === chosenIndex) return 'practice-option is-incorrect'
  return 'practice-option'
}

function SolutionLine(props: { readonly answer: string; readonly lang?: 'es' | 'en' }) {
  return (
    <p className="practice-solution" data-testid={STUDY_TEST_IDS.practiceSolution} role="alert">
      {studyInterfaceTexts.incorrectLabel}{' '}
      <em className="practice-solution-answer" lang={props.lang}>
        {props.answer}
      </em>
    </p>
  )
}

export function PracticeItemPane(props: {
  readonly item: PracticeItem
  readonly facing: PracticeFacing
  readonly revealed: boolean
  readonly grade: PracticeGrade
  readonly draft: string
  readonly onDraft: (value: string) => void
  readonly onReveal: () => void
  readonly onKnew: () => void
  readonly onDidnt: () => void
  readonly onChoose: (optionIndex: number) => void
  readonly onCheck: () => void
  readonly onNext: () => void
}) {
  const item = props.item
  const copy = studyInterfaceTexts
  if (item.kind === 'vocab') {
    const sides = resolveBilingualSides(item, props.facing)
    return (
      <VocabPane
        stimulus={sides.stimulus}
        expected={sides.expected}
        facing={props.facing}
        flipHint={props.facing === 'en-es' ? copy.flipHintToEs : copy.flipHint}
        revealed={props.revealed}
        onReveal={props.onReveal}
        onKnew={props.onKnew}
        onDidnt={props.onDidnt}
      />
    )
  }
  if (item.kind === 'completar') {
    return (
      <ChoicePane
        prompt={item.phrase}
        options={item.options}
        correctIndex={choiceCorrectIndex(item)}
        grade={props.grade}
        onChoose={props.onChoose}
        onNext={props.onNext}
      />
    )
  }
  if (item.kind === 'traducir') {
    const sides = resolveBilingualSides(item, props.facing)
    return (
      <WrittenPane
        prompt={props.facing === 'en-es' ? copy.translatePromptToEs : copy.translatePrompt}
        stimulus={sides.stimulus}
        expected={sides.expected}
        facing={props.facing}
        placeholder={
          props.facing === 'en-es' ? copy.translatePlaceholderToEs : copy.translatePlaceholder
        }
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
        correctIndex={choiceCorrectIndex(item)}
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
      placeholder={studyInterfaceTexts.translatePlaceholder}
      draft={props.draft}
      grade={props.grade}
      onDraft={props.onDraft}
      onCheck={props.onCheck}
      onNext={props.onNext}
    />
  )
}

function VocabPane(props: {
  readonly stimulus: string
  readonly expected: string
  readonly facing: PracticeFacing
  readonly flipHint: string
  readonly revealed: boolean
  readonly onReveal: () => void
  readonly onKnew: () => void
  readonly onDidnt: () => void
}) {
  const copy = studyInterfaceTexts
  const stimulusLang = props.facing === 'en-es' ? 'en' : 'es'
  const expectedLang = props.facing === 'en-es' ? 'es' : 'en'
  return (
    <div className="practice-pane">
      <button
        type="button"
        data-testid={STUDY_TEST_IDS.practiceCard}
        aria-pressed={props.revealed}
        className="practice-card"
        onClick={props.onReveal}
      >
        <p
          data-testid={STUDY_TEST_IDS.practiceCardFront}
          lang={stimulusLang}
          className={props.revealed ? 'hidden' : 'practice-stim-vocab'}
        >
          {props.stimulus}
        </p>
        <p
          data-testid={STUDY_TEST_IDS.practiceCardBack}
          lang={expectedLang}
          className={props.revealed ? 'practice-stim-vocab' : 'hidden'}
        >
          {props.expected}
        </p>
        {props.revealed ? null : <p className="practice-hint">{props.flipHint}</p>}
      </button>
      <div className="practice-actions">
        <button
          type="button"
          data-testid={STUDY_TEST_IDS.practiceKnew}
          className="btn primario"
          disabled={!props.revealed}
          onClick={props.onKnew}
        >
          {copy.knewLabel}
        </button>
        <button
          type="button"
          data-testid={STUDY_TEST_IDS.practiceDidnt}
          className="btn"
          disabled={!props.revealed}
          onClick={props.onDidnt}
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
  readonly correctIndex: number | null
  readonly grade: PracticeGrade
  readonly onChoose: (optionIndex: number) => void
  readonly onNext: () => void
}) {
  const copy = studyInterfaceTexts
  const [promptKey, setPromptKey] = useState(props.prompt)
  const [chosen, setChosen] = useState<number | null>(null)
  if (promptKey !== props.prompt) {
    setPromptKey(props.prompt)
    setChosen(null)
  }
  const locked = props.grade !== null
  const solution = props.correctIndex === null ? '' : (props.options[props.correctIndex] ?? '')
  return (
    <div className="practice-pane">
      <p className="practice-prompt">{props.prompt}</p>
      <div className="practice-options">
        {props.options.map((option, optionIndex) => (
          <button
            key={`${option}-${optionIndex}`}
            type="button"
            data-testid={STUDY_TEST_IDS.practiceOption}
            className={optionClassName(optionIndex, props.correctIndex, chosen, props.grade)}
            disabled={locked}
            onClick={() => {
              setChosen(optionIndex)
              props.onChoose(optionIndex)
            }}
          >
            {option}
          </button>
        ))}
      </div>
      {props.grade === 'incorrect' ? (
        <>
          <SolutionLine answer={solution} />
          <div className="practice-actions">
            <button
              type="button"
              data-testid={STUDY_TEST_IDS.practiceNext}
              className="btn primario"
              onClick={props.onNext}
            >
              {copy.nextItemLabel}
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}

function WrittenPane(props: {
  readonly prompt: string
  readonly stimulus: string
  readonly expected: string
  readonly facing?: PracticeFacing
  readonly placeholder: string
  readonly draft: string
  readonly grade: PracticeGrade
  readonly onDraft: (value: string) => void
  readonly onCheck: () => void
  readonly onNext: () => void
}) {
  const copy = studyInterfaceTexts
  const stimulusLang = props.facing === undefined ? undefined : props.facing === 'en-es' ? 'en' : 'es'
  const expectedLang = props.facing === undefined ? undefined : props.facing === 'en-es' ? 'es' : 'en'
  return (
    <div className="practice-pane">
      <p className="practice-consigna">{props.prompt}</p>
      <p className="practice-estimulo" lang={stimulusLang}>
        {props.stimulus}
      </p>
      <input
        data-testid={STUDY_TEST_IDS.practiceTranslateInput}
        className={props.grade === 'incorrect' ? 'practice-input is-incorrect' : 'practice-input'}
        value={props.draft}
        placeholder={props.placeholder}
        disabled={props.grade === 'incorrect'}
        onChange={(event) => props.onDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          if (props.grade === 'incorrect') props.onNext()
          else props.onCheck()
        }}
      />
      <div className="practice-actions">
        <button
          type="button"
          data-testid={STUDY_TEST_IDS.practiceCheck}
          className="btn primario"
          disabled={props.grade === 'incorrect'}
          onClick={props.onCheck}
        >
          {copy.checkLabel}
        </button>
        {props.grade === 'incorrect' ? (
          <button
            type="button"
            data-testid={STUDY_TEST_IDS.practiceNext}
            className="btn"
            onClick={props.onNext}
          >
            {copy.nextItemLabel}
          </button>
        ) : null}
      </div>
      {props.grade === 'incorrect' ? (
        <SolutionLine answer={props.expected} lang={expectedLang} />
      ) : null}
    </div>
  )
}
