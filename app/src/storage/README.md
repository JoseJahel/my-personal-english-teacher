# storage/

Capa de **infraestructura de persistencia** local con **IndexedDB**.

Dos bases de datos independientes, cada una con su propio schema y ciclo de vida:

1. **Progreso de práctica** (`practice-session-types.ts`, `database-schema.ts`,
   `session-repository.ts`): sesiones y turnos — textos, scores, formantes,
   escenario. **Nunca** guarda audio crudo.
2. **Fixtures del banco de pruebas ASR** (`benchmark-fixture-types.ts`,
   `benchmark-fixture-store.ts`), solo desarrollo: texto de referencia + audio
   PCM grabado para medir WER por candidato × backend. A diferencia de las
   sesiones de práctica, **sí guarda audio crudo por diseño** — es la materia
   prima del benchmark — en una base separada y borrable
   (`my-personal-english-teacher-asr-benchmark`) que nunca toca el progreso
   del estudiante ni se sube a Git (solo sale del navegador vía export/import
   JSON en base64, bajo acción explícita del desarrollador).

Los pesos de modelos siguen en la Cache API de `transformers.js` (fuera de
esta capa).

## Implementado

| Archivo | Rol |
|---------|-----|
| `practice-session-types.ts` | Tipos y builders puros de sesión/turno |
| `database-schema.ts` | Nombre DB, versión, `upgradePracticeDatabase`, `openPracticeDatabase` |
| `session-repository.ts` | `ensureSessionForScenario`, `saveTurn`, `listRecentTurns` |
| `benchmark-fixture-types.ts` | Tipos y (de)serialización JSON/base64 de un fixture (pura, dev-only) |
| `benchmark-fixture-store.ts` | IndexedDB separada para fixtures: `saveFixture`, `listFixtures`, `deleteFixture` |

### Esquema v1 (progreso de práctica)

- `practice_sessions` (`id`, `scenarioId`, `createdAtIso`, `updatedAtIso`)
- `practice_turns` (`id`, `sessionId`, textos, scores, formantes, resumen de highlights)

Al cambiar el shape: subir `PRACTICE_DATABASE_VERSION` y añadir rama en
`upgradePracticeDatabase`.

### Esquema v1 (fixtures del benchmark, solo dev)

- `benchmark_fixtures` (`id`, `referenceTextEn`, `sampleRateInHertz`,
  `samplesBuffer` — PCM crudo —, `createdAtIso`), con índice por `createdAtIso`.

Base de datos y versión propias (`BENCHMARK_FIXTURE_DATABASE_NAME` /
`BENCHMARK_FIXTURE_DATABASE_VERSION`), independientes de la de progreso: se
puede borrar sin afectar el historial de práctica del estudiante.

### UI

`use-home-screen-session` abre el repo de progreso al montar, asegura sesión
por escenario y guarda un turno al completar ASR → tutor → score. El panel
`PracticeHistoryPanel` muestra los últimos turnos.

`use-asr-benchmark` (solo dev, pantalla `#asr-benchmark`) abre el store de
fixtures al montar, graba/borra fixtures y corre el benchmark candidato ×
backend contra ellas.

Errores de storage **no bloquean** la demo (solo se registra el fallo).
