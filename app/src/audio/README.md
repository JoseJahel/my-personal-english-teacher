# audio/

Capa de **infraestructura de audio**: APIs del navegador (`getUserMedia`,
Web Audio, `MediaRecorder`). Solo captura y adaptación; sin React ni modelos.

## Captura actual (ver CAPTURE-INVARIANTS.md)

```
MediaStream track
  ├─ MediaStreamTrackProcessor → PCM en vivo → onda + nivel + backup ASR
  │    (fallback ScriptProcessor si no hay TrackProcessor)
  └─ MediaRecorder → blob → decode → ASR principal
```

La UI **no** usa `AnalyserNode` para la onda (daba una traza “viva” que no
seguía el mic). Onda y nivel leen el mismo PCM del track.

**No tocar sin leer `CAPTURE-INVARIANTS.md`.**

## Implementado

- `microphone-capture.ts`, `live-pcm-from-track.ts`, `media-recorder-utterance.ts`
- `capture-diagnostics.ts`, `choose-utterance.ts`, `microphone-capture-errors.ts`
- `normalize-peak.ts`, `mix-to-mono.ts`, `audio-resampler.ts`, `audio-frame-buffer.ts`

## Previsto

- `voice-activity-monitor.ts` (VAD con dominio en `dsp/`).
