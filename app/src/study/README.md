# study/

Capa de **dominio puro** del modo de estudio (el temario y su práctica):
parsea las lecciones en markdown, arma el índice, extrae de ese mismo texto
los ítems de las cuatro modalidades de práctica y lleva el estado de sesión
— progreso, marcapáginas, repetición espaciada — con funciones puras (mismas
entradas, mismas salidas, sin efectos secundarios), igual que `dsp/`.

Esta capa no depende de ninguna otra capa del proyecto: ningún archivo
importa React, el DOM, `ui/`, `ia/`, `audio/` ni `storage/` (verificado por
grep sobre los `import` de todo el directorio; los únicos imports son entre
archivos de la propia carpeta). La única API de navegador que toca la capa
es `window.matchMedia` en `study-bookmark.ts`, para respetar
`prefers-reduced-motion` al mover el marcapáginas, y va guardada tras un
`typeof window === 'undefined'` para no romper en Vitest ni en un entorno
sin DOM.

La consume `ui/use-study-session.ts` (arma la sesión de estudio como hook de
React) y `storage/study-document-store.ts` (persiste en IndexedDB el
progreso por catálogo, el marcapáginas y las tarjetas de repetición
espaciada). El contenido del temario en sí vive **fuera de `app/`**, en
`estudio/procesado/*.md` (36 lecciones), y se empaqueta en el bundle vía
`import.meta.glob` — no se descarga en runtime ni se guarda en IndexedDB;
IndexedDB solo guarda el progreso de lectura y de práctica, nunca el texto
de la lección.

Pipeline: `estudio/procesado/*.md` (frontmatter YAML + cuerpo) →
`parse-lesson-markdown.ts` → `load-processed-lessons.ts` (arma el
`StudyDocument`) → `group-study-blocks.ts` (índice agrupado por bloque) /
`extract-practice-items.ts` (ítems de práctica desde el mismo cuerpo) →
`practice-bank.ts` (banco final por modo).

Implementado:

- `study-types.ts`: tipos centrales de la capa, sin lógica:
  - `StudyDocument` (catálogo: id, title, `StudySection[]`) y `StudySection`
    (id, title, `bodyText` en markdown, y metadatos opcionales de la
    lección: `titleEn`, `tema`, `bloque`, `bloqueEs`, `objetivo`)
  - `StudySession` (documentId, sección activa, secciones completadas y,
    en `origin/main`, el marcapáginas `bookmark: StudyBookmark | null`)
  - `ProcessedLesson`: forma intermedia que entrega el parser de markdown
    antes de convertirse en `StudySection`
  - `PRACTICE_MODES = ['vocab', 'completar', 'traducir', 'transformar']` y
    la unión discriminada `PracticeItem`, un tipo por modo: `VocabPracticeItem`
    (`frontEs`/`backEn`, tarjeta de vocabulario), `CompletarPracticeItem`
    (`phrase` con hueco `___` + `options` + `correctIndex`, opción múltiple),
    `TraducirPracticeItem` (`promptEs`/`answerEn`, traducción en texto libre)
    y `TransformarPracticeItem` (`prompt`/`stimulus`/`answer` + `options`
    opcional, transformación gramatical)
  - `PracticeBank`: los cuatro modos como listas independientes
  - `isStudyKey` / `STUDY_KEY_PATTERN` (`/^[a-z][a-z0-9]*$/`): valida las
    claves de `tema` y `bloque` del frontmatter

- `parse-lesson-markdown.ts`: `parseLessonMarkdown(raw, sourcePath)` →
  `ProcessedLesson`. Frontmatter YAML propio (sin librería): separa
  `id`/`order`/`title`/`titleEn`/`tema`/`bloque`/`bloqueEs`/`objetivo` del
  cuerpo; un campo inválido se descarta con `console.warn` y cae a un
  fallback derivado del nombre de archivo (`01-en-el-restaurante.md` →
  id/order/title), nunca se tira la lección entera por un campo suelto.
  También expone `parseMarkdownBlocks`/`parseMarkdownInlines`: un parser de
  markdown a bloques (heading h1–h3, párrafo, lista, tabla, `hr`) e inlines
  (`**strong**`, `*em*`) propio, sin librería externa, que la UI usa para
  dibujar el cuerpo de la lección sin HTML crudo. Tests en
  `parse-lesson-markdown.test.ts`.

