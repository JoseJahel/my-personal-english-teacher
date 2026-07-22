# My Personal English Teacher

Proyecto universitario del curso **Señales y Sistemas**. Una PWA (Progressive Web App) offline para práctica conversacional de inglés, donde toda la inteligencia artificial se ejecuta del lado del cliente, directamente en el navegador.

## Descripción

La aplicación permite practicar conversación en inglés sin depender de servidores externos: reconocimiento de voz, corrección gramatical, síntesis de voz y retroalimentación de pronunciación corren localmente usando modelos de Hugging Face ejecutados con `transformers.js` sobre ONNX Runtime Web.

El componente de Procesamiento Digital de Señales (DSP) es central al proyecto: se extraen features acústicas (pitch mediante el algoritmo YIN, energía, formantes, MFCC) en tiempo real con la Web Audio API, se generan visualizaciones (waveform, espectrograma, pitch tracking) y se compara la pronunciación del usuario contra una referencia mediante análisis de esas señales.

## Características principales

- Reconocimiento de voz (ASR) client-side con Whisper (`Xenova/whisper-tiny.en`).
- Síntesis de voz (TTS) client-side con SpeechT5 (`Xenova/speecht5_tts`).
- Corrección gramatical con un modelo T5 cuantizado (`vennify/t5-base-grammar-correction`, consumido vía su port ONNX `Xenova/t5-base-grammar-correction`).
- Generación de sugerencias conversacionales con SmolLM2-360M-Instruct (a integrarse en el Avance 2).
- Extracción de features acústicas: pitch (algoritmo YIN), energía, formantes, MFCC.
- Detección de actividad de voz (VAD) por energía para el corte automático de captura.
- Visualizaciones en tiempo real: waveform, espectrograma, pitch tracking.
- Corrección de pronunciación por comparación de señales contra una referencia.
- Funcionamiento 100% offline una vez cargados los modelos (PWA).

**Extensiones planificadas (innovación):**

- Análisis de progreso con señales: evolución del pitch y de los puntajes de pronunciación por sesión, persistido en IndexedDB.
- Features DSP adicionales: filtrado adaptativo de ruido y análisis de formantes más fino.
- Gamificación: rachas y logros.

El soporte multi-idioma se descartó explícitamente por ser incompatible con la elección de `Xenova/whisper-tiny.en`, que solo reconoce inglés.

## Stack tecnológico

- **Frontend:** React + TypeScript, con Vite como build tool y Tailwind CSS para estilos.
- **IA en navegador:** transformers.js (`@huggingface/transformers`) sobre ONNX Runtime Web.
- **Modelos:**
  - ASR: `Xenova/whisper-tiny.en` (~40 MB cuantizado).
  - TTS: `Xenova/speecht5_tts`.
  - Corrección gramatical: `vennify/t5-base-grammar-correction`, consumido vía su port ONNX `Xenova/t5-base-grammar-correction`.
  - Sugerencias conversacionales: `SmolLM2-360M-Instruct` (ONNX, ~250 MB cuantizado; se integra en el Avance 2).
- **DSP / Audio:** Web Audio API mediante AudioWorklet; detección de pitch con el algoritmo YIN; extracción de MFCC de implementación propia del equipo (FFT → banco de filtros mel → DCT), energía y formantes.
- **Comparación de pronunciación:** alineación DTW (Dynamic Time Warping) + distancia euclidiana de features frame a frame, contra una referencia generada con el propio TTS (SpeechT5).
- **Testing:** Vitest.
- **Almacenamiento offline:** Cache API para los pesos de los modelos + IndexedDB para sesiones y progreso del usuario.
- **Demo/despliegue:** localhost para la demo en vivo; deploy estático en Vercel (HTTPS, plan gratuito) para pruebas de la PWA instalable durante el desarrollo.
- **Tipo de aplicación:** PWA (Progressive Web App) offline-first, con Service Workers.

## Decisiones de arquitectura

### React sobre Vanilla JS

La aplicación combina estado conversacional, audio en tiempo real y varias visualizaciones simultáneas (waveform, espectrograma, pitch tracking), algo difícil de sostener con Vanilla JS a medida que crece la base de código. Dividir la interfaz en componentes aislados (chat, visualizador, panel de feedback) permite que un equipo de cinco personas trabaje en ramas separadas con menos conflictos de merge.

### TypeScript sobre JavaScript

