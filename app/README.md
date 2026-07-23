# My Personal English Teacher

PWA offline de práctica de inglés, 100% del lado del cliente: el reconocimiento
de voz y la corrección gramatical corren en el propio navegador mediante
`transformers.js`, sin backend ni envío de audio a servidores externos.
Síntesis de voz, sugerencias conversacionales y comparación de pronunciación
están en el diseño del proyecto pero **aún no implementadas** en esta carpeta.

## Estado de la app (código actual)

Demo funcional de punta a punta:

1. Captura de micrófono real (`audio/open-microphone-stream.ts` +
   `audio/microphone-capture.ts`).
2. Waveform y nivel en vivo desde `AnalyserNode` (`ui/waveform-canvas.ts`).
3. Al detener: MediaRecorder → decode mono → gate de energía (`dsp/`) →
   resample 16 kHz → Whisper → filtro de tags no-habla → T5 gramática.
4. Resultados en paneles de transcripción y corrección.

Orquestación en `ui/use-home-screen-session.ts`; presentación en
`ui/HomeScreen.tsx`; `App.tsx` solo ensambla el hook con la vista.

Captura: **MediaRecorder** sobre el `MediaStream` del SO para ASR; grafo Web
Audio solo para visualización. Detalle e invariantes:
`src/audio/CAPTURE-INVARIANTS.md`.

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
| **`ui/`** | Presentación React + orquestación de sesión (mic → ASR → gramática). Textos ES en `interface-texts.ts`. | `ui/README.md` |
| **`ia/`** | Registry, Whisper, T5, Web Worker y cliente tipado. | `ia/README.md` |
| **`dsp/`** | Energía / gate de habla (puro). YIN/MFCC/DTW previstos. | `dsp/README.md` |
| **`audio/`** | getUserMedia, Analyser, MediaRecorder, resample. | `audio/README.md` |
| **`storage/`** | Reservado; IndexedDB aún no implementado. | `storage/README.md` |

Reglas de implementación del equipo: `../Documentacion general/REGLAS-DE-CODIGO.md`.

## Nota sobre versiones de modelos

`ia/model-registry.ts` fija la revisión de cada modelo en `'main'` durante el
desarrollo. Antes de la Entrega Final del proyecto, cada modelo debe anclarse a
un commit específico del Hub de Hugging Face para asegurar una build
reproducible. Hoy solo ASR y gramática tienen adaptadores en el worker; TTS y
sugerencias están registrados pero no cableados.

## PWA y caché de modelos

La aplicación se registra como Progressive Web App mediante `vite-plugin-pwa`
(`registerType: 'autoUpdate'`). Los assets de la propia aplicación (JS, CSS,
HTML, iconos) se precachean con Workbox, pero los pesos de los modelos de IA
(`.onnx` y similares) están explícitamente excluidos de ese precacheo: al ser
archivos potencialmente enormes, `transformers.js` los descarga y gestiona por
su cuenta a través de la Cache API del navegador.
