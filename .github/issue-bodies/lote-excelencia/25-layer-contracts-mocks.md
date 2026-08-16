## 0. Metadatos
- **Hito:** Entrega Final
- **Capa principal:** ui
- **Capas secundarias:** ia, audio
- **Requisito matriz / enunciado:** arquitectura modular del técnico; habilita #70 (ensayo sin modelos)
- **Tipo:** tech-debt
- **Asignado (reparto equitativo):** Jahel (@JoseJahel) — lote de laboratorio y defensa A2/Final pedido por Jahel; no redistribuye #57–#79
- **Rama de trabajo:** `jahel-frontend`
- **Prioridad rúbrica:** P1 (desbloquea demo de aula y tests de orquestación)

## 1. Contexto del producto (para IA y humanos)
Las capas ya existen (`ui` → `ia`/`dsp` ← `audio`/`storage`). El cliente de inferencia y la captura son adaptadores concretos. #70 pide un ensayo de UI sin mic ni descarga. Hoy `#shell-preview` es un **fixture estático**, no la `HomeScreen` real con dependencias falsas.

## 2. Problema u oportunidad
- No hay puertos tipados inyectables: `useHomeScreenSession` construye el cliente y el mic por dentro.
- Un mock “de pantalla” no prueba el orquestador. Un mock **del contrato** sí: el mismo hook, sin transformers ni `getUserMedia`.
- Se mantienen las carpetas de capa actuales (`ui/`, `ia/`, `dsp/`, `audio/`, `storage/`).

## 3. Objetivo
Cuando esté cerrado, `HomeScreen` / `useHomeScreenSession` pueden montarse con **puertos** `SpeechCapture` e `InferencePort` (nombres a fijar en el PR) y hay mocks que recorren un turno falso en &lt; 1 s, sin red.

## 4. Por qué importa
- #70 deja de ser un maniquí y pasa a ser la app.
- Tests de sesión sin jsdom-mic ni worker ONNX.
- El ensayo usa el hook real, no solo un fixture estático.

## 5. Para qué
Demo de aula sin 1 GB; CI más cercano al turno real.

## 6. Alcance
### Incluye
- Interfaces mínimas en `ui/` o `shared` de app (sin crear un monorepo): p. ej. transcribe / correctGrammar / generateTutorReply / synthesizeSpeech / start-stop capture.
- Adaptadores que envuelven `InferenceClient` y `startMicrophoneCapture` **existentes**.
- Mocks deterministas (textos ES/EN fijos de restaurante).
- Cablear `#shell-preview` **o** un hash `#practice-mock` que monte `HomeScreen` con mocks (`app-routing.ts`, solo DEV).
- Tests: un turno mock cambia estados de chat/score sin importar `@huggingface/transformers`.

### No incluye
- Hosting cloud. El ensayo es hash DEV (`#shell-preview` o `#practice-mock`).
- Reescribir `dsp/` como servicios.
- Cambiar el protocolo del worker salvo extraer tipos que ya están en `inference-worker-protocol.ts`.
- Hacer el trabajo visual de #70 (textos, layout): este ticket es el enchufe; #70 consume el enchufe.

## 7. Estado actual en el código (mapa para investigar)
- `app/src/ui/use-home-screen-session.ts`
- `app/src/ui/home-inference-client.ts`, `ia/inference-client.ts`, `ia/inference-worker-protocol.ts`
- `app/src/audio/microphone-capture.ts`
- `app/src/app-routing.ts` — `#shell-preview*`
- `app/src/ui/shell-preview-fixture.ts`, `ShellPreviewScreen.tsx`
- #70 — `.github/issue-bodies/lote-excelencia/14-mock-demo.md`

## 8. Dónde investigar la causa / el diseño actual
1. Ver qué instancia `ensureHomeInferenceClient` y `startMicrophoneCapture`.
2. Listar métodos que el turno realmente llama.
3. Extraer interfaz *mínima* (no un dios).
4. Montar HomeScreen en test con mocks.

## 9. Enfoques de solución aceptables
1. **Recomendado:** parámetros opcionales del hook (`deps?: HomeSessionPorts`) con default = adaptadores reales (cero cambio en `App.tsx` de producción).
2. Aceptable: factory `createHomeScreenSession(ports)`.
3. Prohibido: importar transformers desde `ui/`; mock que no implemente el mismo tipo; cloud.

## 10. Documentación y referencias
- `app/README.md` arquitectura, `ui/README.md`, `REGLAS-DE-CODIGO.md` (capas, ≤400 líneas)
- #70, #24 (split del hook)

## 11. Plan de implementación sugerido (pasos)
- [ ] Tipos del puerto
- [ ] Adaptadores reales
- [ ] Mocks + test de un turno
- [ ] Hash DEV
- [ ] Nota en `ui/README.md` para #70
- [ ] `cd app; pnpm lint; pnpm test; pnpm build`

## 12. Criterios de aceptación
- [ ] `HomeScreen` real corre con mocks en DEV
- [ ] Test de orquestación sin transformers
- [ ] Producción (`App` sin hash) no cambia de comportamiento
- [ ] Archivos ≤ 400 líneas (partir si el hook crece)
- [ ] lint + test + build
- [ ] PR `jahel-frontend` → `main`

## 13. Pruebas
Vitest del hook/orquestación. Manual: `#practice-mock` o preview hash, clic Hablar simulado, chat avanza.

## 14. Definición de hecho (DoD)
En `main`. Comentario con el hash y el test añadido. Coordinar con César (#70).
