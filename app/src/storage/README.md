# storage/

Capa de **infraestructura de persistencia** local con **IndexedDB**.

Guarda progreso de práctica (sesiones y turnos: textos, scores, formantes,
escenario). **Nunca** guarda audio crudo. Los pesos de modelos siguen en la
Cache API de `transformers.js` (fuera de esta capa).

## Implementado

| Archivo | Rol |
|---------|-----|
| `practice-session-types.ts` | Tipos y builders puros de sesión/turno |
| `database-schema.ts` | Nombre DB, versión, `upgradePracticeDatabase`, `openPracticeDatabase` |
| `session-repository.ts` | `ensureSessionForScenario`, `saveTurn`, `listRecentTurns` |

### Esquema v1

- `practice_sessions` (`id`, `scenarioId`, `createdAtIso`, `updatedAtIso`)
- `practice_turns` (`id`, `sessionId`, textos, scores, formantes, resumen de highlights)

Al cambiar el shape: subir `PRACTICE_DATABASE_VERSION` y añadir rama en
`upgradePracticeDatabase`.

### UI

`use-home-screen-session` abre el repo al montar, asegura sesión por escenario
y guarda un turno al completar ASR → tutor → score. El panel
`PracticeHistoryPanel` muestra los últimos turnos.

Errores de storage **no bloquean** la demo (solo se registra el fallo).
