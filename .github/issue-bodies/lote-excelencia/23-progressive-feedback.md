## 0. Metadatos
- **Hito:** Avance 2 / Entrega Final
- **Capa principal:** ui
- **Capas secundarias:** ia
- **Requisito matriz / enunciado:** RNF-06 latencia &lt; 2 s *donde aplique*; verificación del documento
- **Tipo:** story
- **Asignado (reparto equitativo):** Jahel (@JoseJahel) — lote de laboratorio y defensa A2/Final pedido por Jahel; no redistribuye #57–#79
- **Rama de trabajo:** `jahel-frontend`
- **Prioridad rúbrica:** P1

## 1. Contexto del producto (para IA y humanos)
El default de entrega es `whisper-small.en` (~3.4 s WebGPU). #61 añadió `pnpm dev:latency` → `tiny-en` **sin** afirmar &lt; 2 s hasta medir en aula. SmolLM2 tiene timeout 10 s. El presupuesto de 2 s del enunciado, si se aplica al turno entero (ASR+T5+tutor+TTS), está perdido con `small-en`.

## 2. Problema u oportunidad
- El panel ya recibe transcripción cuando Whisper termina, pero el **chat** y el “turno en curso” esperan al tutor (`appendSuccessfulPracticeTurn`).
- RNF-06 se defiende mejor si **retroalimentación** (texto + gramática) es el tramo &lt; 2 s, y el tutor es conversación (pausa humana).
- El perfil latencia existe; falta cifra de aula y una insignia honesta en UI (DEV o rail) de qué perfil corre.

## 3. Objetivo
Cuando esté cerrado: (1) el estudiante ve su frase y la corrección T5 **antes** de la burbuja del tutor; (2) el reporte define el presupuesto de 2 s como ese tramo; (3) hay milisegundos de `tiny-en` en el hardware de demo o una nota explícita de “no medido”.

## 4. Por qué importa
- 20 % presentación: el aula percibe “respondió ya” aunque SmolLM2 tarde.
- El default `small-en` no se vende como &lt; 2 s. El perfil `tiny-en` se documenta aparte.
- El perfil deja de ser solo `.env`: hay UX, métrica y definición del presupuesto.

## 5. Para qué
Demo A2 más ágil; RNF-06 defendible.

## 6. Alcance
### Incluye
- Publicar en el chat el turno del usuario (+ corrección si aplica) **en cuanto** ASR+T5 cierran; estado “El tutor está escribiendo…” después.
- No bloquear el compositor más de lo que exija half-duplex (#26) / barge-in (#46).
- Insignia o línea del rail con el perfil (`precision` / `latency`) vía `resolveAsrDemoProfile()`.
- Procedimiento + tabla en `reporte-verificacion.md`: medir `tiny-en` × WebGPU en `#asr-benchmark` en la máquina de aula. Si no se corre, escribir “pendiente” — no inventar ms.
- Aclarar RNF-06: 2 s = feedback ASR+T5, no tutor.

### No incluye
- Cambiar el default de producción a `tiny-en`.
- Acortar el timeout de SmolLM2.
- Hosting. Web Speech API.
- Rehacer #61.

## 7. Estado actual en el código (mapa para investigar)
- `app/src/ui/use-home-transcription-pipeline.ts` — `setTranscribedText` antes de gramática
- `app/src/ui/use-home-practice-turn.ts` — `appendSuccessfulPracticeTurn` (user bubble + `await` tutor)
- `app/src/ui/tutor-reply-orchestration.ts` — 10 s
- `app/src/ia/model-registry.ts` — `resolveAsrDemoProfile`, `VITE_ASR_PROFILE`
- `app/src/ui/interface-texts.ts`
- `app/README.md` perfil latencia

## 8. Dónde investigar la causa / el diseño actual
1. Seguir un turno: ¿cuándo aparece la burbuja de usuario vs tutor?
2. Grep `appendSuccessfulPracticeTurn` / `createUserUtteranceMessage`.
3. Leer #61 y L-1 del reporte.
4. Correr `#asr-benchmark` con `tiny-en` si hay fixtures locales.

## 9. Enfoques de solución aceptables
1. **Recomendado:** partir `appendSuccessfulPracticeTurn` (persistir/score pueden seguir después); chat progresivo.
2. Aceptable: si el user bubble ya sale pronto, solo falta copy + insignia + cifra + docs del presupuesto.
3. Prohibido: vender `small-en` como &lt; 2 s; inventar latencia de tiny.

## 10. Documentación y referencias
- RNF-06, L-1, #61, #46, #26
- `app/README.md`, `ia/README.md`

## 11. Plan de implementación sugerido (pasos)
- [ ] Chat progresivo + tests de orquestación
- [ ] Insignia de perfil
- [ ] Docs RNF-06 + procedimiento aula
- [ ] `cd app; pnpm lint; pnpm test; pnpm build`

## 12. Criterios de aceptación
- [ ] Usuario ve texto/corrección sin esperar SmolLM2/TTS
- [ ] Perfil ASR visible (al menos en DEV)
- [ ] Reporte: definición del presupuesto 2 s + fila tiny-en (número o “no medido”)
- [ ] Default `small-en` intacto
- [ ] lint + test + build
- [ ] PR `jahel-frontend` → `main`

## 13. Pruebas
- Unitarias: el mensaje de usuario se añade aunque `generateTutorReply` cuelgue (mock timeout).
- Manual: `pnpm dev` y `pnpm dev:latency`; un turno.

## 14. Definición de hecho (DoD)
En `main`. Comentario con captura del chat progresivo y la fila de latencia (o “no medido”).
