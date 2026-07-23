# My Personal English Teacher

PWA offline de práctica de inglés, 100% del lado del cliente: reconocimiento de
voz, corrección gramatical, sugerencias de conversación y síntesis de voz
corren en el propio navegador mediante `transformers.js`, sin backend ni envío
de datos a servidores externos.

La estructura y las herramientas del proyecto están configuradas. Ya existe
una demo funcional de captura de micrófono con visualización de waveform en
tiempo real (la captura vive en la capa `audio/`,
`audio/microphone-capture.ts`) y un primer prototipo del pipeline de práctica
funcionando de punta a punta: al detener la captura, el audio se transcribe
con Whisper (`Xenova/whisper-tiny.en` vía `transformers.js`) y el texto
transcrito se corrige gramaticalmente con un modelo T5
(`Xenova/t5-base-grammar-correction`), ambos en un Web Worker dedicado
(`ia/inference-worker.ts`), y los dos resultados se muestran en pantalla en
paneles separados. `App.tsx` es un shell fino: la sesión vive en
`ui/use-home-screen-session.ts` y la presentación en `ui/HomeScreen.tsx`
(onda + barra de nivel en vivo). La captura de voz usa `MediaRecorder` sobre
el micrófono real; el grafo Web Audio solo alimenta la visualización. El
resto de las funcionalidades de práctica (síntesis de voz, sugerencias de
conversación, comparación de pronunciación) todavía no están implementadas.

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

- **`ui/`** — presentación React y orquestación de pantalla (sin I/O de
  micrófono ni `transformers.js` directos). Textos en español en
  `ui/interface-texts.ts`; ver `ui/README.md`.
- **`ia/`** — dominio y orquestación de modelos de `transformers.js` (ASR →
  corrección gramatical → sugerencias → TTS). Ver `ia/model-registry.ts`.
- **`dsp/`** — dominio puro de procesamiento de señales (funciones puras,
  sin dependencias externas). Ver `dsp/signal-energy.ts`.
- **`audio/`** — infraestructura de captura y adaptación de audio del
  navegador (Web Audio API).
- **`storage/`** — infraestructura de persistencia local con IndexedDB.

Cada carpeta incluye un `README.md` con el detalle de su responsabilidad y los
archivos previstos a futuro.

## Nota sobre versiones de modelos

`ia/model-registry.ts` fija la revisión de cada modelo en `'main'` durante el
desarrollo. Antes de la Entrega Final del proyecto, cada modelo debe anclarse a
un commit específico del Hub de Hugging Face para asegurar una build
reproducible.

## PWA y caché de modelos

La aplicación se registra como Progressive Web App mediante `vite-plugin-pwa`
(`registerType: 'autoUpdate'`). Los assets de la propia aplicación (JS, CSS,
HTML, iconos) se precachean con Workbox, pero los pesos de los modelos de IA
(`.onnx` y similares) están explícitamente excluidos de ese precacheo: al ser
archivos potencialmente enormes, `transformers.js` los descarga y gestiona por
su cuenta a través de la Cache API del navegador.
