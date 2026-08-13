## 0. Metadatos
- **Hito:** Avance 2 / Entrega Final
- **Capa principal:** ui
- **Capas secundarias:** ia, audio (interfaces)
- **Requisito:** demo fiable 20 % presentación; verificación sin hardware
- **Tipo:** story
- **Asignado (reparto equitativo):** César (@cesarubau-droid) — carga media; UX home reciente
- **Rama:** `cesar-frontend`
- **Prioridad:** P0 demo (salva presentaciones cuando falla mic/GPU/modelos)

## 1. Contexto
La demo real requiere mic, WebGPU/WASM y >1 GB de modelos. Si el aula falla, se cae el 20 % de presentación. Hace falta un **modo simulado local** que recorra el flujo UI completo **sin red y sin mic**, solo en DEV o con flag explícito.

## 2. Problema
No hay `?mock=1` (o equivalente) que inyecte: waveform fake, transcripción, gramática, tutor, score, TTS silencioso o beep, sugerencias.

## 3. Objetivo
Flag documentado (`import.meta.env.DEV` + query `mock=1` o `VITE_DEMO_MOCK=1`) que sustituya capturas e inferencia por implementaciones mock **con los mismos contratos de UI**, permitiendo ensayo del guion de 10–15 min.

## 4–5. Por qué / para qué
Robustez de demo en localhost (sin cloud). Ensayos del equipo sin descargar modelos cada vez.

## 6. Alcance
### Incluye
- Capa de mocks (p. ej. `ui/demo-mock/` o inyección en home-inference-client).
- Activación solo con flag; **nunca** mock silencioso en build de producción sin flag de build.
- Documentar en `app/README.md` cómo activarlo.
- Tests: el flag enruta a mock; producción default real.
### No incluye
- Hosting en GitHub Pages u otro cloud (prohibido por producto).
- Sustituir tests unitarios de dsp.

## 7. Mapa
- `ui/home-inference-client.ts`, `use-home-microphone-session.ts`, `use-home-utterance-pipeline.ts`
- `app-routing.ts`
- `ia/inference-client.ts`

## 9. Enfoques
1. **Recomendado:** adapter/strategy `createSessionDeps({ mock: boolean })`.
2. Respuestas fijas por escenario en tablas.

## 12. Criterios
- [ ] Con flag, flujo escenario → “hablar” → mensajes de chat + score sin mic
- [ ] Sin flag, comportamiento actual
- [ ] Documentado en README
- [ ] No aparece como camino oculto confuso en UI prod
- [ ] lint/test/build

## 14. DoD
PR mergeado; comentario con URL local de ejemplo `http://localhost:5173/?mock=1`.

**Labels:** `avance-2`, `entrega-final`, `type:story`, `layer:ui`, `person:cesar`, `enhancement`