- `load-processed-lessons.ts`: `loadProcessedLessons()` usa
  `import.meta.glob('../../../estudio/procesado/*.md', { query: '?raw', eager: true })`
  para traer las lecciones ya empaquetadas en el bundle (sin `fetch` en
  runtime), las parsea con `parseLessonMarkdown`, renombra con sufijo los
  ids duplicados, ordena por `order` y luego por `id`, y arma un único
  `StudyDocument` con id fijo `PROCESSED_CATALOG_ID`. `studyDocumentFromLessons`
  es la mitad testable sin depender del glob real (la usan los tests y
  `create-sample-study-document.ts`). Tests en `load-processed-lessons.test.ts`.

- `group-study-blocks.ts`: `groupStudyBlocks(sections)` arma el índice del
  catálogo agrupando secciones **contiguas** que comparten `bloque` en una
  caja (`{ type: 'block' }`); el mismo `bloque` si se corta por una sección
  sin ese `bloque` produce dos cajas separadas, no una; una sección sin
  `bloque` cae en una fila suelta (`{ type: 'loose' }`). Tests en
  `group-study-blocks.test.ts`.

- `extract-practice-items.ts`: deriva los ítems de práctica del **mismo**
  markdown de la lección, no de un banco escrito aparte:
  - `extractVocabPairs` lee las líneas `- **EN** — ES` de la sección
    Vocabulario; descarta líneas sin par o con el lado vacío
  - `extractModelPhrases` saca las frases en inglés de la sección "Frases
    modelo" (quita el prefijo `Hablante:`, descarta líneas con diacríticos
    ES o `→`)
  - `buildCompletarItems` abre un hueco (`___`) sobre la palabra de
    vocabulario detectada en una frase modelo y arma las opciones con la
    correcta más hasta 3 distractores (mínimo 2 para generar el ítem),
    insertada en una posición determinista por hash del id (no
    `Math.random`, para que el orden sea estable en tests y SSR); requiere
    `tema` válido y ≥ 3 pares de vocabulario en ese tema para generar
    `completar`
  - Tests en `extract-practice-items.test.ts`.

- `practice-drills.ts`: `TRANSFORM_DRILLS`, banco fijo escrito a mano de
  ítems `transformar` (contracción, pregunta, negación, respuesta corta,
  plural, artículo, demostrativo…), uno por tema gramatical (`besingular`,
  `beplural`, `nouns`, `presentsimple`, `canlike`, `pastsimple`, `jobs`,
  `prescont`, `classroom`, `time`, `therewas`) — a diferencia de los otros
  tres modos, `transformar` no se deriva del markdown de la lección.

- `practice-bank.ts`: `buildPracticeBank(lessons)` junta todo el banco:
  agrupa los pares de vocabulario por `tema` a través de lecciones, deriva
  `vocab` (tarjeta) y `traducir` (mismo par, ES→EN en texto libre) del mismo
  par extraído, `completar` de las frases modelo + vocabulario de ese tema,
  y `transformar` de `TRANSFORM_DRILLS` filtrados por validez; deduplica ids
  con sufijo igual que `load-processed-lessons.ts`. `itemsForMode(bank, mode, tema)`
  filtra por modo y, si se pasa, por tema. Tests en `practice-bank.test.ts`.

