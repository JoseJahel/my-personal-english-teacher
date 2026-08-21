import { useEffect, useRef, useState } from 'react'
import {
  BOOKMARK_PLANT_LOCK_MS,
  BOOKMARK_RETRACT_LOCK_MS,
  prefersReducedMotion,
} from '../study/study-bookmark'
import { STUDY_TEST_IDS, studyInterfaceTexts } from './study-interface-texts'

export type BookmarkDialogKind = 'move' | 'orphan'

export function BookmarkRibbon(props: {
  readonly planted: boolean
  readonly needsMoveConfirm: boolean
  readonly onPlant: () => void
  readonly onClear: () => void
  readonly onAskMove: () => Promise<boolean>
}) {
  const copy = studyInterfaceTexts
  const lockRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [visualPlanted, setVisualPlanted] = useState(props.planted)
  const [motion, setMotion] = useState<'idle' | 'planting' | 'retracting'>('idle')

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    },
    [],
  )

  const runMotion = (plant: boolean) => {
    if (prefersReducedMotion()) {
      setVisualPlanted(plant)
      setMotion('idle')
      lockRef.current = false
      return
    }
    lockRef.current = true
    setVisualPlanted(true)
    setMotion(plant ? 'planting' : 'retracting')
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(
      () => {
        if (!plant) {
          setVisualPlanted(false)
        }
        setMotion('idle')
        lockRef.current = false
        timerRef.current = null
      },
      plant ? BOOKMARK_PLANT_LOCK_MS : BOOKMARK_RETRACT_LOCK_MS,
    )
  }

  const className = [
    'marcapaginas',
    visualPlanted ? 'marcapaginas-plantado' : '',
    motion === 'planting' ? 'marcapaginas-animando' : '',
    motion === 'retracting' ? 'marcapaginas-retrayendo' : '',
  ]
    .filter((part) => part.length > 0)
    .join(' ')
  const pressed = props.planted
  const label = pressed ? copy.bookmarkRemoveLabel : copy.bookmarkPlantLabel

  return (
    <div className="mp-ancla">
      <button
        type="button"
        className={className}
        data-testid={STUDY_TEST_IDS.bookmark}
        aria-pressed={pressed}
        aria-label={label}
        title={label}
        onClick={() => {
          void (async () => {
            if (lockRef.current) {
              return
            }
            if (pressed) {
              props.onClear()
              runMotion(false)
              return
            }
            if (props.needsMoveConfirm) {
              const confirmed = await props.onAskMove()
              if (!confirmed || lockRef.current) {
                return
              }
            }
            props.onPlant()
            runMotion(true)
          })()
        }}
      >
        <span className="mp-cinta" aria-hidden="true" />
      </button>
    </div>
  )
}

export function BookmarkDialog(props: {
  readonly kind: BookmarkDialogKind
  readonly currentTitle: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
}) {
  const copy = studyInterfaceTexts
  const okRef = useRef<HTMLButtonElement>(null)
  const soloOk = props.kind === 'orphan'
  const onCancel = props.onCancel

  useEffect(() => {
    okRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="dialogo-capa"
      data-testid={STUDY_TEST_IDS.bookmarkDialog}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onCancel()
        }
      }}
    >
      <div className={soloOk ? 'dialogo-caja dialogo-solo-ok' : 'dialogo-caja'} role="dialog" aria-modal="true">
        <span className="dialogo-cinta" aria-hidden="true" />
        <h2 className="dialogo-titulo">{soloOk ? copy.bookmarkOrphanTitle : copy.bookmarkMoveTitle}</h2>
        <p className="dialogo-cuerpo">{soloOk ? copy.bookmarkOrphanBody : copy.bookmarkMoveBody}</p>
        {soloOk ? null : (
          <p className="dialogo-detalle">
            <strong>{copy.bookmarkCurrentLabel}</strong>
            {props.currentTitle}
          </p>
        )}
        <div className="dialogo-acciones">
          {soloOk ? null : (
            <button type="button" className="btn" data-testid={STUDY_TEST_IDS.bookmarkCancel} onClick={onCancel}>
              {copy.bookmarkMoveCancel}
            </button>
          )}
          <button
            ref={okRef}
            type="button"
            className="btn primario"
            data-testid={STUDY_TEST_IDS.bookmarkConfirm}
            onClick={props.onConfirm}
          >
            {soloOk ? copy.bookmarkOrphanOk : copy.bookmarkMoveConfirm}
          </button>
        </div>
      </div>
    </div>
  )
}