Con cinco personas trabajando en ramas separadas, los tipos convierten los errores de contrato entre módulos (features acústicas, mensajes de workers, pipeline de IA) en errores de compilación en vez de fallos en la demo; React y transformers.js publican tipos oficiales. El build es Vite: es el estándar actual del ecosistema React y Create React App está deprecado. Los tests usan Vitest por su integración nativa con Vite.

### whisper-tiny.en sobre whisper-base / whisper-small

`whisper-tiny.en` pesa aproximadamente 40 MB cuantizado, frente a los ~75 MB de `whisper-base` y los ~250 MB de `whisper-small`. La latencia de inferencia en el navegador crece con el tamaño del modelo, y la meta del proyecto es entregar feedback en menos de 2 segundos sobre hardware típico de un estudiante; la documentación del curso recomienda explícitamente modelos tiny para no comprometer esa latencia. Si la precisión del ASR no alcanza la meta propuesta (>85%), migrar a `whisper-base` queda como un cambio de una sola línea de configuración.

### whisper-tiny.en sobre whisper-tiny multilingüe

Al mismo peso (~40 MB), la variante entrenada solo en inglés ofrece mejor precisión para el único idioma que la app reconoce, acercando la meta de >85% con el modelo más pequeño. La extensión multi-idioma se descartó explícitamente, así que no se sacrifica nada a cambio.

### vennify/t5-base-grammar-correction sobre hassaanik/grammar-correction-model

Se optó por `vennify/t5-base-grammar-correction` por ser el modelo de corrección gramatical más usado y mejor documentado de su categoría, con una conversión ONNX compatible con transformers.js ya publicada en el Hub de Hugging Face (`Xenova/t5-base-grammar-correction`, la que efectivamente consume la aplicación), lo que elimina el riesgo de integración. La alternativa evaluada no cuenta con un port ONNX verificado, y descubrir ese problema recién durante la implementación habría puesto en riesgo la entrega del Avance 1.

### YIN sobre autocorrelación simple

YIN es un refinamiento del método de autocorrelación clásico que incorpora una función de diferencia normalizada acumulativa y un umbral absoluto, lo que reduce drásticamente los errores de octava, la falla más común al rastrear el pitch de la voz humana. Su adopción además aporta contenido propio de procesamiento de señales al marco teórico del curso, que pondera en un 40% la calidad técnica del trabajo.

### MFCC de implementación propia sobre librería (Meyda)

La extracción de MFCC (FFT, banco de filtros mel, DCT) es contenido nuclear del curso y del marco teórico, y la calidad técnica pondera un 40% de la evaluación; delegarla a una librería dejaría el corazón DSP del proyecto en una caja negra. Meyda se usa únicamente en los tests unitarios, como referencia para validar que la implementación propia produce coeficientes correctos.

### Caché híbrida (Cache API + IndexedDB) sobre una sola tecnología

transformers.js cachea los pesos de los modelos mediante la Cache API por defecto, sin código adicional de por medio, y esa API está pensada para pares request/response, no para datos estructurados. Las sesiones de práctica, el historial de conversación y las métricas de progreso, en cambio, son datos consultables que encajan naturalmente en IndexedDB. Forzar toda la persistencia a una sola de las dos tecnologías implicaría usar cada una para un caso que no le corresponde.

### SmolLM2-360M-Instruct sobre variantes de Phi-2 para sugerencias conversacionales

`SmolLM2-360M-Instruct` publica pesos ONNX oficiales de HuggingFaceTB en el propio repositorio del modelo, de aproximadamente 250 MB cuantizados, mientras que la primera generación de SmolLM carece de conversión ONNX oficial; SmolLM2 es la iteración mejorada del mismo modelo, al mismo tamaño. Ese tamaño cabe en el presupuesto de descarga y de memoria del navegador junto con Whisper, T5 y SpeechT5. Phi-2, con 2.7B de parámetros y más de 1.5 GB cuantizado, pondría en riesgo tanto la carga offline como la demo en equipos modestos. Este módulo se integra recién en el Avance 2, pero la decisión se fija desde ahora para no comprometer la arquitectura general del sistema.

### transformers.js directo desde el prototipo, sin fase previa con Web Speech API

