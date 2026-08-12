/**
 * Fixed bottom composer: waveform, level, mic controls (Atelier shell).
 */

import type { RefObject } from 'react'
import { homeScreenInterfaceTexts } from './interface-texts'
import { PRACTICE_SHELL_TEST_IDS } from './practice-shell-types'

export interface PracticeComposerProps {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>
  readonly isStarting: boolean
  readonly isListening: boolean
  readonly isTutorSpeaking: boolean
  readonly isPreparingModels: boolean
  readonly liveInputLevel01: number
  readonly livePeak: number
  readonly activeMicrophoneLabel: string
  readonly primaryActivityMessage: string
  readonly onStartMicrophone: () => void
  readonly onStopMicrophone: () => void
}

export function PracticeComposer({
  canvasRef,
  isStarting,
  isListening,
  isTutorSpeaking,
  isPreparingModels,
  liveInputLevel01,
  livePeak,
  activeMicrophoneLabel,
  primaryActivityMessage,
  onStartMicrophone,
  onStopMicrophone,
}: PracticeComposerProps) {
  const levelPercent = Math.round(Math.min(1, Math.max(0, liveInputLevel01)) * 100)
  const isLevelSilentWhileListening = isListening && livePeak < 0.01
  const micDisabled = isStarting || isListening || isTutorSpeaking
  const micState = isListening ? 'listening' : isStarting || isPreparingModels ? 'processing' : 'idle'

  return (
    <footer
      className="flex shrink-0 flex-col items-center gap-1.5 border-t border-sage-200 bg-atelier-elev px-5 pt-2.5 pb-3.5"
      data-testid={PRACTICE_SHELL_TEST_IDS.composer}
    >
      <div className="w-full max-w-[44rem]">
        <canvas
          ref={canvasRef}
          width={720}
          height={36}
          className="block h-9 w-full rounded-lg border border-sage-200 bg-sage-50"
          aria-hidden={!isListening && !isStarting}
        />
        <div className="mt-1.5 h-0.5 overflow-hidden rounded-sm bg-sage-200">
          <div
            className={`h-full transition-[width] duration-75 ${
              isLevelSilentWhileListening ? 'bg-amber-400' : 'bg-sage-600'
            }`}
            style={{ width: `${isListening || isStarting ? levelPercent : 0}%` }}
          />
        </div>
      </div>

      <div className="flex w-full max-w-[44rem] items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm text-ink-600">
            {isTutorSpeaking
              ? homeScreenInterfaceTexts.tutorSpeakingHint
              : homeScreenInterfaceTexts.micHelperHint}
          </p>
          {isListening || isStarting ? (
            <p className="mt-0.5 text-[0.7rem] text-ink-400">
              {homeScreenInterfaceTexts.inputLevelLabel}: {levelPercent}%
              {isLevelSilentWhileListening
                ? ` · ${homeScreenInterfaceTexts.inputLevelHintSilentShort}`
                : ` · ${homeScreenInterfaceTexts.inputLevelHintActiveShort}`}
              {activeMicrophoneLabel
                ? ` · ${homeScreenInterfaceTexts.activeMicrophoneLabel(activeMicrophoneLabel)}`
                : ''}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            data-testid={PRACTICE_SHELL_TEST_IDS.stopButton}
            onClick={onStopMicrophone}
            disabled={!isListening}
            className="min-h-11 rounded-full border border-sage-200 bg-sage-50 px-4 py-2 text-sm font-semibold text-ink-600 transition hover:border-blush-500 hover:text-blush-600 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {homeScreenInterfaceTexts.stopMicrophoneButtonLabel}
          </button>
          <button
            type="button"
            data-testid={PRACTICE_SHELL_TEST_IDS.micButton}
            data-state={micState}
            onClick={onStartMicrophone}
            disabled={micDisabled}
            className={`min-h-11 min-w-[7.5rem] rounded-full px-5 py-2.5 text-[0.92rem] font-semibold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-45 ${
              isListening
                ? 'bg-blush-600 shadow-blush-500/30 hover:bg-blush-500'
                : 'bg-sage-600 shadow-sage-600/30 hover:bg-sage-700'
            }`}
          >
            {isListening
              ? homeScreenInterfaceTexts.listeningButtonLabel
              : homeScreenInterfaceTexts.startMicrophoneButtonLabel}
          </button>
        </div>
      </div>

      <p className="m-0 w-full max-w-[44rem] text-right text-[0.7rem] text-ink-400">
        {primaryActivityMessage}
      </p>
    </footer>
  )
}
