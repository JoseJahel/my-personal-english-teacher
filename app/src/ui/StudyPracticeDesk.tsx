import { useEffect, useRef, useState } from 'react'
import {
  createStudyPracticeSrsStore,
  type StudyPracticeSrsStore,
} from '../storage/study-document-store'
import {
  isBilingualPracticeMode,
  PRACTICE_DIRECTIONS,
  resolveBilingualSides,
  type PracticeDirection,
  type PracticeFacing,
} from '../study/practice-direction'
import { itemsForMode } from '../study/practice-bank'
import {
  applyPracticeSrsResult,
  lookupPracticeSrsCard,
  pickNextPracticeIndex,
  srsItemId,
  type PracticeSrsCard,
} from '../study/practice-srs'
import {
  checkCompletarChoice,
  checkWrittenAnswer,
  createPracticeSession,
  currentPracticeIndex,
  goToNextPracticeItem,
  practiceAnswersMatch,
  rateVocabAndNext,
  revealPracticeItem,
  selectPracticeDirection,
  selectPracticeMode,
  selectPracticeTema,
} from '../study/practice-session'
import { PRACTICE_MODES, type PracticeBank, type PracticeItem, type PracticeMode } from '../study/study-types'
import { STUDY_TEST_IDS, labelForStudyTema, studyInterfaceTexts } from './study-interface-texts'
import { PracticeItemPane } from './study-practice-panes'

function choiceCorrectIndex(item: PracticeItem): number | null {
  if (item.kind === 'completar') return item.correctIndex
  if (item.kind !== 'transformar' || !item.options?.length) return null
  const index = item.options.indexOf(item.answer)
  return index >= 0 ? index : null
}

function writtenExpected(item: PracticeItem, facing: PracticeFacing): string | null {
  if (item.kind === 'traducir') return resolveBilingualSides(item, facing).expected
  if (item.kind === 'transformar') return item.answer
  return null
}

const DIRECTION_LABEL: Record<PracticeDirection, string> = {
  'es-en': studyInterfaceTexts.directionEsEnLabel,
  'en-es': studyInterfaceTexts.directionEnEsLabel,
  mixed: studyInterfaceTexts.directionMixedLabel,
}

const DIRECTION_TEST_ID: Record<PracticeDirection, string> = {
  'es-en': STUDY_TEST_IDS.practiceDirectionEsEn,
  'en-es': STUDY_TEST_IDS.practiceDirectionEnEs,
  mixed: STUDY_TEST_IDS.practiceDirectionMixed,
}

const MODE_LABEL: Record<PracticeMode, string> = {
  vocab: studyInterfaceTexts.modeVocabLabel,
  completar: studyInterfaceTexts.modeCompletarLabel,
  traducir: studyInterfaceTexts.modeTraducirLabel,
  transformar: studyInterfaceTexts.modeTransformarLabel,
}

function wallClockMs(nowMs?: () => number): number {
  return nowMs ? nowMs() : Date.now()
}

