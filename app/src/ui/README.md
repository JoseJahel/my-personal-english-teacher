# ui/

Presentation layer: React components, screen session hooks, canvas drawing
helpers, and the only place user-visible Spanish copy may live
(`interface-texts.ts`).

Does not call `getUserMedia` or `transformers.js` directly — uses `audio/` and
`ia/` adapters instead. Speech-energy gating uses pure helpers from `dsp/`.

Implemented:

- `interface-texts.ts`: Spanish product strings for the home screen.
- `home-screen-status.ts`: UI status unions and status→message mappers
  (mic, transcription, grammar, capture diagnostics).
- `waveform-canvas.ts`: live waveform from `AnalyserNode` float time-domain
  data, plus live meter callbacks (RMS / peak / level).
- `HomeScreen.tsx`: presentational layout (buttons, panels, canvas, level bar).
- `use-home-screen-session.ts`: mic → energy gate → ASR → non-speech filter →
  grammar session state machine (React state via hooks; no global store yet).

`App.tsx` (repo root of `src/`) only wires the session hook into `HomeScreen`.
