import { useEffect, useRef } from 'react'
import type { FormantTriple } from '../dsp/formant-estimation'
import type { PracticeTurnRecord } from '../storage/practice-session-types'
import {
  collectFormantMapHistory,
  drawFormantVowelMapOnCanvas,
  formantTripleToMapPoint,
} from './formant-vowel-map'
import { homeScreenInterfaceTexts } from './interface-texts'
import { PRACTICE_SHELL_TEST_IDS } from './practice-shell-types'

export function FormantVowelMap(props: {
  readonly current: FormantTriple | null
  readonly historyTurns: readonly PracticeTurnRecord[]
  readonly isReady: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const currentPoint = formantTripleToMapPoint(props.current)
  const history = collectFormantMapHistory(props.historyTurns)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    drawFormantVowelMapOnCanvas(canvas, { current: currentPoint, history })
  }, [currentPoint, history])

  return (
    <div>
      <p className="mb-1 text-[0.65rem] font-semibold tracking-wider text-ink-600 uppercase">
        {homeScreenInterfaceTexts.formantMapTitle}
      </p>
      <p className="mb-2 text-[0.72rem] leading-snug text-ink-400">
        {homeScreenInterfaceTexts.formantMapHint}
      </p>
      <canvas
        ref={canvasRef}
        data-testid={PRACTICE_SHELL_TEST_IDS.formantVowelMap}
        width={320}
        height={168}
        className={`h-[168px] w-full rounded-lg bg-sage-950 ${props.isReady ? '' : 'opacity-40'}`}
      />
      <p className="mt-1 font-mono text-[0.65rem] text-ink-400">
        {homeScreenInterfaceTexts.formantMapAxisF2} · {homeScreenInterfaceTexts.formantMapAxisF1}
      </p>
    </div>
  )
}
