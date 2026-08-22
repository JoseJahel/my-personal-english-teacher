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
- `tutor-reply-orchestration.ts`: timeout de 10 s si se llama a SmolLM2.
  El turno de práctica **no espera** al LLM: `resolvePracticeTutorReply`
  publica al instante la línea del motor de reglas y la voz (caché Supertonic
  o `speechSynthesis` local).
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
  `UI-UX-SHELL.md`. Preview DEV: `#shell-preview` / `-filled` / `-listening` /
  `-composing` (#96: usuario + “Escribiendo…”, Hablar habilitado).
  E2E Playwright: `app/e2e/shell-visual.spec.ts`.
- `feedback-panel-parts.tsx`: piezas presentacionales puras que usa
  `FeedbackPanel.tsx` en sus cuatro tabs — `PanelTab` (pestaña `role="tab"`
  con `aria-selected`), `FeedbackBlock` (contenedor con título en versalitas
  para cada bloque del tab Turno), `Metric` (par etiqueta/valor de la
  cuadrícula de desglose MFCC/pitch/energía/formantes) y `TechRow` (fila
  etiqueta/valor del tab Técnico).
- `CommunicationSuggestionsPanel.tsx`: pinta en el tab Sugerencias las
  tarjetas que arma `ia/communication-suggestions.ts` — insignia de tipo
  (vocabulario/fluidez/naturalidad), "Dijiste" con la frase real del alumno,
  "Prueba esto" con la reescritura (se omite si es idéntica a lo dicho) y el
  consejo en español. Sin sugerencias no pinta nada, salvo que
  `showEmptyState` esté activo (`FeedbackPanel` siempre lo pasa en `true`).
- `schedule-dynamic-suggestions.ts`: tras publicar las tarjetas
  estructurales, lanza en segundo plano y sin bloquear el turno
  `resolveDynamicCommunicationSuggestions` (de
  `ia/communication-coaching-generation.ts`) contra SmolLM2; si
  `generateCommunicationCoaching` no está disponible en el cliente, no hace
  nada. Compara el número de generación al resolver
  (`readCurrentGeneration` vs. `startedAtGeneration`) para descartar el
  resultado si ya empezó un turno más nuevo antes de llamar a
  `setSuggestions`.
- `run-pronunciation-scoring.ts`: PCM del usuario + TTS de la frase corregida
  → **misma** cadena `prepareSpeechPcmForModels` (resample + pasa-banda #73)
  → score DSP (MFCC + pitch + energía + formantes, issue #58). La tasa de
  trabajo se fija a `WHISPER_SAMPLE_RATE_IN_HERTZ` (16 kHz) en vez de
  heredarse de la tasa que emita el sintetizador (Supertonic entrega
  44.100 Hz): el remuestreo lleva a usuario y referencia al mismo régimen de
  banco mel/pasa-banda para el que están calibradas las constantes de
  `pronunciation-score.ts`.
- `pronunciation-score-eligibility.ts`: política #75 — no puntuar si no hay
  habla usable, tag de no-habla o texto degenerado (`not-evaluated`). Issue
  **#95**: conversación tampoco muestra 0–100 (`deferred-to-drill`) porque
  el cambio de locutor sintético mueve el score tanto o más que un error de
  vocal; la nota está en **Repetir**.
- `utterance-signal-canvas.ts` / `update-utterance-signal-views.ts`: post-stop
  **espectrograma** + **pitch track YIN** de la última utterance.
- `formant-vowel-map.ts` + `FormantVowelMap.tsx` (issue #76): mapa F1×F2
  (convención vocálica) en el panel Señales; historial solo con Hz de IndexedDB.
- `start-live-pcm-signal-views.ts` (issues #93/#59): STFT/YIN sobre PCM del
  worklet en una **pista clonada**. Hablar abre el panel en Señales. Al
  detener, las mismas funciones pintan la utterance completa.
- `use-home-screen-session.ts`: shell de escenario + mic → vistas de señal →
  ASR → gramática → **burbuja de usuario (issue #96)** → tutor híbrido
  (**SmolLM2** + respaldo) → score de pronunciación → **Supertonic** →
  persistencia en IndexedDB. El mic no se bloquea mientras el tutor genera
  texto; solo durante TTS. Perfil ASR en el rail
  (`asr-demo-profile-presentation.ts`).
  Issue **#98:** `home-session-ports.ts` + mocks en `mock-home-session-ports.ts`.
  `useHomeScreenSession(ports?)` acepta captura + inferencia inyectables.
  Hash **`#practice-mock`** (alias `#ensayo-ui`) pide confirmación; no
  monta el mock solo. Tras “práctica real” se recuerda y se ignora el hash.
  Forzar ensayo: `?forzar-ensayo=1#practice-mock`. En `pnpm dev` el hash
  basta; un `pnpm preview` de entrega **no** lo abre salvo
  `pnpm build:ensayo` (`VITE_ENSAYO_UI=1`, issue #70).
  `#shell-preview*` sigue siendo el fixture estático de Playwright.
- `user-turn-signal-card.ts` + `UserTurnSignalCard.tsx` (issue #79): tarjeta
  colapsable bajo el mensaje del estudiante con score/bandas/formantes por
  valor (sin PCM). El enlace a espectro/pitch solo en el último turno.
- `PronunciationWordHighlights.tsx`: chips de palabras coloreados (coste local
  del DTW → banda good/medium/poor).
- `PracticeHistoryPanel.tsx` + `practice-habits.ts` (issue #72): racha de
  días locales y conteo de turnos “bien” (≥ umbral good 72) sobre IndexedDB.
- `PracticeHistoryPanel.tsx`: panel con los últimos turnos guardados en
  IndexedDB (`storage/`).

**Modo Estudio:** consume la sexta capa del proyecto (`study/`, dominio puro
sin React/DOM/`ui/`/`ia/`) y se monta como una vista más del rail izquierdo,
no como pantalla enrutada aparte por `App.tsx`. `HomeScreen.tsx` alterna su
`activeView` a `'study'` (cuarto ítem del rail) y monta `StudyShellPane`,
sincronizando el hash `#estudio` (gateado por `shouldShowStudyScreen` en
`app-routing.ts`, raíz de `src/`).

- `StudyShellPane.tsx`: envoltorio de una línea — monta `StudyScreen` en modo
  `embedded` como panel hermano del rail, no como overlay a pantalla completa.
- `StudyScreen.tsx`: pantalla contenedora con tres vistas internas
  (`catalog` / `reader` / `practice`) más el diálogo de marcapáginas.
  Cabecera de una fila: título + kicker de lección a la izquierda, chip de
  guardado (refleja `storageWarning` de `use-study-session.ts`) y el
  segmentado Temario/Prácticas (`.view-switch`, `role="group"`,
  `data-testid="study-view-switch"`, un botón `aria-pressed` por vista) a la
  derecha; el botón "Volver a práctica" (oculto en modo `embedded`) cierra
  esa fila. Arma el banco de prácticas con `buildPracticeBank`
  (`study/practice-bank.ts`) a partir de las secciones del documento
  cargado. El lector de lección usa `LessonMarkdown` para el cuerpo, la
  cinta de marcapáginas (`BookmarkRibbon`), la navegación
  anterior/siguiente/practicar y, debajo de esa fila de botones, una barra
  de progreso de lecciones visitadas (`role="progressbar"`,
  `aria-valuemin`/`aria-valuemax`/`aria-valuenow` sobre el total de
  secciones del documento) calculada desde `study.progress01`.
- `study-catalog-pane.tsx`: `StudyCatalog` — índice de lecciones con
  buscador en vivo (filtra por título ES/EN, objetivo y bloque), agrupado
  por bloque temático vía `groupStudyBlocks` (subtemas del mismo bloque
  anidados bajo una cabecera común) y la tarjeta "Continúa desde donde lo
  dejaste", que abre la lección del marcapáginas o, si esa lección ya no
  existe en el curso, deja la nota de marcapáginas huérfano. Cada numeral de
  fila (`.indice-num`) lleva `data-state="pending" | "done" | "current"`
  (marcapáginas > completada > pendiente, contra `completedSectionIds` de
  la sesión y `isBookmarkOnSection`); la fila con el marcapáginas muestra
  además la cinta mini (`.indice-fila-cinta`) en vez del enlace "Abrir".
- `study-practice-panes.tsx`: `PracticeItemPane` despacha por tipo de ítem a
  tres paneles — `VocabPane` (tarjeta volteable con "Sabía" / "No sabía";
  cada cara lleva `lang="es"`/`lang="en"` según la dirección de práctica, y
  la cara en español tipografía sans en vez de la serif itálica reservada al
  inglés), `ChoicePane` (opción múltiple; la usan `completar` y
  `transformar` cuando trae opciones) y `WrittenPane` (respuesta escrita
  libre; la usan `traducir` y `transformar` sin opciones). Tras una
  respuesta incorrecta, la opción/entrada elegida recibe `.is-incorrect` y
  la opción correcta `.is-correct` (paleta semántica sage/blush del shell,
  nunca hex directo) junto con la solución (`.practice-solution`,
  `role="alert"`); un acierto no muestra ese refuerzo porque el escritorio
  avanza al siguiente ítem sin estado intermedio observable. Las
  direcciones ES→EN / EN→ES de vocabulario y traducción se resuelven con
  `resolveBilingualSides` (`study/practice-direction.ts`).
- `study-bookmark-controls.tsx`: `BookmarkRibbon` (cinta animada para
  plantar/quitar el marcapáginas, con locks de tiempo
  `BOOKMARK_PLANT_LOCK_MS` / `BOOKMARK_RETRACT_LOCK_MS` que saltan al estado
  final de una vez si `prefers-reduced-motion`) y `BookmarkDialog` (confirma
  mover el marcapáginas a otra lección o avisa de marcapáginas huérfano;
  cierra con Escape o clic fuera del diálogo).
- `use-study-session.ts`: carga el catálogo procesado
  (`loadProcessedLessons`), restaura progreso y marcapáginas desde
  `storage/study-document-store.ts` (IndexedDB) o crea sesión nueva si no
  hay nada guardado; expone navegación entre secciones (`selectSectionIndex`,
  `goNext`, `goPrevious`) y marcapáginas (`plantBookmark`, `clearBookmark`),
  persistiendo cada cambio. Si el store falla, degrada a solo-sesión y
  expone `storageWarning`.
- `study-interface-texts.ts`: textos en español del modo Estudio (catálogo,
  lector, marcapáginas, modos de práctica, mensajes de repetición espaciada)
  más `STUDY_TEST_IDS` y `labelForStudyTema` (etiqueta legible de cada tema
  del temario, p. ej. `besingular` → "Verbo be (I, you, he, she, it)").
- `study-notebook.css`: hoja de estilos del modo Estudio, escopada por
  completo bajo `.study-notebook`, sobre la misma identidad Atelier del
  Home (`app/src/index.css`, `@theme` de Tailwind 4): cabecera y chip de
  guardado, el segmentado Temario/Prácticas, filas y bloques del índice, la
  cinta de marcapáginas animada, los diálogos modales y los paneles de
  práctica leen tokens `var(--color-sage-*)` / `var(--color-ink-*)` /
  `var(--color-atelier-elev)`, tipografía `var(--font-sans)` /
  `var(--font-serif)` (esta última solo en cursiva, para la marca, cifras
  grandes y el inglés a practicar) y las recetas de tarjeta/botón/chip del
  Home — sin la paleta ni el fondo cuadriculado del "cuaderno" anterior, sin
  gradientes y sin hex sueltos fuera de esos tokens salvo `#fff` en tarjetas
  grandes y en texto sobre acento sólido (guardado por
  `study-notebook-skin.test.ts`). Un único bloque de foco
  (`.study-notebook :is(button, input, a):focus-visible`) usa el anillo
  `var(--color-sage-600)` del shell en vez de los `outline` azules
  repartidos que tenía antes.

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
