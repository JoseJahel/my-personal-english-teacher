# My Personal English Teacher

PWA offline de práctica de inglés, 100% del lado del cliente: reconocimiento
de voz, corrección gramatical, conversación con el tutor, síntesis de voz y
comparación de pronunciación corren en el propio navegador mediante
`transformers.js`, sin backend ni envío de audio a servidores externos.

## Estado de la app (código actual)

Demo funcional de punta a punta (base Avance 1 + shell Avance 2):

1. Elegir un **escenario guiado** (restaurante, aeropuerto, entrevista).
2. Captura de micrófono real (`audio/open-microphone-stream.ts` +
   `audio/microphone-capture.ts`).
3. Waveform y nivel en vivo desde `AnalyserNode` (`ui/waveform-canvas.ts`).
4. Al detener: MediaRecorder → decode mono → **espectrograma + pitch track** →
   gate de energía → resample 16 kHz → Whisper → T5 → tutor híbrido → score → TTS.
5. **Conversación híbrida**: SmolLM2 genera la respuesta del tutor con memoria
   de los últimos 4 turnos, contra un timeout de 10 s; si no responde a tiempo
   o produce basura, se usa la línea del motor de reglas del escenario
   (`ui/tutor-reply-engine.ts`), marcada como respaldo en el chat.
6. **Score de pronunciación**: TTS de la frase (corregida) → MFCC + DTW → 0–100.
7. **TTS SpeechT5** reproduce la línea del tutor.
8. Paneles: transcripción, gramática, LLM tutor, voz, pronunciación, historial
   de práctica (IndexedDB).

Orquestación en `ui/use-home-screen-session.ts`; presentación en
`ui/HomeScreen.tsx` + `ScenarioPicker` / `PracticeChatPanel`; `App.tsx` solo
ensambla el hook con la vista (y enruta a la pantalla de banco de pruebas ASR
en desarrollo, ver más abajo).

Captura: **MediaRecorder** sobre el `MediaStream` del SO para ASR; grafo Web
Audio solo para visualización. Detalle e invariantes:
`src/audio/CAPTURE-INVARIANTS.md`.

## Banco de pruebas ASR (solo desarrollo)

Pantalla accesible en `#asr-benchmark`, gateada por `import.meta.env.DEV` en
`App.tsx` / `src/app-routing.ts` — invisible sin el hash y ausente del bundle
de producción. Permite grabar fixtures de voz propias (guardadas en una
IndexedDB separada, `storage/benchmark-fixture-store.ts`, borrable sin tocar
el progreso del estudiante), correr los 4 candidatos Whisper de
`ia/model-registry.ts` contra los backends WASM (q8) y WebGPU (fp32), y
comparar WER (Levenshtein, `ia/word-error-rate.ts`) y latencia por
combinación, con export a CSV/JSON. Las fixtures nunca se suben a Git; solo
salen del navegador vía export/import JSON manual.

## Puesta en marcha (Windows)

