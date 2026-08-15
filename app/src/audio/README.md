# audio/

Capa de **infraestructura de audio**: APIs del navegador (`getUserMedia`,
Web Audio, `MediaRecorder`). Solo captura y adaptación; sin React ni modelos.

## Captura actual (ver CAPTURE-INVARIANTS.md)

```
openRealMicrophoneStream()  → MediaStream real del SO
  ├─ MediaStreamSource → Analyser → Gain(0) → destination
  │    (onda + RMS/peak en vivo vía AnalyserNode)
  └─ MediaRecorder sobre el mismo MediaStream
       → blob → decode → mono → FIR 44.1/48 → 16 kHz (issue #92) → ASR
```

La onda y los medidores en vivo leen el **AnalyserNode**. El audio que va a
Whisper sale del **MediaRecorder** sobre el `MediaStream` crudo. El tap
AudioWorklet de STFT/YIN en vivo (issue #93) **no** se conecta a esta fuente:
en arrays Realtek de Windows deja el Analyser en ~0 % aunque MediaRecorder
sí grabe. Espectrograma y pitch de curso se calculan **post-stop** sobre el
PCM decodificado (`dsp/spectrogram.ts`, `dsp/pitch-detection-yin.ts`).

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
| `audio-resampler.ts` | 44.1/48 kHz → 16 kHz vía FIR de fase lineal (`dsp/polyphase-resample.ts`); lineal solo como fallback |
| `audio-frame-buffer.ts` | Helper puro para concatenar frames mono (tests; no es el path ASR actual) |
| `play-pcm-mono.ts` | Reproducir PCM mono (salida TTS) vía `AudioBuffer` |
| `speech-pcm-cache.ts` | Caché de PCM SpeechT5 por frase del tutor |
| `play-browser-speech-synthesis.ts` | Voz local (`speechSynthesis`) si aún no hay PCM cacheado |
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
