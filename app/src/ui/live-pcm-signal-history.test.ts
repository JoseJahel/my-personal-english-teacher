import { describe, expect, it } from 'vitest'
import {
  appendLivePcmSignalColumn,
  createLivePcmSignalHistory,
  LIVE_SIGNAL_HISTORY_COLUMN_COUNT,
  liveHistoryToSpectrogram,
} from './live-pcm-signal-history'

describe('live PCM signal history', () => {
  it('caps the scrolling window and keeps pitch aligned with columns', () => {
    const history = createLivePcmSignalHistory()
    for (let index = 0; index < LIVE_SIGNAL_HISTORY_COLUMN_COUNT + 5; index += 1) {
      appendLivePcmSignalColumn(history, {
        logMagnitudeColumn: new Float32Array([index]),
        pitchFrequencyInHertz: index % 2 === 0 ? 180 : null,
        fftSize: 512,
        sampleRateInHertz: 16_000,
      })
    }
    expect(history.columns).toHaveLength(LIVE_SIGNAL_HISTORY_COLUMN_COUNT)
    expect(history.pitchFrames).toHaveLength(LIVE_SIGNAL_HISTORY_COLUMN_COUNT)
    const spectrogram = liveHistoryToSpectrogram(history)
    expect(spectrogram?.frames).toHaveLength(LIVE_SIGNAL_HISTORY_COLUMN_COUNT)
    expect(spectrogram?.binCount).toBe(1)
  })
})