export function StudyPracticeDesk(props: {
  readonly bank: PracticeBank
  readonly tema: string | null
  readonly lessonTema: string | null
  readonly onTemaChange: (tema: string | null) => void
  readonly onBackToLesson: () => void
  readonly createSrsStore?: () => Promise<StudyPracticeSrsStore>
  readonly nowMs?: () => number
  readonly random?: () => number
}) {
  const copy = studyInterfaceTexts
  const [session, setSession] = useState(() => createPracticeSession('vocab', props.tema))
  const [draft, setDraft] = useState('')
  const [cardsById, setCardsById] = useState<Record<string, PracticeSrsCard>>({})
  const [ratedAtMs, setRatedAtMs] = useState(0)
  const storeRef = useRef<StudyPracticeSrsStore | null>(null)
  const itemKey = `${props.tema ?? ''}:${session.mode}:${session.index}:${session.facing}`
  const [draftKey, setDraftKey] = useState(itemKey)

  if (session.tema !== props.tema) {
    setSession(selectPracticeTema(session, props.tema))
  }
  if (draftKey !== itemKey) {
    setDraftKey(itemKey)
    setDraft('')
  }

  const items = itemsForMode(props.bank, session.mode, props.tema)
  const index = currentPracticeIndex(session, items.length)
  const item = items[index]
  const chipTema = props.lessonTema ?? props.tema
  const now = props.nowMs ? props.nowMs() : ratedAtMs
  const bilingual = isBilingualPracticeMode(session.mode)
  const srsFacing = bilingual ? session.facing : null

  useEffect(() => {
    let cancelled = false
    const createStore = props.createSrsStore ?? createStudyPracticeSrsStore
    createStore()
      .then(async (store) => {
        if (cancelled) {
          store.close()
          return
        }
        storeRef.current = store
        const cards = await store.getAllCards()
        if (cancelled) {
          return
        }
        const next: Record<string, PracticeSrsCard> = {}
        for (const card of cards) {
          next[card.itemId] = card
        }
        setCardsById(next)
      })
      .catch((error: unknown) => {
        console.warn('Practice SRS store unavailable.', error)
      })
    return () => {
      cancelled = true
      storeRef.current?.close()
      storeRef.current = null
    }
  }, [props.createSrsStore])

  const persistCard = (card: PracticeSrsCard) => {
    setCardsById((current) => ({ ...current, [card.itemId]: card }))
    const store = storeRef.current
    if (!store) {
      return
    }
    void store.putCard(card).catch((error: unknown) => {
      console.warn('Practice SRS persist failed.', error)
    })
  }

  const pickAfter = (map: Record<string, PracticeSrsCard>, currentIndex: number) =>
    pickNextPracticeIndex({
      items,
      cardsById: map,
      nowMs: now,
      currentIndex,
      facing: srsFacing,
      mixed: bilingual && session.direction === 'mixed',
      ...(props.random ? { random: props.random } : {}),
    })

  const goPicked = (map: Record<string, PracticeSrsCard>, currentIndex: number) =>
    pickAfter(map, currentIndex)

  const rateCurrent = (ok: boolean, advance: boolean) => {
    if (!item) {
      return
    }
    const tema = item.tema ?? props.tema
    const ratedAt = wallClockMs(props.nowMs)
    setRatedAtMs(ratedAt)
    const key = srsItemId(item.id, srsFacing)
    const existing = lookupPracticeSrsCard(cardsById, item.id, srsFacing) ?? null
    const card = applyPracticeSrsResult(existing, key, ok, ratedAt, tema)
    const map = { ...cardsById, [key]: card }
    persistCard(card)
    if (!advance) {
      return { map, nextIndex: index, facing: srsFacing }
    }
    const pick = goPicked(map, index)
    return { map, nextIndex: pick.index, facing: pick.facing }
  }

  const idle = session.grade === null && !session.revealed
  const shownCard = item ? lookupPracticeSrsCard(cardsById, item.id, srsFacing) : undefined
  const shownDue = (shownCard?.dueMs ?? 0) <= now
  const queued = pickAfter(cardsById, idle && !shownDue ? index : -1)
  const empty = items.length === 0
  const showCaughtUp = !empty && idle && queued.index < 0
  if (
    idle &&
    !empty &&
    queued.index >= 0 &&
    !shownDue &&
    (queued.index !== index || (queued.facing !== null && queued.facing !== session.facing))
  ) {
    setSession((current) =>
      goToNextPracticeItem(current, queued.index, props.random, queued.facing),
    )
  }

  return (
    <section className="practice-desk" data-testid={STUDY_TEST_IDS.practiceDesk}>
      <header className="practice-desk-header">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid={STUDY_TEST_IDS.practiceFilterTema}
            className="desk-chip"
            aria-pressed={props.tema !== null && props.tema === chipTema}
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
            className="desk-chip"
            aria-pressed={props.tema === null}
            onClick={() => props.onTemaChange(null)}
          >
            {copy.filterAllLabel}
          </button>
        </div>
        <button
          type="button"
          data-testid={STUDY_TEST_IDS.practiceBackLesson}
          className="btn"
          onClick={props.onBackToLesson}
        >
          {copy.backToLessonLabel}
        </button>
      </header>

      <div className="practice-desk-modes">
        {PRACTICE_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            data-testid={`study-practice-mode-${mode}`}
            aria-pressed={session.mode === mode}
            className="desk-chip"
            onClick={() => {
              setSession((current) => selectPracticeMode(current, mode))
            }}
          >
            {MODE_LABEL[mode]}
          </button>
        ))}
        {isBilingualPracticeMode(session.mode) ? (
          <div className="practice-direction" role="group" aria-label={copy.directionGroupLabel}>
            {PRACTICE_DIRECTIONS.map((direction) => (
              <button
                key={direction}
                type="button"
                data-testid={DIRECTION_TEST_ID[direction]}
                aria-pressed={session.direction === direction}
                className="desk-chip"
                onClick={() => {
                  setSession((current) =>
                    selectPracticeDirection(current, direction, props.random),
                  )
                }}
              >
                {DIRECTION_LABEL[direction]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="practice-desk-body">
        {empty ? (
          <div className="practice-empty" data-testid={STUDY_TEST_IDS.practiceEmpty}>
            <p className="m-0 font-serif text-xl text-ink-900">{copy.emptyModeLead}</p>
            <p className="mt-2 text-base text-ink-600">{copy.emptyModeHint}</p>
          </div>
        ) : null}
        {showCaughtUp ? (
          <div className="practice-empty" data-testid={STUDY_TEST_IDS.practiceEmpty}>
            <p className="m-0 font-serif text-xl text-ink-900">{copy.srsCaughtUpLead}</p>
            <p className="mt-2 text-base text-ink-600">{copy.srsCaughtUpHint}</p>
          </div>
        ) : null}
        {item && !empty && !showCaughtUp ? (
          <PracticeItemPane
            item={item}
            facing={session.facing}
            revealed={session.revealed}
            grade={session.grade}
            draft={draft}
            onDraft={setDraft}
            onReveal={() => setSession(revealPracticeItem)}
            onKnew={() => {
              const rated = rateCurrent(true, true)
              if (!rated) return
              setSession((current) =>
                rateVocabAndNext(current, rated.nextIndex, true, props.random, rated.facing),
              )
            }}
            onDidnt={() => {
              const rated = rateCurrent(false, true)
              if (!rated) return
              setSession((current) =>
                rateVocabAndNext(current, rated.nextIndex, false, props.random, rated.facing),
              )
            }}
            onChoose={(optionIndex) => {
              const correctIndex = item ? choiceCorrectIndex(item) : null
              if (correctIndex === null) return
              const ok = optionIndex === correctIndex
              const rated = rateCurrent(ok, ok)
              if (!rated) return
              setSession((current) =>
                checkCompletarChoice(
                  current,
                  optionIndex,
                  correctIndex,
                  rated.nextIndex,
                  props.random,
                  rated.facing,
                ),
              )
            }}
            onCheck={() => {
              const expected = item ? writtenExpected(item, session.facing) : null
              if (expected === null || draft.trim().length === 0) return
              const ok = practiceAnswersMatch(draft, expected)
              const rated = rateCurrent(ok, ok)
              if (!rated) return
              setSession((current) =>
                checkWrittenAnswer(
                  current,
                  draft,
                  expected,
                  rated.nextIndex,
                  props.random,
                  rated.facing,
                ),
              )
            }}
            onNext={() => {
              const pick = goPicked(cardsById, index)
              setSession((current) =>
                goToNextPracticeItem(current, pick.index, props.random, pick.facing),
              )
            }}
          />
        ) : null}
      </div>
    </section>
  )
}
