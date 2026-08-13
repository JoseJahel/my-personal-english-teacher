## 0. Metadatos
- **Hito:** Entrega Final
- **Capa principal:** ui / storage
- **Requisito:** extensiones innovación 10 % (progreso, gamificación ligera)
- **Tipo:** story
- **Asignado (reparto equitativo):** César (@cesarubau-droid)
- **Rama:** `cesar-frontend`
- **Prioridad:** P2 innovación

## 1–2. Contexto / problema
Hay historial y (si está mergeado) tendencia de scores. Falta una capa **ligera** de hábito: racha de días con práctica y conteo de turnos “buenos” (p. ej. score ≥ umbral), derivada solo de datos ya persistidos.

## 3. Objetivo
Calcular y mostrar en UI: (1) racha de días consecutivos con ≥1 sesión/turno; (2) número de frases/turnos con score en banda good. Sin badges complejos ni servidor.

## 4–5. Por qué / para qué
Innovación y retención; se ve en demo en 10 s.

## 6. Alcance
### Incluye
- Funciones puras sobre `PracticeTurnRecord[]` / sessions.
- Panel o chips en home/historial.
- Tests de racha (medianoche, huecos).
- Textos ES.
### No incluye
- Leaderboards online.
- Economía de puntos compleja.

## 7. Mapa
- `storage/session-repository.ts`, `practice-session-types.ts`
- `ui/PracticeHistoryPanel.tsx`, trend chart si existe

## 12. Criterios
- [ ] Racha y contador visibles con datos reales de IndexedDB
- [ ] Tests de borde de fechas
- [ ] Sin red
- [ ] lint/test/build

## 14. DoD
PR mergeado.

**Labels:** `entrega-final`, `type:story`, `layer:ui`, `layer:storage`, `person:cesar`, `enhancement`
