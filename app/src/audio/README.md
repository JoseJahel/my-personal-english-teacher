# audio/

Capa de **infraestructura de audio**: APIs del navegador (`getUserMedia`,
Web Audio, `MediaRecorder`). Solo captura y adaptación; sin React ni modelos.

## Captura actual (ver CAPTURE-INVARIANTS.md)

```
openRealMicrophoneStream()  → MediaStream real del SO
  ├─ MediaStreamSource → Analyser → Gain(0) → destination
  │    (onda + RMS/peak en vivo vía AnalyserNode)
  ├─ MediaStreamSource → AudioWorklet PCM tap (copia Float32, issue #93)
  │    → STFT/YIN propios en el hilo principal (`dsp/`)
  └─ MediaRecorder sobre el mismo MediaStream
       → blob → decode → mono → (UI resamplea a 16 kHz) → ASR
```

La onda y los medidores en vivo leen el **AnalyserNode**. El espectrograma y
el pitch **en vivo** usan PCM del worklet + `dsp/spectrogram.ts` /
`dsp/pitch-detection-yin.ts` (no `getFloatFrequencyData`). El audio que va a
Whisper sale del **MediaRecorder** sobre el `MediaStream` crudo.

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
| `play-pcm-mono.ts` | Reproducir PCM mono (salida TTS) vía `AudioBuffer` |
| `pcm-tap-processor.js` | Worklet: solo copia PCM al hilo principal (no FFT, no ASR) |
| `start-pcm-tap.ts` | Conecta el worklet al `MediaStreamSource` |
| `CAPTURE-INVARIANTS.md` | Invariantes y checklist manual de mic |

## VAD (Avance 2)

El auto-stop al silencio no vive en un worklet: la UI empuja RMS/pico del
`AnalyserNode` a `dsp/voice-activity-detection.ts` en cada frame de la onda.
Tras habla mínima + hangover de silencio (~0.9 s), se invoca el mismo `stop`
que el botón manual (MediaRecorder → pipeline).

## Previsto

- Suspender captura mientras suena TTS de forma más estricta (hoy: UI bloquea
  “iniciar mic” durante síntesis/reproducción).
- AudioWorklet solo si el diseño futuro de DSP en tiempo real lo exige; la
  captura ASR actual **no** depende de worklets.
