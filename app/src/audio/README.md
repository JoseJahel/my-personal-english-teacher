# audio/

Capa de **infraestructura de audio**: APIs del navegador (`getUserMedia`,
Web Audio, `MediaRecorder`). Solo captura y adaptación; sin React ni modelos.

## Captura actual (ver CAPTURE-INVARIANTS.md)

```
openRealMicrophoneStream()  → MediaStream real del SO
  ├─ MediaStreamSource → Analyser → Gain(0) → destination
  │    (onda + RMS/peak en vivo vía AnalyserNode)
  ├─ MediaRecorder sobre el mismo MediaStream
  │    → blob → decode → mono → FIR 44.1/48 → 16 kHz (issue #92)
  │    → pasa-banda 80 Hz–7.5 kHz (issue #73) → ASR
  └─ mediaStream.clone() → MediaStreamSource → AudioWorklet
       → STFT/YIN de curso en vivo (issue #59)
```

La onda y los medidores en vivo leen el **AnalyserNode**. El audio que va a
Whisper sale del **MediaRecorder** sobre el `MediaStream` crudo. El tap
AudioWorklet de STFT/YIN (issue #93/#59) cuelga de una **pista clonada**,
nunca del `MediaStreamSource` del Analyser: en Realtek Windows ese atajo
deja el Analyser en ~0 %. Al detener, espectrograma y pitch se recalculan
sobre el PCM decodificado.

**No tocar la captura sin leer `CAPTURE-INVARIANTS.md` y re-probar mic real.**

## Implementado

| Archivo | Rol |
|---------|-----|
| `open-microphone-stream.ts` | `getUserMedia` real + recuperación si el page tiene gum parcheado |
| `clone-media-stream-for-analysis.ts` | Clona el `MediaStream` para el tap live (#59) |
| `microphone-capture.ts` | Sesión: grafo Analyser + MediaRecorder; `start` / `stop` / `abort` |
| `media-recorder-utterance.ts` | Grabar blob y decodificar a PCM mono |
| `microphone-capture-errors.ts` | Errores tipados de captura (`reason` discriminado) |
| `capture-diagnostics.ts` | Métricas de la utterance (RMS, pico, duración, fuente) |
| `normalize-peak.ts` | Peak-normalize con tope de gain (no amplifica casi-silencio) |
| `mix-to-mono.ts` | Mezcla de canales de un `AudioBuffer` a mono |
| `audio-resampler.ts` | 44.1/48 kHz → 16 kHz vía FIR de fase lineal (`dsp/polyphase-resample.ts`); lineal solo como fallback |
| `prepare-speech-pcm.ts` | Cadena compartida (issue #73): resample + un pasa-banda. Misma función para user y ref TTS |
| `prepare-user-asr-pcm.ts` | User → ASR (issue #63): cadena #73 + Wiener si hay tramas quietas. No se usa en la ref TTS |
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