La Web Speech API de Chrome delega el reconocimiento de voz en los servidores de Google, por lo que un prototipo construido sobre ella no cumpliría con la restricción client-side/offline del proyecto y representaría trabajo desechable. El Avance 1 exige explícitamente un prototipo del ASR real, de modo que se optó por implementar transformers.js desde el inicio en lugar de pasar primero por Web Speech API. Esta última queda descartada incluso como fallback de la entrega.

### DTW + distancia euclidiana sobre distancia euclidiana simple

Nadie habla exactamente a la velocidad de la referencia, y sin alineación temporal la distancia castiga el ritmo en lugar de la pronunciación. Dynamic Time Warping alinea las secuencias de features y la distancia euclidiana frame a frame se acumula sobre ese alineamiento, conservando la métrica sugerida en la documentación del curso pero aplicada donde tiene sentido.

### Referencia de pronunciación generada con SpeechT5

La señal de referencia contra la que se compara al usuario se sintetiza con el mismo motor TTS de la app, lo que garantiza disponibilidad offline de cualquier frase sin grabar audios de hablantes nativos ni empaquetar un corpus. Sin embargo, una referencia sintética tiene una identidad vocal distinta a la del usuario (F0 y formantes dependen del sexo y del tracto vocal de cada hablante), por lo que las features se normalizan por locutor antes del DTW — contornos de pitch relativos y z-score por enunciado en lugar de valores absolutos — para que la distancia mida pronunciación y no identidad de voz.

### Arquitectura en capas con núcleo de dominio puro

El código de `app/` se organiza en cuatro capas con regla de dependencia hacia adentro: presentación (`ui/`, componentes React y visualizaciones), orquestación (workers: el pipeline de IA y la coordinación de audio), dominio (`dsp/` e `ia/`: algoritmos como funciones puras — YIN, MFCC, VAD, DTW, prompts y reglas de escenarios) e infraestructura (adaptadores de Web Audio, transformers.js, Cache API e IndexedDB en `audio/` y `storage/`). El dominio no importa nada de las capas externas, lo que ya estaba implícito en la convención de funciones puras testeables y aquí se vuelve regla explícita. Se eligió sobre MVC (encaje artificial con React y workers) y sobre hexagonal estricta (ceremonia de puertos innecesaria para 7 semanas); además el diagrama de bloques que exige la documentación del curso (frontend, motor de audio, pipeline de IA, almacenamiento, módulos de señales) mapea directamente sobre estas capas.

## Decisiones de producto

### Interfaz en español, sin toggle bilingüe

El usuario objetivo es un hispanohablante aprendiendo inglés, y entender el feedback gramatical y de pronunciación es crítico para que la aplicación cumpla su función de enseñanza; la interfaz, las instrucciones y las correcciones se presentan en español, mientras que el contenido de práctica es en inglés. Un toggle bilingüe se descartó por duplicar los textos a mantener, un costo que no se justifica con tres entregas en siete semanas.

### Conversación híbrida: escenarios guiados + generación con SmolLM2

La práctica se estructura en escenarios curados por el equipo (por ejemplo, restaurante, aeropuerto, entrevista de trabajo), y SmolLM2 genera variaciones y respuestas dentro del marco de cada escenario. Un modelo de 360M de parámetros sin guía tiende a divagar; el enfoque híbrido da una demo confiable sin renunciar al mérito de la generación dinámica.

### Micrófono con toggle y auto-stop por VAD

Un clic inicia la escucha, y un detector de actividad de voz (VAD) basado en energía corta la captura al detectar el silencio de fin de frase. El esquema es manos libres y natural para conversar, y el VAD es un módulo más de procesamiento de señales que suma al marco teórico del curso.

### Tailwind CSS para estilos

Las utilidades de Tailwind se aplican directamente en el propio JSX, lo que evita archivos CSS paralelos que coordinar entre cinco personas y da consistencia automática de espaciados y colores. Su curva de aprendizaje es corta y la documentación es excelente.

## Convenciones y defaults técnicos

