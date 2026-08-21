import { useState } from 'react'
import { continueBookmarkLabel } from '../study/study-bookmark'
import { groupStudyBlocks, type StudyIndexGroup, type StudyIndexItem } from '../study/group-study-blocks'
import type { StudyBookmark, StudySection } from '../study/study-types'
import { STUDY_TEST_IDS, studyInterfaceTexts } from './study-interface-texts'

export function StudyCatalog(props: {
  readonly sections: readonly StudySection[]
  readonly bookmark: StudyBookmark | null
  readonly continueSection: StudySection | null
  readonly continueOrphan: boolean
  readonly onContinue: () => void
  readonly onSelect: (index: number) => void
}) {
  const copy = studyInterfaceTexts
  const [query, setQuery] = useState('')
  const groups = groupsForQuery(props.sections, query)
  const noMatches = query.trim().length > 0 && groups.length === 0

  return (
    <div className="study-notebook-column" data-testid={STUDY_TEST_IDS.catalog}>
      <div className="sheet">
        <h2>{copy.indexTitle}</h2>
        <p className="nota-info">{copy.indexHint}</p>
        {props.continueOrphan ? <p className="nota-info">{copy.continueOrphanNote}</p> : null}
        {props.continueSection ? (
          <ContinueCta
            section={props.continueSection}
            bookmark={props.bookmark}
            onContinue={props.onContinue}
          />
        ) : null}
        <input
          className="buscador"
          data-testid={STUDY_TEST_IDS.search}
          value={query}
          placeholder={copy.searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="indice-lista" data-testid={STUDY_TEST_IDS.syllabus} aria-label={copy.syllabusTitle}>
          {groups.map((group) => (
            <CatalogGroup key={groupKey(group)} group={group} onSelect={props.onSelect} />
          ))}
          {noMatches ? <p className="nota-info">{copy.searchEmpty}</p> : null}
        </div>
      </div>
    </div>
  )
}

function sectionMatchesQuery(section: StudySection, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) {
    return true
  }
  const haystack = [section.title, section.titleEn, section.objetivo, section.bloque, section.bloqueEs]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

function groupsForQuery(sections: readonly StudySection[], query: string): readonly StudyIndexGroup[] {
  const visible = sections
    .map((section, index) => ({ section, index }))
    .filter((item) => sectionMatchesQuery(item.section, query))
  return groupStudyBlocks(visible.map((item) => item.section)).map((group) => remapGroupIndexes(group, visible))
}

function remapGroupIndexes(
  group: StudyIndexGroup,
  visible: readonly { readonly section: StudySection; readonly index: number }[],
): StudyIndexGroup {
  const items = group.items.map((item) => ({
    section: item.section,
    index: visible[item.index]?.index ?? item.index,
  }))
  return group.type === 'block'
    ? { type: 'block', bloque: group.bloque, bloqueEs: group.bloqueEs, items }
    : { type: 'loose', items }
}

function ContinueCta(props: {
  readonly section: StudySection
  readonly bookmark: StudyBookmark | null
  readonly onContinue: () => void
}) {
  const copy = studyInterfaceTexts
  return (
    <button
      type="button"
      className="indice-continuar"
      data-testid={STUDY_TEST_IDS.continue}
      aria-label={continueBookmarkLabel(props.bookmark, copy.continueTitle)}
      onClick={props.onContinue}
    >
      <span className="indice-continuar-icono" aria-hidden="true">
        <span className="mp-cinta-mini" />
      </span>
      <span className="indice-continuar-texto">
        <span className="indice-continuar-titulo">{copy.continueTitle}</span>
        <span className="indice-continuar-sub">
          <span className="titulo-es">{props.section.title}</span>
          {props.section.titleEn ? ` ${props.section.titleEn}` : ''}
        </span>
      </span>
      <span className="indice-continuar-ir">{copy.continueOpen}</span>
    </button>
  )
}

function groupKey(group: StudyIndexGroup): string {
  const first = group.items[0]?.index ?? 0
  return group.type === 'block' ? `block-${group.bloque}-${first}` : `loose-${first}`
}

function CatalogGroup(props: {
  readonly group: StudyIndexGroup
  readonly onSelect: (index: number) => void
}) {
  const copy = studyInterfaceTexts
  const rows = props.group.items.map((item) => (
    <CatalogLessonRow
      key={item.section.id}
      item={item}
      nested={props.group.type === 'block'}
      onSelect={props.onSelect}
    />
  ))
  if (props.group.type === 'loose') {
    return rows
  }
  return (
    <section className="indice-bloque" data-testid={STUDY_TEST_IDS.syllabusBlock}>
      <header className="indice-bloque-cab">
        <span className="indice-bloque-marca" aria-hidden="true" />
        <span className="indice-bloque-titulo">{props.group.bloqueEs}</span>
        <span className="indice-bloque-meta">{copy.blockMeta(props.group.items.length)}</span>
      </header>
      <div className="indice-bloque-cuerpo">{rows}</div>
    </section>
  )
}

function CatalogLessonRow(props: {
  readonly item: StudyIndexItem
  readonly nested: boolean
  readonly onSelect: (index: number) => void
}) {
  const copy = studyInterfaceTexts
  const section = props.item.section
  return (
    <button
      type="button"
      className={props.nested ? 'indice-fila indice-fila-sub' : 'indice-fila'}
      onClick={() => props.onSelect(props.item.index)}
    >
      <span className="indice-num">{props.item.index + 1}</span>
      <span className="indice-titulo">
        <span className="titulo-es">{section.title}</span>
        {section.titleEn ? <span className="titulo-en">{section.titleEn}</span> : null}
        {section.objetivo ? <span className="indice-objetivo">{section.objetivo}</span> : null}
      </span>
      <span className="indice-abrir">{copy.openLesson}</span>
    </button>
  )
}
