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
   Si no hay habla usable, el ASR devolvió un tag de no-habla o el texto es
   degenerado, **no** se muestra un 0–100 (issue #75): estado `not-evaluated`
   y copy honesto, no “mala pronunciación”.
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

## Dos modos de ejecución

El proyecto se levanta de dos formas, y no son intercambiables:

| Modo | Comando | Cuándo usarlo | PWA |
| --- | --- | --- | --- |
| Desarrollo | `pnpm dev` o `start-development-server.bat` | Programar día a día, con recarga en caliente | No |
| Producción local | `pnpm build` + `pnpm preview` | Verificación offline y demo del curso | Sí |

La diferencia es el **service worker**: `vite-plugin-pwa` lo genera únicamente
durante el build. En `pnpm dev` no existe, por lo que el app shell (HTML, JS,
CSS) no queda precacheado y la aplicación no es instalable.

Esto importa al comprobar el comportamiento offline. En modo desarrollo el
servidor local sigue respondiendo aunque no haya internet, porque las
peticiones nunca salen de la máquina; una prueba hecha así parecería funcionar
sin demostrar nada sobre la PWA. La verificación offline y la demo del curso
deben hacerse siempre sobre `pnpm preview`.

## Checklist de demo offline

Procedimiento reproducible para comprobar que la práctica sigue operando sin
red. Verificado en Chromium (Edge) sobre Windows.

1. **Compilar y servir en local.**

```powershell
   cd app
   pnpm build
   pnpm preview
```

   Abrir la URL que imprime el comando (por defecto
   <http://localhost:4173>). No se necesita HTTPS: los navegadores tratan
   `localhost` como contexto seguro, de modo que el service worker se
   registra y la aplicación es instalable sin certificados.

2. **Precargar los modelos.** Con conexión activa, esperar a que el aviso de
   la pantalla principal indique que todos los modelos están guardados.
   Reconocimiento de voz y corrección gramatical se precargan al abrir;
   SmolLM2 requiere seleccionar un escenario y SpeechT5 requiere completar un
   turno hablado. La primera descarga supera 1 GB y puede tardar varios
   minutos.

3. **Verificar que ya no hay tráfico de modelos.** Recargar con `F5` (nunca
   con `Ctrl+Shift+R`, que fuerza al navegador a ignorar los cachés) y
   comprobar en DevTools → Network, filtrando por `onnx`, que no aparece
   ninguna petición.

4. **Instalar la aplicación.** Pulsar el icono de instalación de la barra de
   direcciones. La aplicación queda disponible en el menú de inicio y se abre
   en ventana propia.

5. **Cortar el servidor.** Detener `pnpm preview` con `Ctrl+C`. Opcionalmente,
   activar además el modo Offline en DevTools → Network.

6. **Comprobar el pipeline completo** en la aplicación instalada, sin
   servidor: la ventana abre, el micrófono captura, Whisper transcribe, T5
   corrige la gramática, el tutor responde y SpeechT5 reproduce la voz. El
   historial de práctica se sigue guardando en IndexedDB.

Si el paso 6 falla, la causa más probable es que el paso 2 quedara incompleto:
un modelo que nunca se cargó no está en caché y no puede cargarse sin red.

## Perfil latencia vs precisión (issue #61)

El default de **entrega / producción** no cambia: `whisper-small.en` (perfil
**precisión**), elegido por WER 0.000 en el banco del 2026-07-29. En WebGPU
ronda **~3.4 s/frase** y **no cumple** el objetivo del curso de &lt; 2 s.

Para una demo que prioriza rapidez existe un **perfil latencia** first-class:

| Cómo | Qué carga |
|------|-----------|
| `pnpm dev:latency` o `start-latency-profile.bat` | `tiny-en` (`VITE_ASR_PROFILE=latency` vía `.env.latency`) |
| `pnpm build:latency` y luego `pnpm preview` | Mismo perfil en el build local |
| `VITE_ASR_MODEL=base-en pnpm dev` | Fuerza un candidato concreto (gana sobre el perfil) |

Sin esas variables, `pnpm dev` / `pnpm build` siguen en **small-en**.

**No hay cifra nueva de latencia para `tiny-en` en este ticket.** El bench
2026-07-29 lo marcó como “rápido” sin milisegundos publicados. Re-medir en el
hardware de aula:

1. `pnpm dev`
2. Abrir `#asr-benchmark`
3. Correr `tiny-en` × WebGPU (y WASM si aplica) sobre las fixtures de referencia
4. Anotar media de latencia en `Documentacion general/reporte-verificacion.md` §5

Hasta esa re-medición **no se afirma** que el perfil latencia cumpla &lt; 2 s.

## Entrega local, sin despliegue en la nube

La aplicación se sirve y se demuestra únicamente desde `localhost`. No hay
backend, ni hosting en Vercel, Netlify, Cloudflare Pages u otro servicio
remoto, ni se planea añadirlo: el enunciado del curso exige inferencia
client-side y capacidad offline, y publicar el producto en un host externo
diluiría esa demostración. GitHub Actions se usa solo como herramienta de
calidad de código (lint, typecheck, tests y build), no como runtime del
producto. Ver §1.1 de `../Documentacion general/REGLAS-DE-CODIGO.md`.

Por defecto `pnpm dev` y `pnpm preview` escuchan solo en `localhost` y no se
exponen a la red local.

## Requisitos

- Node.js `>=22` (ver `.nvmrc`).
- [pnpm](https://pnpm.io/) como único y exclusivo gestor de paquetes del
  proyecto: todo script, documento y lockfile de este repositorio se apoya
  solamente en él.

## Scripts disponibles

| Script              | Descripción                                          |
| ------------------- | ---------------------------------------------------- |
| `pnpm dev`          | Servidor de desarrollo con recarga en caliente.      |
| `pnpm dev:latency`  | Igual que `dev`, con perfil ASR de latencia (`tiny-en`). |
| `pnpm build`        | Verificación de tipos y build de producción.         |
| `pnpm build:latency`| Build de producción con perfil ASR de latencia.      |
| `pnpm preview`      | Sirve localmente el build de producción.             |
| `pnpm lint`         | Ejecuta ESLint sobre todo el código fuente.          |
| `pnpm format`       | Formatea el código con Prettier.                     |
| `pnpm format:check` | Verifica el formato sin modificar archivos.          |
| `pnpm test`         | Ejecuta la suite de pruebas con Vitest una sola vez. |
| `pnpm test:watch`   | Ejecuta Vitest en modo observador.                   |
| `pnpm test:e2e`     | Playwright: smoke + screenshots del shell Atelier.   |
| `pnpm test:e2e:update` | Regenera baselines visuales del shell.            |

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

`ia/model-registry.ts` ancla cada modelo a un **commit SHA** del Hub de Hugging
Face (build reproducible). ASR, gramática, TTS/vocoder y SmolLM2 tienen
adaptadores en el worker.

El ASR cataloga varios candidatos Whisper (`asrModelCandidates`); el banco de
pruebas de desarrollo (`#asr-benchmark`) mide WER y latencia por candidato ×
backend. El default de producción es **`whisper-small.en`** (bench 2026-07-29):
mejor WER y ~3.4 s/frase con **WebGPU**; en WASM no es viable (~11 s).

## PWA y caché de modelos

La aplicación se registra como Progressive Web App mediante `vite-plugin-pwa`
(`registerType: 'autoUpdate'`). Los assets de la propia aplicación (JS, CSS,
HTML, iconos) se precachean con Workbox, pero los pesos de los modelos de IA
(`.onnx` y similares) están explícitamente excluidos de ese precacheo: al ser
archivos potencialmente enormes, `transformers.js` los descarga y gestiona por
su cuenta a través de la Cache API del navegador.

### Límites offline conocidos

Todo lo descrito aquí fue verificado sobre `@huggingface/transformers` 3.8.1
en Chromium (Edge), con el servidor local de desarrollo.

**La primera visita necesita conexión.** Los pesos superan 1 GB en total. Solo
los dos archivos ONNX de `whisper-small.en` suman ~968 MB (352.839.389 y
615.402.140 bytes) y `t5-base-grammar-correction` añade ~110 MB; a eso se
suman SpeechT5, el vocoder HiFiGAN y SmolLM2. La descarga ocurre una única vez
y queda en el caché `transformers-cache` de la Cache API.

**Los modelos no se cargan todos al abrir la aplicación.** Reconocimiento de
voz y corrección gramatical se precargan al montar la pantalla; SmolLM2 se
precarga al seleccionar un escenario; SpeechT5 se carga en el primer turno con
respuesta hablada. Una sesión en la que solo se abre la aplicación y no se
habla deja parte de los modelos sin descargar, y por lo tanto **no** habilita
todavía el uso sin conexión.

**Aviso de disponibilidad offline.** La pantalla principal muestra si el
navegador ya puede practicar sin conexión, distinguiendo tres situaciones:
ningún modelo en caché, algunos en caché, o todos en caché. El estado se
deriva de un historial propio en `localStorage`
(`storage/model-load-history.ts`), no del contenido del caché de
`transformers.js`: en la versión 3.8.1 una lectura desde caché emite los
mismos eventos de progreso con bytes que una descarga de red, por lo que el
propio evento no permite distinguir el origen. El navegador borra
`localStorage` y la Cache API en una sola operación al limpiar los datos del
sitio, de modo que el historial no puede afirmar que un modelo está en caché
cuando los pesos ya no existen.

**La recarga forzada invalida el caché.** `Ctrl+Shift+R` instruye al navegador
a ignorar los cachés, incluido el de `transformers.js`, y provoca la descarga
completa de los modelos. Para comprobar el comportamiento offline debe usarse
la recarga normal (`F5` o `Ctrl+R`), o directamente el modo sin conexión de
las herramientas de desarrollo.

**Sin despliegue en la nube.** La aplicación se ejecuta y se verifica
únicamente en `localhost`, conforme a §1.1 de
`../Documentacion general/REGLAS-DE-CODIGO.md`.
