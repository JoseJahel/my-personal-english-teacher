# ui/

Capa de **presentación**: componentes React, hooks de sesión de pantalla,
helpers de dibujo en canvas, y el único lugar donde puede vivir texto en
español visible para el usuario (`interface-texts.ts`).

No llama a `getUserMedia` ni a `transformers.js` directamente — usa los
adaptadores de `audio/` e `ia/`. El gate de energía de habla usa helpers
puros de `dsp/`.

Implementado:

- `interface-texts.ts`: textos en español del producto (home, escenarios,
  chat, banco de pruebas ASR).
- `home-screen-status.ts`: uniones de estado de UI y mapeadores estado→mensaje
  (mic, transcripción, gramática, diagnóstico de captura, generación del tutor).
- `waveform-canvas.ts`: onda en vivo desde datos float de dominio temporal del
  `AnalyserNode`, más callbacks de medidores en vivo (RMS / pico / nivel).
- `practice-scenarios.ts`: tres escenarios curados (restaurante, aeropuerto,
  entrevista de trabajo) con líneas del tutor en inglés y contexto de
  generación para SmolLM2.
- `practice-chat-messages.ts`: helpers puros para mensajes de chat de intro /
  usuario / respuesta del tutor (SmolLM2 o respaldo), y memoria de los últimos
  4 turnos para el LLM (tests en `practice-chat-messages.test.ts`).
- `tutor-reply-engine.ts`: motor de reglas por escenario
  (`pickContextualTutorReply`) — respuesta instantánea y veraz que sirve de
  respaldo cuando SmolLM2 no responde a tiempo (tests en
  `tutor-reply-engine.test.ts`).
- `tutor-reply-orchestration.ts`: enfrenta SmolLM2 contra el motor de reglas
  con un timeout de 10 s (`resolveTutorReplyWithFallback`); el resultado
  siempre indica de forma veraz si se usó el respaldo (tests en
  `tutor-reply-orchestration.test.ts`).
- `spoken-progress.ts` / `interruption-turn-classifier.ts` /
  `interruption-resume-bridges.ts` / `tutor-speech-playback.ts`: barge-in del
  tutor (issue #46) — `spoken_progress` desde `cutoffMs`, clasificación solo
  con el fragmento oído, puentes deterministas (casos A/B/C) y persistencia en
  sesión/turno (caso D).
- `ScenarioPicker.tsx` / `PracticeChatPanel.tsx`: selección de escenario y
  hilo de chat presentacionales; el panel de chat muestra insignia
  honesta cuando la línea es de respaldo, banner "Preparando tutor…" y burbuja
  "Escribiendo…" como live regions accesibles.
- `home-inference-client.ts`: wiring compartido del InferenceClient para
  progreso/listo (incluye la precarga de SmolLM2 al elegir escenario).
- **Shell Atelier (issue #81):** `HomeScreen.tsx` compone
  `PracticeRail` + chat centrado + `PracticeComposer` + `FeedbackPanel`
  (artefacto Turno/Sugerencias/Señales/Técnico). Historial en overlay desde el
  rail. Identidad: `Documentacion general/IDENTIDAD-VISUAL.md` +
  `UI-UX-SHELL.md`. Preview DEV: `#shell-preview` / `-filled` / `-listening`.
  E2E Playwright: `app/e2e/shell-visual.spec.ts`.
- `run-pronunciation-scoring.ts`: PCM del usuario + TTS de la frase corregida
  → score DSP.
- `pronunciation-score-eligibility.ts`: política #75 — no puntuar (ni mostrar
  0–100) si no hay habla usable, el ASR devolvió un tag de no-habla o el
  texto es degenerado; la UI usa el estado `not-evaluated` y un mensaje
  honesto en español.
- `utterance-signal-canvas.ts` / `update-utterance-signal-views.ts`: post-stop
  **espectrograma** + **pitch track YIN** de la última utterance.
- `use-home-screen-session.ts`: shell de escenario + mic → vistas de señal →
  ASR → gramática → tutor híbrido (**SmolLM2** + respaldo) → score de
  pronunciación → **SpeechT5** → persistencia en IndexedDB.
- `PronunciationWordHighlights.tsx`: chips de palabras coloreados (coste local
  del DTW → banda good/medium/poor).
- `PracticeHistoryPanel.tsx`: panel con los últimos turnos guardados en
  IndexedDB (`storage/`).

**Solo desarrollo — banco de pruebas ASR** (`#asr-benchmark`, gateado por
`import.meta.env.DEV` en `App.tsx` / `app-routing.ts`, nunca en producción):

- `AsrBenchmarkScreen.tsx`: pantalla de fixtures + corrida + resultados.
- `use-asr-benchmark.ts`: estado y orquestación; corre cada combinación
  candidato × backend con un `InferenceClient` nuevo (`dispose` entre modelos).
- `asr-benchmark-fixture-draft.ts`: valida una grabación de fixture antes de
  guardarla.
- `asr-benchmark-results.ts`: plan de corridas, resumen por combinación y
  export a CSV/JSON.

**Camino Avance 2:** escenarios + chat + tutor híbrido (SmolLM2 + respaldo) +
TTS + score + highlights por palabra + espectrograma/pitch + VAD + formantes
(LPC) + persistencia en IndexedDB + banco de pruebas ASR (solo dev).

`App.tsx` (raíz de `src/`) enruta entre `AsrBenchmarkScreen` (solo dev, hash
`#asr-benchmark`) y `HomeScreen`, conectando el hook de sesión a este último.
