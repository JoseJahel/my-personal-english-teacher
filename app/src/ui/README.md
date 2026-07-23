# ui/

Presentation layer: React components, screen session hooks, canvas drawing
helpers, and the only place user-visible Spanish copy may live
(`interface-texts.ts`).

Does not call `getUserMedia` or `transformers.js` directly — uses `audio/` and
`ia/` adapters instead.

Implemented:

- `interface-texts.ts`: Spanish product strings for the home screen.
- `home-screen-status.ts`: UI status unions and status→message mappers.
- `waveform-canvas.ts`: live waveform draw/clear helpers for the AnalyserNode.
- `HomeScreen.tsx`: presentational layout (buttons, panels, canvas).
- `use-home-screen-session.ts`: mic → ASR → grammar session state machine.

`App.tsx` (repo root of `src/`) only wires the session hook into `HomeScreen`.
