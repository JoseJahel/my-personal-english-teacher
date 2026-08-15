# Microphone capture invariants

Canonical capture design for this repo. Layer overview: `README.md` in this folder.

## Design (keep it this simple)

```
openRealMicrophoneStream()  → real OS mic MediaStream
  ├─ MediaStreamSource → Analyser → Gain(0) → destination   // live wave + RMS/peak
  ├─ MediaStreamSource → AudioWorklet (PCM copy only)       // live STFT/YIN (issue #93)
  └─ MediaRecorder on same MediaStream                      // ASR after stop
```

Entry points: `open-microphone-stream.ts`, `microphone-capture.ts`,
`media-recorder-utterance.ts`. UI waveform: `ui/waveform-canvas.ts` (AnalyserNode).

## Never do

1. Use `createMediaStreamDestination().stream` as the mic source  
   (label becomes `MediaStreamAudioDestinationNode` = synthetic).
2. Drive the live waveform only from a ScriptProcessor ring that can “look alive”
   without following the user’s voice.
3. Force `{ sampleRate }` on the capture `AudioContext`. Device rate stays
   native; 44.1/48 → 16 kHz is the FIR in `dsp/polyphase-resample.ts`
   (issue #92), not a constraint on `getUserMedia`.
4. Skip `audioContext.resume()` after `getUserMedia`.
5. Peak-normalize near-silence into Whisper (causes music/phone tags).
6. Reintroduce MediaStreamTrackProcessor / live-PCM rings as the primary ASR path
   without a full mic regression on real Chrome/Windows hardware.
7. Feed `AnalyserNode.getFloatFrequencyData` as the course STFT. Live spectrum
   and F0 must call `dsp/spectrogram.ts` + `dsp/pitch-detection-yin.ts` on PCM
   from the worklet tap (`audio/pcm-tap-processor.js` copies samples only).

## Manual check

1. **Micrófono en uso** = real device name (Realtek, Headset, …).
2. Speak / silence: **%**, **RMS** and **pico** numbers must change with you.
3. Wave shape amplitude follows loudness (auto-scaled).
4. Stop after English → transcript or honest diagnostics.
