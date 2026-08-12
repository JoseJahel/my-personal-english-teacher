## 0. Metadatos
- **Hito:** Avance 2 / Entrega Final
- **Capa principal:** ui
- **Capas secundarias:** ia
- **Requisito matriz / enunciado:** RF-14; descripción general del proyecto: *sugerencias para comunicación más efectiva (vocabulario, fluidez, naturalidad, corrección cultural/contextual)*; core: *modelo ligero de generación de texto para alternativas más naturales*
- **Tipo:** story
- **Asignado (reparto equitativo):** Rebeca (@alvarezrebeca753-sudo) — carga media; foco UI reciente (tema, progreso)
- **Rama de trabajo:** `rebeca-frontend`
- **Prioridad rúbrica:** P0 (requisito de producto del enunciado, no solo “nice to have”)

## 1. Contexto del producto (para IA y humanos)
Hoy el pipeline post-utterance hace ASR → T5 gramática → **tutor híbrido** (SmolLM2 o reglas) → score → TTS del tutor. SmolLM2 genera la **réplica del role-play**, no un bloque separado de “sugerencias de mejora”. RF-14 en la matriz está **Parcial**: las sugerencias van embebidas o no existen como salida diferenciada.

## 2. Problema u oportunidad
- **Hoy:** `conversation-suggestions.ts` / worker endpoint están orientados a **tutor reply**, no a alternativas de vocabulario/fluidez/naturalidad para el estudiante.
- **Enunciado:** ofrecer sugerencias de comunicación más efectiva como parte del producto.
- **No cumple estricto:** no hay panel/sección de sugerencias diferenciada del chat del tutor.

## 3. Objetivo
Tras cada turno exitoso del estudiante, la UI muestra **sugerencias de comunicación** diferenciadas del mensaje del tutor (al menos vocabulario y/o reformulaciones más naturales), generadas de forma offline (LLM ligero y/o plantillas por escenario con opción generativa).

## 4. Por qué importa
- Completitud del core del enunciado y RF-14.
- Innovación/completitud 10 % y demo pedagógica (“no solo te respondo: te propongo cómo decirlo mejor”).
- Diferencia el producto de un simple chatbot.

## 5. Para qué
El aprendiz hispanohablante entiende **cómo mejorar** su frase en inglés, además de la corrección gramatical T5 y el score de pronunciación.

## 6. Alcance
### Incluye
- Contrato de datos: lista de 1–3 sugerencias (texto EN + etiqueta de tipo: vocabulario | fluidez | naturalidad | contextual).
- Generación offline:
  - **Recomendado híbrido:** plantillas/reglas por escenario + opcional SmolLM2 con prompt distinto al del tutor y timeout corto; si falla, solo plantillas (insignia honesta).
- UI en español para el contenedor; contenido de práctica en inglés.
- Integración en el pipeline de turno **sin** confundir con el mensaje del tutor (componente o sección propia).
- Tests del generador/plantillas y del mapeo a mensajes de UI.
- Actualizar RF-14 a Implementado (o Parcial solo si queda un subtipo fuera de alcance documentado).

### No incluye
- Tutor multi-idioma.
- API cloud de sugerencias.
- Sustituir T5 gramática.
- Gamificación completa.
- Cambiar el default ASR.

## 7. Estado actual en el código (mapa para investigar)
- `app/src/ia/conversation-suggestions.ts` — prompts de tutor, `isPlausibleTutorReply`
- `app/src/ia/inference-worker.ts` / `inference-client.ts` — endpoints de conversación
- `app/src/ia/inference-worker-protocol.ts`
- `app/src/ui/tutor-reply-orchestration.ts` — timeout 10 s + fallback
- `app/src/ui/tutor-reply-engine.ts` — reglas por escenario
- `app/src/ui/practice-scenarios.ts`
- `app/src/ui/PracticeChatPanel.tsx` / `practice-chat-messages.ts`
- `app/src/ui/use-home-practice-turn.ts` / pipeline de utterance
- `app/src/ui/interface-texts.ts`

## 8. Dónde investigar la causa / el diseño actual
1. Leer RF-14 en `matriz-trazabilidad.md`.
2. Seguir un turno exitoso desde `use-home-utterance-pipeline` / practice turn hasta el chat.
3. Ver mensajes del protocolo worker: qué tareas existen ya.
4. Decidir si se reutiliza el pipeline SmolLM2 con **otro** system prompt o se añade task `communicationSuggestions`.
5. Revisar latencia: no debe bloquear TTS del tutor indefinidamente (paralelo o después del tutor con skeleton).

## 9. Enfoques de solución aceptables
1. **Recomendado:**  
   - Tras T5, construir 1–3 sugerencias con motor de reglas (reformulaciones del utterance corregido + tips de escenario).  
   - Opcionalmente enriquecer con SmolLM2 (`max_new_tokens` bajo) y filtrar con validador.  
   - Render en `PracticeChatPanel` o card “Sugerencias para comunicarte mejor”.
2. Solo reglas (sin LLM) — válido para cumplir mínimo si la calidad es buena y se documenta.
3. Solo LLM — arriesgado por latencia/basura; requiere fallback.

Prohibido: hacer pasar sugerencias como si fueran voz del tutor; llamadas de red a APIs de coaching.

## 10. Documentación y referencias obligatorias
- Enunciado: sugerencias vocabulario/fluidez/naturalidad/cultural.
- `app/src/ia/README.md`, `app/src/ui/README.md`
- `REGLAS-DE-CODIGO.md` (textos ES centralizados; sin any; capas)
- `GUIA-CREACION-ISSUES.md`
- Issues #20 (tutor híbrido) como diseño de fallback honesto a imitar

## 11. Plan de implementación sugerido
1. Tipos + función pura `buildCommunicationSuggestions(...)` + tests.
2. (Opcional) endpoint worker + client.
3. Orquestación en pipeline de turno (orden: no romper score/TTS).
4. UI + `interface-texts.ts`.
5. Matriz RF-14 + nota en README Estado.
6. lint/test/build + demo manual.

## 12. Criterios de aceptación
- [ ] Tras un turno con habla válida, hay **sección/panel de sugerencias** distinto del bubble del tutor
- [ ] Al menos un tipo entre vocabulario / fluidez / naturalidad está representado
- [ ] Funciona offline tras cargar modelos (o solo reglas sin red)
- [ ] Fallback honesto si el LLM falla (no UI vacía silenciosa si hay reglas)
- [ ] Tests del builder/validador
- [ ] RF-14 actualizado
- [ ] lint + test + build OK

## 13. Pruebas
- Unitarias: plantillas y filtrado de basura del LLM.
- Manual: escenario aeropuerto; decir frase simple; ver sugerencias + tutor + score.
- Comprobar que no se duplica la línea del tutor como “sugerencia”.

## 14. Definición de hecho (DoD)
- PR `rebeca-frontend` → `main` mergeado.
- Captura o descripción del panel en el comentario de cierre.
- Issue cerrado.

**Labels sugeridos:** `avance-2`, `entrega-final`, `type:story`, `layer:ui`, `layer:ia`, `person:rebeca`, `enhancement`
