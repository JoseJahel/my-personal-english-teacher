import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { groupStudyBlocks, type StudyIndexGroup, type StudyIndexItem } from '../study/group-study-blocks'
import { buildPracticeBank } from '../study/practice-bank'
import type { StudySection } from '../study/study-types'
import { LessonMarkdown } from './LessonMarkdown'
import { StudyPracticeDesk } from './StudyPracticeDesk'
import { STUDY_TEST_IDS, studyInterfaceTexts } from './study-interface-texts'
import { useStudySession, type UseStudySessionOptions } from './use-study-session'

export function StudyScreen(
  props: { readonly sessionOptions?: UseStudySessionOptions; readonly embedded?: boolean } = {},
) {
  const copy = studyInterfaceTexts
  const study = useStudySession(props.sessionOptions)
  const document = study.document
  const active = study.activeSection
  const sectionCount = document?.sections.length ?? 0
  const completedCount = study.session?.completedSectionIds.length ?? 0
  const progressPercent = Math.round(study.progress01 * 100)
  const [desk, setDesk] = useState<'lesson' | 'practice'>('lesson')
  const [practiceTema, setPracticeTema] = useState<string | null>(null)

  const bank = useMemo(
    () =>
      buildPracticeBank(
        (document?.sections ?? []).map((section) => ({
          id: section.id,
          bodyMarkdown: section.bodyText,
          ...(section.tema !== undefined ? { tema: section.tema } : {}),
        })),
      ),
    [document],
  )

  const openPractice = (tema: string | undefined) => {
    setPracticeTema(tema ?? null)
    setDesk('practice')
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-sage-50 font-sans text-ink-900"
      data-testid={STUDY_TEST_IDS.screen}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-sage-200 bg-atelier-elev px-5 py-3">
        <div>
          <h1 className="m-0 font-serif text-2xl text-ink-900">{copy.screenTitle}</h1>
          {document ? <p className="mt-0.5 text-sm text-ink-600">{copy.catalogTitle}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid={STUDY_TEST_IDS.deskLesson}
              aria-pressed={desk === 'lesson'}
              className={deskChipClass(desk === 'lesson')}
              onClick={() => setDesk('lesson')}
            >
              {copy.deskLessonLabel}
            </button>
            <button
              type="button"
              data-testid={STUDY_TEST_IDS.deskPractice}
              aria-pressed={desk === 'practice'}
              className={deskChipClass(desk === 'practice')}
              onClick={() => openPractice(active?.tema)}
            >
              {copy.deskPracticeLabel}
            </button>
          </div>
        </div>
        {props.embedded ? null : (
          <button
            type="button"
            className="rounded-lg border border-sage-200 bg-sage-50 px-3 py-1.5 text-sm font-semibold text-ink-600 hover:border-sage-600"
            onClick={() => {
              window.location.hash = ''
            }}
          >
            {copy.backToPracticeLabel}
          </button>
        )}
      </header>

      <div className="mx-auto flex min-h-0 w-full min-w-0 max-w-6xl flex-1 flex-col gap-3 overflow-hidden px-3 py-3 lg:px-4">
        {study.status === 'loading' ? (
          <p className="m-0 text-sm text-ink-600">{copy.loadingMessage}</p>
        ) : null}
        {study.storageWarning ? (
          <p className="m-0 text-sm text-ink-600">{study.storageWarning}</p>
        ) : null}

        {study.status === 'empty' ? (
          <div className="rounded-2xl bg-atelier-elev p-6 shadow-sm ring-1 ring-sage-200">
            <p className="m-0 font-serif text-xl text-ink-900">{copy.emptyLead}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{copy.emptyHint}</p>
          </div>
        ) : null}

        {document && active && desk === 'lesson' ? (
          <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[15rem_minmax(0,1fr)]">
            <StudySyllabusList
              sections={document.sections}
              activeSectionIndex={study.session?.activeSectionIndex ?? 0}
              completedSectionIds={study.session?.completedSectionIds ?? []}
              onSelect={(index) => {
                study.selectSectionIndex(index)
                setDesk('lesson')
              }}
            />
            <StudySectionReader
              section={active}
              canGoNext={study.canGoNext}
              canGoPrevious={study.canGoPrevious}
              progressPercent={progressPercent}
              progressLabel={copy.progressValue(completedCount, sectionCount)}
              onNext={study.goNext}
              onPrevious={study.goPrevious}
              onPractice={() => openPractice(active.tema)}
            />
          </div>
        ) : null}

        {document && desk === 'practice' ? (
          <StudyPracticeDesk
            bank={bank}
            tema={practiceTema}
            lessonTema={active?.tema ?? null}
            onTemaChange={setPracticeTema}
            onBackToLesson={() => setDesk('lesson')}
          />
        ) : null}
      </div>
    </div>
  )
}

function deskChipClass(active: boolean): string {
  return active
    ? 'rounded-lg bg-sage-100 px-3 py-1.5 text-sm font-semibold text-ink-900 ring-1 ring-sage-600'
    : 'rounded-lg border border-sage-200 bg-sage-50 px-3 py-1.5 text-sm font-semibold text-ink-600 hover:border-sage-600'
}

function StudySyllabusList(props: {
  readonly sections: readonly StudySection[]
  readonly activeSectionIndex: number
  readonly completedSectionIds: readonly string[]
  readonly onSelect: (index: number) => void
}) {
  const copy = studyInterfaceTexts
  const activeButtonRef = useRef<HTMLButtonElement | null>(null)
  const groups = groupStudyBlocks(props.sections)

  useEffect(() => {
    const node = activeButtonRef.current
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' })
    }
  }, [props.activeSectionIndex])

  return (
    <nav
      className="flex max-h-40 min-h-0 flex-col overflow-hidden rounded-2xl bg-atelier-elev p-3 shadow-sm ring-1 ring-sage-200 lg:max-h-none"
      data-testid={STUDY_TEST_IDS.syllabus}
      aria-label={copy.syllabusTitle}
    >
      <h2 className="m-0 shrink-0 px-2 font-serif text-lg text-ink-900">{copy.syllabusTitle}</h2>
      <ol className="mt-2 min-h-0 list-none space-y-2 overflow-y-auto p-0">
        {groups.map((group) => (
          <SyllabusGroup
            key={groupKey(group)}
            group={group}
            activeSectionIndex={props.activeSectionIndex}
            completedSectionIds={props.completedSectionIds}
            activeButtonRef={activeButtonRef}
            onSelect={props.onSelect}
          />
        ))}
      </ol>
    </nav>
  )
}

