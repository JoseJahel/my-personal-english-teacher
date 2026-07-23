# audio/

Capa de **infraestructura de audio**: APIs del navegador (`getUserMedia`,
Web Audio, `MediaRecorder`). Solo captura y adaptación; sin React ni modelos.

## Captura actual (ver CAPTURE-INVARIANTS.md)

```
openRealMicrophoneStream()  → MediaStream real del SO
  ├─ MediaStreamSource → Analyser → Gain(0) → destination
  │    (onda + RMS/peak en vivo vía AnalyserNode)
  └─ MediaRecorder sobre el mismo MediaStream
       → blob → decode → mono → (UI resamplea a 16 kHz) → ASR
```

La visualización y los medidores en vivo leen el **AnalyserNode** del grafo
Web Audio. El audio que va a Whisper sale del **MediaRecorder** sobre el
`MediaStream` crudo (no del grafo sintético ni de ScriptProcessor).

**No tocar la captura sin leer `CAPTURE-INVARIANTS.md` y re-probar mic real.**

## Implementado

| Archivo | Rol |
|---------|-----|
| `open-microphone-stream.ts` | `getUserMedia` real + recuperación si el page tiene gum parcheado |
| `microphone-capture.ts` | Sesión: grafo Analyser + MediaRecorder; `start` / `stop` / `abort` |
| `media-recorder-utterance.ts` | Grabar blob y decodificar a PCM mono |
| `microphone-capture-errors.ts` | Errores tipados de captura (`reason` discriminado) |
| `capture-diagnostics.ts` | Métricas de la utterance (RMS, pico, duración, fuente) |
| `normalize-peak.ts` | Peak-normalize con tope de gain (no amplifica casi-silencio) |
| `mix-to-mono.ts` | Mezcla de canales de un `AudioBuffer` a mono |
| `audio-resampler.ts` | Resample lineal a 16 kHz (Whisper) |
| `audio-frame-buffer.ts` | Helper puro para concatenar frames mono (tests; no es el path ASR actual) |
| `CAPTURE-INVARIANTS.md` | Invariantes y checklist manual de mic |

## Previsto

- `voice-activity-monitor.ts` (VAD en vivo; dominio en `dsp/`) para auto-stop
  al final de frase.
- AudioWorklet solo si el diseño futuro de DSP en tiempo real lo exige; la
  captura ASR actual **no** depende de worklets.