- Inferencia con WebGPU y fallback automático a WASM (ONNX Runtime Web).
- Pipeline de IA (ASR → gramática → sugerencias → TTS) en un Web Worker orquestador; DSP en AudioWorklet; nada de inferencia en el hilo principal.
- Captura de audio a la tasa nativa del dispositivo y resampleo a 16 kHz mono (requerido por Whisper y el pipeline DSP).
- MFCC: ventana Hann de 25 ms, hop de 10 ms, 13 coeficientes, 40 filtros mel (parámetros estándar de ASR, justificados en el marco teórico).
- Corrección gramatical y de pronunciación disparada al finalizar cada frase (post-utterance): Whisper no opera en streaming en el navegador.
- Estado global con React Context + hooks; se migrará a Zustand solo si la complejidad lo exige.
- Package manager: pnpm en todo el proyecto (instalación más rápida, node_modules estricto que evita dependencias fantasma y menor uso de disco); npm y yarn quedan descartados.
- PWA con vite-plugin-pwa (Workbox).
- Calidad de código: ESLint + Prettier con configuración compartida en el repo.
- Estructura de `app/` por dominios: `audio/`, `dsp/`, `ia/`, `ui/`, `storage/`.
- Voz de referencia de SpeechT5 con el speaker embedding (x-vector) oficial de ejemplo.
- Exportación del documento técnico Markdown → PDF con pandoc.
- Persistencia de sesiones: solo features acústicas y puntajes, nunca audio crudo (espacio y privacidad); la fórmula del puntaje de pronunciación se calibrará con pruebas reales en el Avance 2.
- Navegador objetivo: Chrome/Chromium (recomendado por la documentación del curso para Web Audio).
- Audio de doble rama: las visualizaciones (espectrograma, formantes) trabajan a la tasa nativa del dispositivo (44.1/48 kHz); la rama de 16 kHz mono alimenta solo a Whisper y al MFCC del comparador. Evita que el resampleo recorte la información sobre 8 kHz de sibilantes y fricativas del inglés.
- El MFCC propio no alimenta a Whisper (que extrae sus features internamente): el pipeline DSP del equipo es paralelo y sirve al comparador de pronunciación y a las visualizaciones.
- Workbox precachea solo el app shell: los pesos de los modelos se excluyen del precache (globIgnores) y quedan exclusivamente en la Cache API que gestiona transformers.js, evitando doble caché y un service worker que nunca termina de instalar.
- Carga de modelos bajo demanda con indicador de progreso por modelo: Whisper al primer uso del micrófono, TTS al generar la primera referencia, T5 en la primera corrección; SmolLM2 se difiere al Avance 2.
- Half-duplex explícito: el micrófono se suspende (stop del track o suspend del AudioContext) mientras se reproduce el TTS, y se reactiva con el siguiente clic del usuario. Evita eco y auto-captura.
- Presupuesto de latencia medido sobre WASM como caso base; WebGPU se trata como aceleración oportunista (su soporte para modelos seq2seq con KV-cache aún es inmaduro), no como supuesto de diseño.
- Toda la lógica DSP (YIN, MFCC, VAD, DTW) se escribe como funciones puras sin dependencias de AudioWorklet ni postMessage, importables por igual desde el worklet, los workers y los tests de Vitest.
- El pipeline Markdown→PDF pre-renderiza los diagramas Mermaid a SVG con mermaid-cli antes de pandoc (pandoc no renderiza Mermaid nativo).
- Revisión fija de modelos: cada modelo del Hub se consume con una revision anclada en un registro central (ia/model-registry.ts); antes de la Entrega Final se fija a un commit exacto para que una actualización upstream no cambie el comportamiento offline.
- IndexedDB con esquema versionado y migraciones explícitas: los datos de progreso deben sobrevivir los cambios de esquema entre avances sin perder sesiones.
- Nomenclatura: identificadores de código (archivos, funciones, variables) descriptivos y en inglés, sin abreviaturas crípticas ni nombres genéricos (utils, misc); los textos visibles de la interfaz viven en español, centralizados en ui/interface-texts.ts.
- Integración continua con GitHub Actions: lint, typecheck, tests y build en cada Pull Request y push a main (gratuito en el plan del repo privado); un PR no se mergea con el CI en rojo.
- Versión de Node fijada con .nvmrc y campo engines (Node 22 LTS) y pnpm declarado en packageManager, para que las cinco máquinas del equipo y el CI usen el mismo entorno.
- Estados de error de primera clase para las operaciones frágiles: permiso de micrófono denegado, descarga de modelo fallida o incompleta, espacio de almacenamiento insuficiente y ausencia de WebGPU (cae a WASM); cada uno con mensaje en español definido en ui/interface-texts.ts.

## Decisiones de proceso y entregas

### Documento técnico en Markdown exportado a PDF

Se redacta en Markdown con ecuaciones LaTeX/KaTeX (la documentación del curso pide fórmulas como la DFT y los MFCC) y se exporta a PDF para la entrega. Al ser texto plano, el documento se versiona en Git con diffs legibles y varias personas pueden editarlo en ramas sin los conflictos binarios de Word.

