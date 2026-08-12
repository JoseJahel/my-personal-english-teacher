## 0. Metadatos
- **Hito:** Avance 2 / Entrega Final
- **Capa principal:** ui
- **Capas secundarias:** dsp, storage
- **Requisito:** RF-10 pronunciación; innovación/completitud; usabilidad demo
- **Tipo:** story
- **Asignado (reparto equitativo):** Rebeca (@alvarezrebeca753-sudo) — 1 issue abierto del lote anterior; foco UI
- **Rama:** `rebeca-frontend`
- **Prioridad:** P0 producto (modo de score más claro y defendible)

## 1. Contexto
Hoy el score compara la utterance del usuario con **TTS de la frase corregida** dentro del flujo conversacional. Eso es potente, pero en demo y para el estudiante a veces es más claro un **modo práctica**: la app propone una frase objetivo en inglés, el usuario la repite, y se puntúa/highlight contra esa frase (texto + acústica).

## 2. Problema
Sin modo práctica:
- El profe/estudiante no ve un “target” fijo.
- Es más difícil mostrar mejora repetición a repetición.
- El score en conversación libre se confunde con “¿qué se supone que debía decir?”.

## 3. Objetivo
Añadir **modo práctica** (además del modo escenarios/conversación): banco de frases EN, UI para mostrar la frase, capturar repetición, score + highlights vs objetivo (texto y/o TTS del objetivo), historial opcional.

## 4–5. Por qué / para qué
Mejor pedagogía, demo controlada, y narrativa de pronunciación más limpia sin quitar el modo conversación.

## 6. Alcance
### Incluye
- Toggle o entrada de menú: Conversación | Práctica.
- Banco de 8–15 frases (pueden reutilizar banco de calibración EN).
- Flujo: mostrar frase → escuchar → score vs TTS(objetivo) y/o comparación léxica palabra a palabra.
- Textos ES; no hardcodear strings en JSX.
- Tests del banco y del armado de turno de práctica.
### No incluye
- Eliminar modo conversación.
- Gamificación completa (issue aparte).
- Cloud.

## 7. Mapa
- `ui/practice-scenarios.ts`, `HomeScreen.tsx`, `use-home-screen-session.ts`
- `ui/run-pronunciation-scoring.ts`
- `dsp/pronunciation-score.ts`
- `dsp` calibración phrase bank
- `storage` si se quiere marcar tipo de sesión

## 8. Investigación
1. Ver cómo se elige escenario y se append-ea un turno.
2. Reutilizar pipeline de utterance con `referenceText` fijo = frase objetivo.
3. Evitar que SmolLM2 “conteste” en modo práctica (o contestar con “Good, try again” plantilla).

## 9. Enfoques
1. **Recomendado:** mismo shell UI; `sessionMode: 'conversation' | 'practice'`.
2. Ruta hash `#practice` — aceptable.

## 12. Criterios
- [ ] Usuario puede practicar frase fija de punta a punta
- [ ] Score + highlights visibles
- [ ] Conversación intacta
- [ ] Tests + textos ES
- [ ] lint/test/build

## 14. DoD
PR mergeado + nota de uso en app README.

**Labels:** `avance-2`, `entrega-final`, `type:story`, `layer:ui`, `layer:dsp`, `person:rebeca`, `enhancement`