- `practice-direction.ts` *(en `origin/main`, aún no en este árbol local)*:
  dirección de práctica `es-en` / `en-es` / `mixed` (`PracticeDirection`),
  aplicable solo a los modos bilingües `vocab` y `traducir`
  (`isBilingualPracticeMode`); `resolvePracticeFacing` sortea `es-en`/`en-es`
  al 50 % cuando la dirección es `mixed`; `resolveBilingualSides` decide qué
  lado del par se muestra como estímulo y cuál como respuesta esperada según
  el `facing` resuelto.

- `practice-srs.ts` *(en `origin/main`, aún no en este árbol local)*:
  repetición espaciada tipo SM-2 adaptado, tarjeta por ítem de práctica
  (y, en dirección `mixed`, una tarjeta independiente por sentido —
  `srsItemId` sufija `#es-en`/`#en-es`; `lookupPracticeSrsCard` cae a la
  clave sin sufijo para tarjetas guardadas antes de que existiera la
  dirección):
  - intervalos en horas `[0.5, 4, 24, 72, 168, 336, 720, 1440]`
  - factor de facilidad acotado entre **1.3** y **3.0**, inicial **2.3**
    (+0.05 al acertar, −0.2 al fallar)
  - un fallo reinicia el intervalo y reprograma la tarjeta en **60 s**
    (`PRACTICE_SRS_FAIL_DELAY_MS`)
  - `applyPracticeSrsResult` avanza o falla una tarjeta; `pickNextPracticeIndex`
    hace selección ponderada de la siguiente tarjeta entre las vencidas por
    sorteo (peso base 1, **+16** si es nueva, **+8** si está vencida, hasta
    **+6** según fallos previos), evitando repetir el índice actual cuando
    hay alternativas.

- `study-session.ts`: estado de progreso por catálogo — `createStudySession`,
  `selectSection`/`goToNextSection`/`goToPreviousSection` (índice fuera de
  rango o en un extremo: no-op, sin clamp silencioso), `markSectionCompleted`,
  `studyProgress01` (ratio de secciones completadas, 0–1). En `origin/main`
  suma `setSessionBookmark`/`clearSessionBookmark` para el marcapáginas.
  Tests en `study-session.test.ts`.

- `study-bookmark.ts` *(en `origin/main`, aún no en este árbol local)*:
  marcapáginas de reanudación — `bookmarkFromSection` arma un `StudyBookmark`
  (sección, título, orden 1-based, timestamp ISO) desde una `StudySection`;
  `normalizeStudyBookmark` valida/repara un objeto crudo leído de IndexedDB,
  descartando el marcapáginas si falta `sectionId` (nunca tira el registro
  padre); `bookmarkNeedsMoveConfirm` decide si hace falta el diálogo de
  confirmación al mover el marcapáginas a otra sección; `prefersReducedMotion`
  es el único punto de la capa que consulta una API de navegador
  (`window.matchMedia`), guardada con `typeof window` para no romper fuera
  del navegador.

- `practice-session.ts`: estado de una sesión de práctica — modo activo,
  tema, índice del ítem, si la respuesta está revelada, la nota:
  `createPracticeSession`, `selectPracticeMode`/`selectPracticeTema`
  (reinician índice/`revealed`/`grade`), `revealPracticeItem`,
  `checkCompletarChoice`/`checkWrittenAnswer` (comparan y solo avanzan al
  acertar; `normalizePracticeAnswer` recorta espacios, pasa a minúsculas y
  quita la puntuación final antes de comparar), `rateVocabAndNext`
  (autoevaluación de la tarjeta de vocabulario). En `origin/main` queda
  cableado con `practice-direction.ts` (`selectPracticeDirection`, `facing`
  por ítem) y con `practice-srs.ts` (el avance ya no es un módulo simple
  sobre el conteo de ítems: recibe el índice que decide
  `pickNextPracticeIndex`). Tests en `practice-session.test.ts`.

- `create-sample-study-document.ts`: `createSampleStudyDocument()`, catálogo
  mínimo de 3 lecciones de muestra (sin pasar por el `import.meta.glob`
  real), para tests que no necesitan cargar las 36 lecciones procesadas.