function groupKey(group: StudyIndexGroup): string {
  const first = group.items[0]?.index ?? 0
  return group.type === 'block' ? `block-${group.bloque}-${first}` : `loose-${first}`
}

function SyllabusGroup(props: {
  readonly group: StudyIndexGroup
  readonly activeSectionIndex: number
  readonly completedSectionIds: readonly string[]
  readonly activeButtonRef: RefObject<HTMLButtonElement | null>
  readonly onSelect: (index: number) => void
}) {
  const copy = studyInterfaceTexts
  const rows = props.group.items.map((item) => (
    <SyllabusLessonRow
      key={item.section.id}
      item={item}
      isActive={item.index === props.activeSectionIndex}
      done={props.completedSectionIds.includes(item.section.id)}
      activeButtonRef={props.activeButtonRef}
      onSelect={props.onSelect}
    />
  ))
  if (props.group.type === 'loose') {
    return rows
  }
  return (
    <li
      className="rounded-xl bg-sage-50 p-2 ring-1 ring-sage-200"
      data-testid={STUDY_TEST_IDS.syllabusBlock}
    >
      <p className="m-0 px-1 text-xs font-semibold uppercase tracking-wide text-ink-600">
        {props.group.bloqueEs}
      </p>
      <p className="m-0 px-1 text-[11px] text-ink-600">{copy.blockMeta(props.group.items.length)}</p>
      <ol className="mt-1 list-none space-y-1 p-0">{rows}</ol>
    </li>
  )
}

function SyllabusLessonRow(props: {
  readonly item: StudyIndexItem
  readonly isActive: boolean
  readonly done: boolean
  readonly activeButtonRef: RefObject<HTMLButtonElement | null>
  readonly onSelect: (index: number) => void
}) {
  return (
    <li>
      <button
        ref={props.isActive ? props.activeButtonRef : undefined}
        type="button"
        aria-current={props.isActive ? 'true' : undefined}
        className={`flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${
          props.isActive
            ? 'bg-sage-100 font-semibold text-ink-900 ring-1 ring-sage-600'
            : 'text-ink-600 hover:bg-sage-50'
        }`}
        onClick={() => props.onSelect(props.item.index)}
      >
        <span>{props.item.section.title}</span>
        {props.done ? (
          <span className="shrink-0 text-sage-600" aria-hidden>
            ✓
          </span>
        ) : null}
      </button>
    </li>
  )
}

function StudySectionReader(props: {
  readonly section: StudySection
  readonly canGoNext: boolean
  readonly canGoPrevious: boolean
  readonly progressPercent: number
  readonly progressLabel: string
  readonly onNext: () => void
  readonly onPrevious: () => void
  readonly onPractice: () => void
}) {
  const copy = studyInterfaceTexts
  return (
    <article className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-atelier-elev shadow-sm ring-1 ring-sage-200">
      <header className="shrink-0 border-b border-sage-200 px-5 py-3">
        <h2
          className="m-0 font-serif text-2xl text-ink-900"
          data-testid={STUDY_TEST_IDS.sectionTitle}
        >
          {props.section.title}
        </h2>
        {props.section.titleEn ? (
          <p className="mt-1 text-sm text-ink-600">{props.section.titleEn}</p>
        ) : null}
      </header>
      <div
        key={props.section.id}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        data-testid={STUDY_TEST_IDS.sectionBody}
      >
        <LessonMarkdown source={props.section.bodyText} />
      </div>
      <footer className="shrink-0 border-t border-sage-200 px-5 py-3">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-ink-600">
          {copy.progressLabel} · {props.progressLabel}
        </p>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-sage-200"
          data-testid={STUDY_TEST_IDS.progress}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={props.progressPercent}
        >
          <div
            className="h-full rounded-full bg-sage-600"
            style={{ width: `${props.progressPercent}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid={STUDY_TEST_IDS.previous}
            className="rounded-lg border border-sage-200 bg-sage-50 px-4 py-2 text-sm font-semibold text-ink-600 hover:border-sage-600 disabled:opacity-40"
            disabled={!props.canGoPrevious}
            onClick={props.onPrevious}
          >
            {copy.previousLabel}
          </button>
          <button
            type="button"
            data-testid={STUDY_TEST_IDS.next}
            className="rounded-lg bg-sage-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sage-700 disabled:opacity-40"
            disabled={!props.canGoNext}
            onClick={props.onNext}
          >
            {copy.nextLabel}
          </button>
          <button
            type="button"
            data-testid={STUDY_TEST_IDS.practiceCta}
            className="rounded-lg border border-sage-600 bg-sage-50 px-4 py-2 text-sm font-semibold text-sage-700 hover:bg-sage-100"
            onClick={props.onPractice}
          >
            {copy.practiceCtaLabel}
          </button>
        </div>
      </footer>
    </article>
  )
}