### Diagramas con Mermaid

Los diagramas de bloques y de flujo se describen como texto y se renderizan dentro del propio pipeline Markdown→PDF, versionándose junto al documento. La documentación del curso sugiere "herramientas como Draw.io", y Mermaid cumple ese rol con mejor integración al flujo elegido.

### Demo en localhost + deploy en Vercel

La presentación en vivo corre desde localhost, que no depende de la red del aula y demuestra el funcionamiento offline real. Para el desarrollo, al no existir backend la app es un sitio 100% estático, y eso encaja exactamente con el hosting estático gratuito de Vercel: HTTPS (el contexto seguro que exigen el service worker y el micrófono), integración directa con el repositorio privado de GitHub y preview deploys por cada Pull Request, algo que se alinea con el flujo de PRs del equipo. Usar una plataforma orientada a servidores para servir archivos estáticos sería pagar por capacidad que la app no utiliza.

### Metodología iterativa por avances

La documentación del curso fija metodología iterativa (Agile-like); el trabajo se organiza en ciclos alineados a los tres hitos (Avance 1, Avance 2, Entrega Final), con integración continua a `main` vía Pull Requests conforme el equipo esté activo. Los enfoques en cascada quedan descartados por la propia documentación. Siguiendo ese mismo lineamiento, la construcción de la aplicación es modular: cada capa de `app/` (`audio/`, `dsp/`, `ia/`, `ui/`, `storage/`) se desarrolla y se ajusta como un módulo independiente que se integra a `main` de forma incremental, lo que permite acotar el alcance de cada módulo por separado en cada iteración.

## Estructura actual del repositorio

```
/
├── .github/workflows/ci.yml # Pipeline de integración continua
├── Documentacion general/   # Documentación del curso
├── app/                     # Código de la aplicación (React + TypeScript + Vite)
├── CONTRIBUTING.md          # Guía de contribución del equipo
├── README.md
└── .gitignore
```

El detalle de la estructura interna de `app/` (capas `ui/`, `ia/`, `dsp/`, `audio/` y `storage/`) está documentado en `app/README.md`.

## Calendario de entregas

| Entrega | Semana | Contenido |
|---|---|---|
| Avance 1 | Semana 4 | Arquitectura del sistema + prototipo de ASR y corrección gramatical |
| Avance 2 | Semana 7 | Conversación integrada + módulo de pronunciación con señales (DSP) |
| Entrega Final | Semana 10 | Aplicación completa, con pruebas y demo |

## Estado

Fase de planificación cerrada: la arquitectura del sistema y las decisiones de proceso y entregas quedaron completas y documentadas en este archivo. El scaffolding de `app/` también está completo: proyecto React + TypeScript + Vite con Tailwind, Vitest, PWA, la estructura en capas, el registro de modelos y una primera función DSP con tests, más un pipeline de integración continua con GitHub Actions. Ya está integrada en `main` una primera captura de micrófono con visualización de waveform en tiempo real, como demo inicial de la capa de audio; la captura y el resampleo a 16 kHz ya viven en la capa `audio/` (`audio/microphone-capture.ts`, `audio/audio-resampler.ts`), conforme a la arquitectura definida, y `App.tsx` se limita a presentar. Además, ya está integrado el prototipo de ASR y corrección gramatical con el que el alcance técnico del Avance 1 queda cubierto: la transcripción con Whisper (`Xenova/whisper-tiny.en`) se encadena automáticamente, post-utterance, con la corrección gramatical de un modelo T5 (`Xenova/t5-base-grammar-correction`), ambas etapas de inferencia corriendo en el mismo Web Worker orquestador (`ia/inference-worker.ts`, con un cliente sin React en `ia/inference-client.ts` y un protocolo de mensajes tipado en `ia/inference-worker-protocol.ts`), con WebGPU oportunista y fallback automático a WASM, y cada modelo descargándose bajo demanda en su primer uso con indicador de progreso propio; `App.tsx` acumula los frames de audio mientras escucha, los concatena y resamplea al detener el micrófono, transcribe, corrige la gramática del resultado y muestra ambos textos en paneles separados. Sigue pendiente, como decisión interna del equipo, la asignación de responsables por módulo (ASR, DSP, pipeline de IA, UI).
