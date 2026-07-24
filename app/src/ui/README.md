# ui/

Presentation layer: React components, screen session hooks, canvas drawing
helpers, and the only place user-visible Spanish copy may live
(`interface-texts.ts`).

Does not call `getUserMedia` or `transformers.js` directly — uses `audio/` and
`ia/` adapters instead. Speech-energy gating uses pure helpers from `dsp/`.

Implemented:

- `interface-texts.ts`: Spanish product strings (home, scenarios, chat).
- `home-screen-status.ts`: UI status unions and status→message mappers
  (mic, transcription, grammar, capture diagnostics).
- `waveform-canvas.ts`: live waveform from `AnalyserNode` float time-domain
  data, plus live meter callbacks (RMS / peak / level).
- `practice-scenarios.ts`: three curated scenarios (restaurant, airport,
  job interview) with English tutor lines and generation context for later LLM.
- `practice-chat-messages.ts`: pure helpers for intro / user / tutor-placeholder
  chat messages (tests in `practice-chat-messages.test.ts`).
- `ScenarioPicker.tsx` / `PracticeChatPanel.tsx`: presentational scenario
  selection and chat transcript.
- `home-inference-client.ts`: shared InferenceClient wiring for progress/ready.
- `HomeScreen.tsx`: layout (scenarios, chat, buttons, panels, canvas, level).
- `run-pronunciation-scoring.ts`: user PCM + TTS of corrected phrase → DSP score.
- `utterance-signal-canvas.ts` / `update-utterance-signal-views.ts`: post-stop
  **spectrogram** + **YIN pitch track** for the last utterance.
- `use-home-screen-session.ts`: scenario shell + mic → signal views → ASR →
  grammar → **SmolLM2** → pronunciation score → **SpeechT5**.

- `PronunciationWordHighlights.tsx`: colored word chips (DTW local cost → band).

**Avance 2 path:** scenarios + chat + SmolLM2 + TTS + score + word highlights +
spectrogram/pitch + VAD + formants (LPC). Out of A2: IndexedDB sessions.

`App.tsx` (repo root of `src/`) only wires the session hook into `HomeScreen`.
