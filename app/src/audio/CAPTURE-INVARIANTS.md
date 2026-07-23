# Microphone capture invariants

## Design (keep it this simple)

```
openRealMicrophoneStream()  → real OS mic MediaStream
  ├─ MediaStreamSource → Analyser → Gain(0) → destination   // live wave + RMS/peak
  └─ MediaRecorder on same MediaStream                      // ASR after stop
```

## Never do

1. Use `createMediaStreamDestination().stream` as the mic source  
   (label becomes `MediaStreamAudioDestinationNode` = synthetic).
2. Drive the live waveform only from a ScriptProcessor ring that can “look alive”
   without following the user’s voice.
3. Force `{ sampleRate }` on the capture `AudioContext`.
4. Skip `audioContext.resume()` after `getUserMedia`.
5. Peak-normalize near-silence into Whisper (causes music/phone tags).

## Manual check

1. **Micrófono en uso** = real device name (Realtek, Headset, …).
2. Speak / silence: **%**, **RMS** and **pico** numbers must change with you.
3. Wave shape amplitude follows loudness (auto-scaled).
4. Stop after English → transcript or honest diagnostics.
