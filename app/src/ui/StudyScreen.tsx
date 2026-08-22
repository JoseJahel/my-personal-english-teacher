import { useMemo, useRef, useState } from 'react'
import { bookmarkIndex, bookmarkNeedsMoveConfirm, isBookmarkOnSection } from '../study/study-bookmark'
import { buildPracticeBank } from '../study/practice-bank'
import type { StudyBookmark, StudySection } from '../study/study-types'
import { LessonMarkdown } from './LessonMarkdown'
import { BookmarkDialog, BookmarkRibbon, type BookmarkDialogKind } from './study-bookmark-controls'
import { StudyCatalog } from './study-catalog-pane'
import { StudyPracticeDesk } from './StudyPracticeDesk'
import { STUDY_TEST_IDS, studyInterfaceTexts } from './study-interface-texts'
import './study-notebook.css'
import { useStudySession, type UseStudySessionOptions } from './use-study-session'

type StudyPaneView = 'catalog' | 'reader' | 'practice'

export function StudyScreen(
  props: { readonly sessionOptions?: UseStudySessionOptions; readonly embedded?: boolean } = {},
) {
  const copy = studyInterfaceTexts
  const study = useStudySession(props.sessionOptions)
  const document = study.document
  const active = study.activeSection
  const activeIndex = study.session?.activeSectionIndex ?? 0
  const [view, setView] = useState<StudyPaneView>('catalog')
  const [practiceTema, setPracticeTema] = useState<string | null>(null)
  const [dialog, setDialog] = useState<BookmarkDialogKind | null>(null)
  const moveDialogRef = useRef<(confirmed: boolean) => void>(undefined)

  const completedSectionIds = useMemo(
    () => new Set(study.session?.completedSectionIds ?? []),
    [study.session?.completedSectionIds],
  )

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

  const openCatalog = () => setView('catalog')
  const openLesson = (index: number) => {
    study.selectSectionIndex(index)
    setView('reader')
  }
  const openPractice = (tema: string | undefined) => {
    setPracticeTema(tema ?? null)
    setView('practice')
  }

  const continueIndex = document ? bookmarkIndex(document.sections, study.bookmark) : -1
  const continueSection = continueIndex >= 0 ? (document?.sections[continueIndex] ?? null) : null

  const openContinue = () => {
    if (continueIndex < 0) {
      setDialog('orphan')
      return
    }
    openLesson(continueIndex)
  }

  return (
    <div className="study-notebook flex h-full min-h-0 flex-col overflow-hidden" data-testid={STUDY_TEST_IDS.screen}>
      <header className="study-notebook-header">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1>{copy.screenTitle}</h1>
            {document ? <p className="catalog-kicker">{copy.catalogTitle}</p> : null}
          </div>
          <div className="header-right">
            <span
              className={study.storageWarning ? 'sync off' : 'sync on'}
              data-testid={STUDY_TEST_IDS.saveChip}
              title={study.storageWarning ?? copy.saveChipOn}
            >
              {study.storageWarning ? copy.saveChipOff : copy.saveChipOn}
            </span>
            <div
              className="view-switch"
              role="group"
              aria-label={copy.viewSwitchLabel}
              data-testid={STUDY_TEST_IDS.viewSwitch}
            >
              <button
                type="button"
                data-testid={STUDY_TEST_IDS.deskLesson}
                aria-pressed={view !== 'practice'}
                className="view-switch-item"
                onClick={openCatalog}
              >
                {copy.deskLessonLabel}
              </button>
              <button
                type="button"
                data-testid={STUDY_TEST_IDS.deskPractice}
                aria-pressed={view === 'practice'}
                className="view-switch-item"
                onClick={() => openPractice(active?.tema)}
              >
                {copy.deskPracticeLabel}
              </button>
            </div>
            {props.embedded ? null : (
              <button
                type="button"
                className="btn chico"
                onClick={() => {
                  window.location.hash = ''
                }}
              >
                {copy.backToPracticeLabel}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className={view === 'practice' ? 'study-notebook-pane is-practice' : 'study-notebook-pane'}>
        {study.status === 'loading' ? <p className="nota-info px-4">{copy.loadingMessage}</p> : null}
        {study.storageWarning ? <p className="nota-info px-4">{study.storageWarning}</p> : null}

        {study.status === 'empty' ? (
          <div className="study-notebook-column">
            <div className="sheet">
              <h2>{copy.emptyLead}</h2>
              <p className="nota-info">{copy.emptyHint}</p>
            </div>
          </div>
        ) : null}

        {document && view === 'catalog' ? (
          <StudyCatalog
            sections={document.sections}
            bookmark={study.bookmark}
            completedSectionIds={completedSectionIds}
            continueSection={continueSection}
            continueOrphan={Boolean(study.bookmark) && continueIndex < 0}
            onContinue={openContinue}
            onSelect={openLesson}
          />
        ) : null}

        {document && active && view === 'reader' ? (
          <StudySectionReader
            section={active}
            lessonNumber={activeIndex + 1}
            total={document.sections.length}
            progressDone={Math.round(study.progress01 * document.sections.length)}
            bookmark={study.bookmark}
            canGoNext={study.canGoNext}
            canGoPrevious={study.canGoPrevious}
            onBackToCatalog={openCatalog}
            onNext={study.goNext}
            onPrevious={study.goPrevious}
            onPractice={() => openPractice(active.tema)}
            onPlant={study.plantBookmark}
            onClear={study.clearBookmark}
            onAskMove={() =>
              new Promise<boolean>((resolve) => {
                moveDialogRef.current = resolve
                setDialog('move')
              })
            }
          />
        ) : null}

        {document && view === 'practice' ? (
          <div className="study-notebook-column practice-fill">
            <StudyPracticeDesk
              bank={bank}
              tema={practiceTema}
              lessonTema={active?.tema ?? null}
              onTemaChange={setPracticeTema}
              onBackToLesson={() => setView('reader')}
            />
          </div>
        ) : null}
      </div>

      {dialog ? (
        <BookmarkDialog
          kind={dialog}
          currentTitle={study.bookmark?.title ?? ''}
          onConfirm={() => {
            setDialog(null)
            if (dialog === 'move') {
              moveDialogRef.current?.(true)
              moveDialogRef.current = undefined
            }
          }}
          onCancel={() => {
            setDialog(null)
            moveDialogRef.current?.(false)
            moveDialogRef.current = undefined
          }}
        />
      ) : null}
    </div>
  )
}

function StudySectionReader(props: {
  readonly section: StudySection
  readonly lessonNumber: number
  readonly total: number
  readonly progressDone: number
  readonly bookmark: StudyBookmark | null
  readonly canGoNext: boolean
  readonly canGoPrevious: boolean
  readonly onBackToCatalog: () => void
  readonly onNext: () => void
  readonly onPrevious: () => void
  readonly onPractice: () => void
  readonly onPlant: () => void
  readonly onClear: () => void
  readonly onAskMove: () => Promise<boolean>
}) {
  const copy = studyInterfaceTexts
  return (
    <div className="study-notebook-column">
      <LessonNav
        lessonNumber={props.lessonNumber}
        total={props.total}
        progressDone={props.progressDone}
        progressTotal={props.total}
        canGoNext={props.canGoNext}
        canGoPrevious={props.canGoPrevious}
        onBackToCatalog={props.onBackToCatalog}
        onNext={props.onNext}
        onPrevious={props.onPrevious}
        onPractice={props.onPractice}
      />
      <article className="sheet sheet-con-marcapaginas">
        <BookmarkRibbon
          key={props.section.id}
          planted={isBookmarkOnSection(props.bookmark, props.section.id)}
          needsMoveConfirm={bookmarkNeedsMoveConfirm(props.bookmark, props.section.id)}
          onPlant={props.onPlant}
          onClear={props.onClear}
          onAskMove={props.onAskMove}
        />
        <p className="lesson-meta">
          <span data-testid={STUDY_TEST_IDS.lessonTag}>{copy.lessonTag(props.lessonNumber)}</span>
          {props.section.bloqueEs ? <span> · {props.section.bloqueEs}</span> : null}
        </p>
        <h2 data-testid={STUDY_TEST_IDS.sectionTitle}>{props.section.title}</h2>
        {props.section.titleEn ? <p className="titulo-en">{props.section.titleEn}</p> : null}
        {props.section.objetivo ? (
          <p className="nota-info" data-testid={STUDY_TEST_IDS.studyObjetivo}>
            <b>{copy.studyLabel}</b> {props.section.objetivo}
          </p>
        ) : null}
        <div className="reader-body" data-testid={STUDY_TEST_IDS.sectionBody}>
          <LessonMarkdown source={props.section.bodyText} />
        </div>
      </article>
    </div>
  )
}

function LessonNav(props: {
  readonly lessonNumber: number
  readonly total: number
  readonly progressDone: number
  readonly progressTotal: number
  readonly canGoNext: boolean
  readonly canGoPrevious: boolean
  readonly onBackToCatalog: () => void
  readonly onNext: () => void
  readonly onPrevious: () => void
  readonly onPractice: () => void
}) {
  const copy = studyInterfaceTexts
  const progressPercent =
    props.progressTotal === 0 ? 0 : Math.round((props.progressDone / props.progressTotal) * 100)
  return (
    <div className="lec-nav" data-testid={STUDY_TEST_IDS.lessonNav}>
      <div className="lec-nav-row">
        <button type="button" className="btn chico" data-testid={STUDY_TEST_IDS.backToCatalog} onClick={props.onBackToCatalog}>
          ☰ {copy.catalogButton}
        </button>
        <button
          type="button"
          className="btn chico"
          data-testid={STUDY_TEST_IDS.previous}
          disabled={!props.canGoPrevious}
          onClick={props.onPrevious}
        >
          ← {copy.previousLabel}
        </button>
        <button
          type="button"
          className="btn chico"
          data-testid={STUDY_TEST_IDS.next}
          disabled={!props.canGoNext}
          onClick={props.onNext}
        >
          {copy.nextLabel} →
        </button>
        <button type="button" className="btn primario" data-testid={STUDY_TEST_IDS.practiceCta} onClick={props.onPractice}>
          {copy.practiceCtaLabel}
        </button>
        <span className="pos">{copy.lessonPosition(props.lessonNumber, props.total)}</span>
      </div>
      <div className="lec-progress">
        <span className="lec-progress-label">
          {copy.progressLabel} · {copy.progressValue(props.progressDone, props.progressTotal)}
        </span>
        <span
          className="lec-progress-track"
          role="progressbar"
          aria-label={copy.progressLabel}
          aria-valuemin={0}
          aria-valuemax={props.progressTotal}
          aria-valuenow={props.progressDone}
          data-testid={STUDY_TEST_IDS.progress}
        >
          <span className="lec-progress-fill" style={{ width: `${progressPercent}%` }} />
        </span>
      </div>
    </div>
  )
}