**Requisito:** Node.js `22 LTS` (ver `.nvmrc`). Descárgalo desde
[nodejs.org](https://nodejs.org) si no lo tienes instalado.

**Opción A — automática (recomendada):** haz doble clic en
`setup-windows.bat`. El script verifica que Node.js esté instalado, resuelve
pnpm automáticamente (usando Corepack si está disponible o, si no, instalando
pnpm con el instalador oficial standalone) e instala las dependencias. Al
terminar, ejecuta `pnpm dev` (o haz doble clic en
`start-development-server.bat`) y abre <http://localhost:5173> en el
navegador.

**Opción B — manual:**

Las versiones recientes de Node.js ya no incluyen Corepack, así que instala
pnpm primero con el instalador oficial standalone:

```powershell
iwr https://get.pnpm.io/install.ps1 -useb | iex
```

o, alternativamente, con winget:

```powershell
winget install pnpm.pnpm
```

Y luego:

```bash
pnpm install
pnpm dev
```

> pnpm 10 usa automáticamente la versión fijada en `packageManager` dentro de
> `package.json`, sin pasos adicionales.

**Scripts disponibles:** `pnpm dev` (servidor de desarrollo), `pnpm build`
(build de producción), `pnpm test` (suite de pruebas), `pnpm lint` (análisis
estático con ESLint) y `pnpm format` (formateo con Prettier). El detalle
completo de todos los scripts está más abajo, en la sección
"Scripts disponibles".

> **Nota:** pnpm es el único gestor de paquetes admitido en este proyecto.
> npm y yarn quedan descartados: ningún script, documento ni lockfile del
> repositorio depende de ellos.

## Requisitos

- Node.js `>=22` (ver `.nvmrc`).
- [pnpm](https://pnpm.io/) como único y exclusivo gestor de paquetes del
  proyecto: todo script, documento y lockfile de este repositorio se apoya
  solamente en él.

## Scripts disponibles

| Script              | Descripción                                          |
| ------------------- | ---------------------------------------------------- |
| `pnpm dev`          | Servidor de desarrollo con recarga en caliente.      |
| `pnpm build`        | Verificación de tipos y build de producción.         |
| `pnpm preview`      | Sirve localmente el build de producción.             |
| `pnpm lint`         | Ejecuta ESLint sobre todo el código fuente.          |
| `pnpm format`       | Formatea el código con Prettier.                     |
| `pnpm format:check` | Verifica el formato sin modificar archivos.          |
| `pnpm test`         | Ejecuta la suite de pruebas con Vitest una sola vez. |
| `pnpm test:watch`   | Ejecuta Vitest en modo observador.                   |

## Arquitectura

El código de `src/` está organizado en capas con dependencia únicamente hacia
adentro, dejando el dominio libre de detalles de infraestructura:

| Capa | Rol hoy | README de capa |
|------|---------|----------------|
| **`ui/`** | Presentación React + escenarios/chat + sesión (mic → ASR → gramática → tutor híbrido → turno de chat); paleta de diseño en tokens de `index.css`; pantalla de banco de pruebas ASR (solo dev). Textos ES en `interface-texts.ts`. | `ui/README.md` |
| **`ia/`** | Whisper (catálogo de 4 candidatos evaluables), T5, SpeechT5, SmolLM2 (conversación híbrida activa), worker y cliente tipado. | `ia/README.md` |
| **`dsp/`** | Energía + YIN + MFCC + DTW + score de pronunciación. | `dsp/README.md` |
| **`audio/`** | getUserMedia, Analyser, MediaRecorder, resample. | `audio/README.md` |
| **`storage/`** | IndexedDB de progreso: sesiones y turnos (textos/scores, sin audio) + IndexedDB separada de fixtures del banco de pruebas ASR (solo dev, con audio crudo). | `storage/README.md` |

Reglas de implementación del equipo: `../Documentacion general/REGLAS-DE-CODIGO.md`.

## Nota sobre versiones de modelos

`ia/model-registry.ts` fija la revisión de cada modelo en `'main'` durante el
desarrollo. Antes de la Entrega Final del proyecto, cada modelo debe anclarse a
un commit específico del Hub de Hugging Face para asegurar una build
reproducible. Hoy ASR, gramática, TTS y SmolLM2 tienen adaptadores en el worker.

El ASR además cataloga varios candidatos Whisper evaluables
(`asrModelCandidates`); el banco de pruebas de desarrollo (`#asr-benchmark`)
mide WER y latencia por candidato × backend para decidir cuál queda fijo antes
de la Entrega Final. El default de producción sigue siendo `whisper-tiny.en`
hasta tener esos números.

## PWA y caché de modelos

La aplicación se registra como Progressive Web App mediante `vite-plugin-pwa`
(`registerType: 'autoUpdate'`). Los assets de la propia aplicación (JS, CSS,
HTML, iconos) se precachean con Workbox, pero los pesos de los modelos de IA
(`.onnx` y similares) están explícitamente excluidos de ese precacheo: al ser
archivos potencialmente enormes, `transformers.js` los descarga y gestiona por
su cuenta a través de la Cache API del navegador.
