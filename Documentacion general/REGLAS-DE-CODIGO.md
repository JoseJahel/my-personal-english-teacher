# Reglas de código

**Alcance:** solo código de la aplicación (`app/`). No define estilo de documentos del curso ni de READMEs.

**Obligatorio** para todo el equipo antes de escribir o revisar código en este repo.
Arquitectura y stack: `README.md` + `app/README.md`. Flujo Git: `CONTRIBUTING.md`.

Idioma del **código y de los comentarios: inglés**. Mensajes de UI visibles al usuario: español centralizado en `ui/interface-texts.ts` (u homólogo), no hardcodeados en componentes.

Este archivo **evoluciona**: si una sesión o un PR fallan por una regla ausente o ambigua, se añade una entrada corta en [Lecciones aprendidas](#4-lecciones-aprendidas). Objetivo del doc: **&lt; ~200 líneas**; fusionar o archivar entradas viejas si crece.

---

## 1. Prácticas y límites

| Regla | Límite / criterio |
|--------|-------------------|
| Tamaño de archivo | **≤ 400 líneas** de código útil. Si se acerca, partir por responsabilidad (no por “mitad arbitraria”). |
| Función / método | **≤ ~50 líneas**. Si necesita scroll largo, extraer helpers puros o subpasos con nombre. |
| Un archivo, un rol | Un concern dominante por archivo (captura, resample, adaptador de modelo, textos de UI…). |
| Dependencias entre capas | Solo **hacia adentro**: `ui` → workers/orquestación → `dsp` / `ia` (dominio) ← `audio` / `storage` (infra). El dominio **no** importa React ni DOM. |
| Tipos | TypeScript estricto. Sin `any`. Errores de dominio tipados (`reason` discriminado), no strings sueltos para ramificar UI. |
| Package manager | **Solo pnpm**. Nunca `package-lock.json` / yarn. |
| Tests | Lógica pura (`dsp/`, helpers, resampler, parsers de salida) con Vitest. No mockear de más; no tests que solo repiten el código. |
| Secretos | Nunca en el repo. `_private/` y `.env` locales. |
| Ejecución del producto | **Solo local / client-side.** Demo en **localhost**. Sin hosting cloud ni backend remoto (ver [§1.1](#11-producto-local-y-offline--límites-no-negociables)). |
| Commits | Conventional Commits, scope, inglés, imperativo, título ≤ 50 caracteres (ver `CONTRIBUTING.md`). |
| PR | Idealmente un módulo / un concern. Actualizar `main` en la rama personal antes de abrir PR. |

### 1.1 Producto local y offline — límites no negociables

La app es una **PWA offline-first** del curso: toda la IA y el audio corren **en el navegador del usuario**. La demo de entrega es **`pnpm dev` / `pnpm preview` en localhost**, no un sitio desplegado.

| Permitido | Prohibido en producto e issues |
|-----------|--------------------------------|
| `localhost` / `127.0.0.1` (Vite dev o preview) | Vercel, Netlify, Cloudflare Pages, Firebase Hosting, S3+CloudFront, etc. |
| Inferencia ONNX en Web Worker (`transformers.js`) | Backend propio, APIs de voz/LLM en la nube, Web Speech API (servidores Google) |
| Cache API / IndexedDB en el navegador | Bases de datos o storage remotos del producto |
| CI de GitHub Actions (lint/test/build del repo) | Presentar CI o un host cloud como “la app en producción” |
| 1.ª descarga de pesos HF al navegador (luego offline) | Requerir red en cada utterance o enviar audio a un servidor |

**Al crear o revisar issues/PRs:** si el ticket implica deploy cloud, URL pública de la app, o servidor de inferencia, es **incorrecto** y se cierra o reescribe antes de implementarlo.

### Comentarios (inglés, mínimos)

- **Sí:** por qué no obvio, invariantes, limitaciones conocidas, contratos entre capas, “no hagas X porque Y”.
- **No:** narrar lo que el código ya dice; banners largos; comentar cada línea; TODOs eternos sin issue/dueño.
- Preferir **nombres claros** a comentarios. Si hace falta un párrafo, el diseño suele estar mal partido.
- JSDoc solo en APIs públicas de capa o funciones no triviales; una o dos frases, no ensayos.

### Nombres e idioma del código

- Identificadores, archivos y comentarios en **inglés** (`startMicrophoneCapture`, no `iniciarCaptura`).
- Textos de producto en español **solo** vía objetos de textos de UI, no literales dispersos en JSX.

---

## 2. Anti-patrones

| Anti-patrón | No hacer | Hacer en su lugar |
|-------------|----------|-------------------|
| **Whack-a-mole** | Parchear un síntoma (if local, timeout mágico, `as any`) y dejar la causa | Reproducir, aislar la capa, arreglar la raíz; añadir regla o test si volverá a pasar |
| **God component / file** | Toda la orquestación + UI + I/O en un solo TSX enorme | Presentación en `ui/`; I/O en `audio`/`storage`/`ia` client; dominio puro aparte |
| **Lógica de negocio en UI** | Cálculos DSP, prompts, reglas de modelo dentro del JSX | Funciones puras en `dsp/` / `ia/`; la UI solo estado y render |
| **Comentario basura** | Bloques de 20+ líneas que repiten el código o historia del PR | Borrar o dejar 1–2 frases de “por qué” |
| **Silent failure** | `catch` vacío, fallar sin estado de UI | Error tipado + mensaje de UI mapeado |
| **Bypass de capas** | `ui` importa transformers o Web Audio a pelo saltándose `ia`/`audio` | Usar el adaptador de la capa |
| **Config mágica duplicada** | IDs de modelo o sample rates copiados en varios sitios | Una fuente de verdad (`model-registry`, constantes exportadas) |
| **Feature parcial mezclada** | Meter TTS + VAD + UI en el mismo PR “ya que estoy” | Un PR por concern; main siempre integrable |
| **Arreglar CI a ciegas** | Commits de prueba en serie sin entender el fallo | Reproducir en local (`pnpm lint/test/build`) y un fix |

---

## 3. Lógica y estructura al construir

1. **Ubicar la capa** antes de crear archivos (`app/src/*/README.md`).
2. **Dominio primero** cuando sea posible: función pura + test, luego adaptador de navegador/worker, luego UI.
3. **Contratos tipados** entre hilo principal y workers (protocolo de mensajes compartido, no shapes duplicados).
4. **Efectos en el borde:** mic, IndexedDB, `transformers.js` solo en infra/orquestación; UI reacciona a resultados.
5. **Carga perezosa** de modelos; progreso y listo comunicados al hilo principal; no bloquear el render con inferencia.
6. **Estados de UI explícitos** (`idle` / `loading` / `done` / `error`…), no booleanos sueltos contradictorios.
7. **Cleanup:** al desmontar o al `stop`, cerrar tracks, contexts, workers; idempotente.
8. **Verificar en local** antes del PR: `pnpm lint`, `pnpm test`, `pnpm exec tsc --noEmit` (y build si toca PWA/worker).

Orden de lectura para una feature nueva:

```text
regla de capa → tipos/contratos → implementación pura → adaptador → UI → tests → commit(s) acotados
```

---

## 4. Lecciones aprendidas

Entradas **solo** si un fallo costó tiempo por regla inexistente o ambigua.

**Formato** (máx. ~5 líneas por entrada):

```text
### YYYY-MM-DD — título corto
- Síntoma: …
- Causa: …
- Regla: … (imperativa, reutilizable)
```

### 2026-07-22 — AudioContext suspendido = mic “sordo”

- **Síntoma:** permiso OK pero waveform plano y ASR sin voz real.
- **Causa:** tras `await getUserMedia`, el `AudioContext` nace `suspended` y no se hacía `resume()`.
- **Regla:** crear el `AudioContext` en el gesto del clic (antes de awaits largos), `await audioContext.resume()` tras cada await del arranque, y no devolver sesión si no queda `running` o no llega el primer frame de PCM.

### 2026-07-22 — Captura sin frames pese a permiso

- **Síntoma:** UI en “escuchando” pero sin voz / “No se detectó voz” con mic real.
- **Causa:** grafo que no tira del procesador, o constraints de canal que devuelven silencio en algunos drivers Windows.
- **Regla:** el audio para ASR se graba con `MediaRecorder` sobre el `MediaStream` crudo (no worklet/ScriptProcessor); el grafo Web Audio solo alimenta visualización. No forzar `channelCount: 1` en constraints.

### 2026-07-22 — Whisper devuelve “(dramatic music)” / “[Music]”

- **Síntoma:** la transcripción no cambia al hablar; sale una etiqueta de música o silencio.
- **Causa:** el modelo recibe audio que no es habla (ruido de grafo, tono, silencio) y alucina tags de no-habla.
- **Regla:** grabar el mic con `MediaRecorder`; tras ASR, si `isNonSpeechTranscript(text)` tratar como “sin habla clara” y no mostrar el tag al usuario ni encadenar gramática. No amplificar ruido (tope de gain); umbral RMS+pico de habla real.

### 2026-07-23 — Onda “viva” que no reacciona a la voz

- **Síntoma:** waveform con trazo constante; nivel no sube al hablar.
- **Causa:** grafo Web Audio incorrecto, `sampleRate` forzado, o `resume()` omitido tras un refactor.
- **Regla:** seguir `app/src/audio/CAPTURE-INVARIANTS.md`. Comentarios `INVARIANT` en `microphone-capture.ts` no se borran sin re-probar mic real (nivel + ASR).

### 2026-07-23 — Captura se “rompe sola” tras refactors

- **Síntoma:** funcionaba; tras partir archivos o tocar UI, deja de detectar voz.
- **Causa:** cleanup StrictMode/HMR con `generation++` en abort descartaba un start en curso; o se perdía un `resume()` al mover código.
- **Regla:** no incrementar generation en unmount; solo en start/stop. Sesión tardía → `idle`, no quedarse en `starting`. Checklist manual en `CAPTURE-INVARIANTS.md` antes de commit que toque `audio/` o la sesión del mic.

### 2026-08-03 — Ticket de “deploy en Vercel” contradice el producto

- **Síntoma:** issue de Entrega Final pedía hosting estático en Vercel / preview cloud de la PWA.
- **Causa:** se tomó al pie de la letra un párrafo antiguo del README (“plan Vercel”) sin contrastar el enunciado del profesor ni la decisión real: **demo localhost, offline, sin servicios en la nube**.
- **Regla:** el producto **no** se despliega en la nube. Issues y PRs solo contemplan localhost + client-side. Antes de abrir un ticket de “infra/hosting”, validar §1.1 de este archivo y `CONTRIBUTING.md` (constraints del producto). README y backlog no deben proponer Vercel/Netlify/etc. como alcance.

### 2026-08-09 — Barge-in sin `spoken_progress` rompe la escena

- **Síntoma:** al interrumpir al tutor a mitad de TTS, el siguiente turno repite la frase entera o trata una respuesta válida como desvío.
- **Causa:** el estado de escena solo se consolidaba al terminar la utterance; no se registraba qué alcanzó a oír el usuario (`cutoffMs` / fragmento).
- **Regla:** toda reproducción de tutor TTS debe reportar `PlayMonoPcmResult` y construir `spoken_progress`; clasificar el turno entrante **solo** con `spoken_text`; persistir pending en la sesión (IndexedDB) para sobrevivir recargas.

---

## Cómo ampliar este documento

1. Confirmar que el problema es de **código** (no de docs del curso).
2. Comprobar que no está ya cubierto arriba.
3. Añadir práctica, anti-patrón **o** lección (una sola, la más reutilizable).
4. Mantener el archivo corto: preferir una regla clara a un relato largo.
