# My Personal English Teacher

Proyecto universitario del curso **Señales y Sistemas**. Una PWA (Progressive Web App) offline para práctica conversacional de inglés, donde toda la inteligencia artificial se ejecuta del lado del cliente, directamente en el navegador.

## Descripción

La aplicación permite practicar conversación en inglés sin depender de servidores externos: reconocimiento de voz, corrección gramatical, síntesis de voz y retroalimentación de pronunciación deben correr localmente usando modelos de Hugging Face ejecutados con `transformers.js` sobre ONNX Runtime Web.

El componente de Procesamiento Digital de Señales (DSP) es central al **diseño del curso**: pitch (YIN), energía, formantes, MFCC, visualizaciones (waveform, espectrograma, pitch tracking) y comparación de pronunciación contra una referencia. **Hoy** el núcleo DSP en código es la energía de señal (gate post-captura) y la visualización de waveform/nivel en vivo; el resto está planificado para Avance 2 y Entrega Final (ver [Estado](#estado)).

## Características

### Implementado (estado del repositorio)

- Captura de micrófono real (`getUserMedia`) con `MediaRecorder` para el audio de ASR y grafo Web Audio (`AnalyserNode`) para onda y nivel en vivo.
- Reconocimiento de voz (ASR) client-side con Whisper (`Xenova/whisper-small.en`, default de producción) en un Web Worker.
- Corrección gramatical post-utterance con T5 (`Xenova/t5-base-grammar-correction`) en el mismo worker.
- Filtro de etiquetas no-habla que Whisper inventa (p. ej. `[Music]`) antes de mostrar texto o corregir gramática.
- Gate de energía/pico/duración (`dsp/signal-energy.ts`) para no enviar silencio a Whisper.
- **Pitch YIN** (`dsp/pitch-detection-yin.ts`): F0 por frame y contorno; **canvas de pitch track** post-utterance.
- **Espectrograma** (`dsp/spectrogram.ts` + canvas UI): STFT log-magnitud de la última utterance.
- **Formantes F1/F2/F3** (`dsp/formant-estimation.ts`): LPC + picos de envolvente; mediana por utterance en UI.
- **MFCC propios** (`dsp/mfcc-extraction.ts`): secuencia de 13 coeficientes / frame (Hann 25 ms, hop 10 ms, 40 mel).
- **DTW** (`dsp/dynamic-time-warping.ts`): alineación temporal + distancia L2 + score 0–100.
- **Score de pronunciación** (`dsp/pronunciation-score.ts` + panel UI): user PCM vs TTS de la frase corregida (MFCC + pitch opcional + DTW).
- **Highlights por palabra** (`dsp/word-pronunciation-highlights.ts`): color good/medium/poor desde el path DTW (aproximación temporal por letras).
- **TTS Supertonic**: referencia acústica del score + reproducción de la respuesta del tutor.
- **Sugerencias de comunicación** (`ia/communication-suggestions.ts` + `ia/communication-suggestion-analysis.ts` + `ia/communication-suggestion-rewrites.ts`): tres tarjetas por turno (vocabulario, naturalidad, fluidez) que citan la frase real del alumno (`youSaidEn` / `tryThisEn`) en vez de rotar frases genéricas de escenario; enriquecimiento opcional con SmolLM2 (`ia/communication-coaching-generation.ts`, 72 tokens máx., timeout 8 s, con respaldo a las sugerencias estructurales). UI en `ui/CommunicationSuggestionsPanel.tsx`, pestaña Sugerencias del panel de feedback, con enriquecimiento asíncrono no bloqueante (`ui/schedule-dynamic-suggestions.ts`).
- **Modo de estudio** (`study/`, capa de dominio puro: no importa React, DOM, `ui/`, `ia/`, `audio/` ni `storage/`): 36 lecciones en Markdown con frontmatter YAML → `load-processed-lessons.ts` → `parse-lesson-markdown.ts` → banco de práctica; 4 modos de práctica (vocabulario, completar, traducir, transformar), repetición espaciada tipo SM-2 (`practice-srs.ts`) y marcapáginas de reanudación. UI en `StudyScreen.tsx` / `StudyPracticeDesk.tsx`, acceso por hash `#estudio` (cuarto ítem del rail izquierdo); persistencia propia en `storage/study-document-store.ts`.
- **Conversación híbrida activa** (`ia/conversation-suggestions.ts` + `ui/tutor-reply-orchestration.ts`): SmolLM2 genera la respuesta principal del tutor con memoria de los últimos 4 turnos; timeout de 10 s y motor de reglas por escenario (`ui/tutor-reply-engine.ts`) como respaldo veraz (insignia honesta en el chat, nunca se hace pasar por generación del modelo).
- **Catálogo ASR multi-candidato** (`ia/model-registry.ts`): 4 modelos Whisper evaluables (`tiny-en`, `base-en`, `distil-small-en`, **`small-en` default**) con tamaño aproximado de descarga; override de desarrollo `VITE_ASR_MODEL`. Default elegido por el banco de pruebas (2026-07-29): mejor WER y ~3.4 s/frase en **WebGPU** (en WASM small-en es ~11 s y no es viable).
- **Banco de pruebas ASR** (solo desarrollo, `#asr-benchmark`, fuera del bundle de producción): fixtures de voz propias en una IndexedDB separada (borrable sin tocar el progreso del estudiante, nunca en Git), corridas candidato × backend (WASM q8 / WebGPU fp32) con WER por Levenshtein y export a CSV/JSON.
- **Paleta de diseño centralizada** (`index.css`, tokens `@theme`: sage/ink/blush) consumida por toda la UI; tests de freeze-guard evitan cambios accidentales de color.
- **Shell de conversación Avance 2:** escenarios, chat, ASR+gramática, score, tutor híbrido + voz TTS.
- UI modular en español (shell **Atelier**, issue #81): rail + chat centrado + panel de feedback; `HomeScreen` + hook de sesión + textos centralizados.
- PWA con `vite-plugin-pwa` (app shell); pesos de modelos gestionados por `transformers.js` / Cache API.
- CI con GitHub Actions (lint, typecheck, tests, build).

### Planificado (diseño del curso / resto de Avance 2 y final)

- Features acústicas restantes: formantes; VAD en vivo para auto-corte de captura.
- Calibración fina del score 0–100 con hablantes reales.
- Persistencia de sesiones y progreso en IndexedDB.
- Extensiones de innovación: evolución de pitch/puntajes por sesión, gamificación.

El soporte multi-idioma se descartó explícitamente: los candidatos ASR de producción son variantes **.en** (solo inglés).

## Stack tecnológico

### En uso hoy

- **Frontend:** React + TypeScript, Vite, Tailwind CSS.
- **IA en navegador:** `@huggingface/transformers` (ONNX Runtime Web); WebGPU oportunista con fallback a WASM.
- **Modelos activos (revisiones ancladas a SHA en `ia/model-registry.ts`):** `Xenova/whisper-small.en` (ASR default), `Xenova/t5-base-grammar-correction` (gramática), `onnx-community/Supertonic-TTS-ONNX` (TTS), `HuggingFaceTB/SmolLM2-360M-Instruct` (tutor). ASR prefiere **WebGPU**; gramática/TTS/SmolLM2 van en **WASM**.
- **Audio:** Web Audio API (`MediaStreamSource` + `AnalyserNode` para visualización) + `MediaRecorder` para ASR; resample a 16 kHz mono en `audio/`.
- **DSP en código:** energía RMS/pico y gate de habla usable (`dsp/signal-energy.ts`).
- **Estado de UI:** hooks de React en `ui/use-home-screen-session.ts` (sin store global todavía).
- **Testing:** Vitest.
- **Package manager:** pnpm; Node 22 LTS.
- **Tipo de aplicación:** PWA offline-first (`vite-plugin-pwa` + Service Worker del app shell).
- **Demo:** localhost (`pnpm dev` en `app/`).

### Registrado / previsto (aún no cableado en la UI)

- **DSP futuro:** YIN, MFCC (implementación propia; Meyda solo como referencia de tests cuando exista), formantes; opcionalmente AudioWorklet para DSP en tiempo real.
- **Pronunciación:** DTW + distancia euclidiana frame a frame vs referencia TTS.
- **Almacenamiento de app:** IndexedDB versionado (sesiones/progreso); los pesos ya usan Cache API vía transformers.js.
- **Entrega / demo:** solo **localhost** (`pnpm dev` o `pnpm preview`). **No** hay ni se planea deploy en la nube (Vercel u otros hosts); el producto es offline-first en el navegador del usuario.

## Decisiones de arquitectura

> Las subsecciones siguientes son **decisiones de diseño del proyecto** (qué se eligió y por qué). No todas están implementadas todavía; el inventario real está en [Características → Implementado](#implementado-estado-del-repositorio) y en [Estado](#estado).

### React sobre Vanilla JS

La aplicación combina estado conversacional, audio en tiempo real y varias visualizaciones simultáneas (waveform, espectrograma, pitch tracking), algo difícil de sostener con Vanilla JS a medida que crece la base de código. Dividir la interfaz en componentes aislados (chat, visualizador, panel de feedback) permite que un equipo de cinco personas trabaje en ramas separadas con menos conflictos de merge.

### TypeScript sobre JavaScript

Con cinco personas trabajando en ramas separadas, los tipos convierten los errores de contrato entre módulos (features acústicas, mensajes de workers, pipeline de IA) en errores de compilación en vez de fallos en la demo; React y transformers.js publican tipos oficiales. El build es Vite: es el estándar actual del ecosistema React y Create React App está deprecado. Los tests usan Vitest por su integración nativa con Vite.

### whisper-small.en (default) con fallback de catálogo

La decisión inicial del Avance 1 favorecía `whisper-tiny.en` (~40 MB) por latencia. El banco de pruebas del 2026-07-29 midió WER y latencia de los 4 candidatos: **`small-en` ganó en precisión** (WER 0.000 en las fixtures de referencia) con ~3.4 s/frase en **WebGPU**. En WASM pure, small-en ronda ~11 s/frase y **no es viable**; por eso el device policy de ASR auto-detecta WebGPU y cae a WASM solo si no hay adapter. `tiny-en` / `base-en` / `distil-small-en` siguen en el catálogo y se pueden forzar con `VITE_ASR_MODEL` o el banco `#asr-benchmark`.

### Variantes .en sobre multilingüe

A peso comparable, las variantes entrenadas solo en inglés ofrecen mejor precisión para el único idioma de práctica. La extensión multi-idioma se descartó explícitamente.

### vennify/t5-base-grammar-correction sobre hassaanik/grammar-correction-model

Se optó por `vennify/t5-base-grammar-correction` por ser el modelo de corrección gramatical más usado y mejor documentado de su categoría, con una conversión ONNX compatible con transformers.js ya publicada en el Hub de Hugging Face (`Xenova/t5-base-grammar-correction`, la que efectivamente consume la aplicación), lo que elimina el riesgo de integración. La alternativa evaluada no cuenta con un port ONNX verificado, y descubrir ese problema recién durante la implementación habría puesto en riesgo la entrega del Avance 1.

### YIN sobre autocorrelación simple

YIN es un refinamiento del método de autocorrelación clásico que incorpora una función de diferencia normalizada acumulativa y un umbral absoluto, lo que reduce drásticamente los errores de octava, la falla más común al rastrear el pitch de la voz humana. Su adopción además aporta contenido propio de procesamiento de señales al marco teórico del curso, que pondera en un 40% la calidad técnica del trabajo.

**Estado de implementación:** dominio puro en `dsp/pitch-detection-yin.ts` (`estimatePitchWithYin`, contorno por frames, media voiced). Banda por defecto 70–400 Hz (habla). Aún sin panel de UI ni comparación user-vs-referencia; eso entra con MFCC/DTW y visualización de pitch.

### MFCC de implementación propia sobre librería (Meyda)

La extracción de MFCC (FFT, banco de filtros mel, DCT) es contenido nuclear del curso y del marco teórico, y la calidad técnica pondera un 40% de la evaluación; delegarla a una librería dejaría el corazón DSP del proyecto en una caja negra. Meyda queda reservado solo como referencia opcional de tests si hiciera falta calibrar coeficientes — **no hay dependencia Meyda en el runtime**.

**Estado de implementación:** dominio puro en `dsp/mfcc-extraction.ts` (`extractMfccSequence`, banco mel, DCT-II). Parámetros por defecto: ventana Hann 25 ms, hop 10 ms, 13 MFCC, 40 filtros mel, pre-énfasis 0.97. Aún sin DTW ni score de pronunciación en UI.

### Caché híbrida (Cache API + IndexedDB) sobre una sola tecnología

transformers.js cachea los pesos de los modelos mediante la Cache API por defecto, sin código adicional de por medio, y esa API está pensada para pares request/response, no para datos estructurados. Las sesiones de práctica, el historial de conversación y las métricas de progreso, en cambio, son datos consultables que encajan naturalmente en IndexedDB. Forzar toda la persistencia a una sola de las dos tecnologías implicaría usar cada una para un caso que no le corresponde.

**Estado:** modelos → Cache API (transformers.js). Sesiones/turnos → IndexedDB en `storage/` (schema v1, sin audio crudo). Excepción dev-only: el banco de pruebas ASR usa una IndexedDB separada que sí guarda PCM crudo de las fixtures grabadas, nunca versionada en Git.

### SmolLM2-360M-Instruct sobre variantes de Phi-2 para sugerencias conversacionales

`SmolLM2-360M-Instruct` publica pesos ONNX oficiales de HuggingFaceTB en el propio repositorio del modelo, de aproximadamente 250 MB cuantizados, mientras que la primera generación de SmolLM carece de conversión ONNX oficial; SmolLM2 es la iteración mejorada del mismo modelo, al mismo tamaño. Ese tamaño cabe en el presupuesto de descarga y de memoria del navegador junto con Whisper, T5 y Supertonic. Phi-2, con 2.7B de parámetros y más de 1.5 GB cuantizado, pondría en riesgo tanto la carga offline como la demo en equipos modestos. Este módulo se integra recién en el Avance 2, pero la decisión se fija desde ahora para no comprometer la arquitectura general del sistema.

### transformers.js directo desde el prototipo, sin fase previa con Web Speech API

La Web Speech API de Chrome delega el reconocimiento de voz en los servidores de Google, por lo que un prototipo construido sobre ella no cumpliría con la restricción client-side/offline del proyecto y representaría trabajo desechable. El Avance 1 exige explícitamente un prototipo del ASR real, de modo que se optó por implementar transformers.js desde el inicio en lugar de pasar primero por Web Speech API. Esta última queda descartada incluso como fallback de la entrega.

### DTW + distancia euclidiana sobre distancia euclidiana simple

Nadie habla exactamente a la velocidad de la referencia, y sin alineación temporal la distancia castiga el ritmo en lugar de la pronunciación. Dynamic Time Warping alinea las secuencias de features y la distancia euclidiana frame a frame se acumula sobre ese alineamiento, conservando la métrica sugerida en la documentación del curso pero aplicada donde tiene sentido.

**Estado de implementación:** dominio puro en `dsp/dynamic-time-warping.ts` + `dsp/pronunciation-score.ts` (MFCC + pitch + energía + formantes, issue #58). El 0–100 vive en modo **Repetir** (issue #95: Δlocutor 11.3 ≳ Δerror 9.9). Conversación no califica contra el TTS.

### Supertonic sobre SpeechT5 + HiFiGAN para la referencia de pronunciación

La señal de referencia contra la que se compara al usuario se sintetiza con el mismo motor TTS de la app, lo que garantiza disponibilidad offline de cualquier frase sin grabar audios de hablantes nativos ni empaquetar un corpus. La elección de motor cambió durante el Avance 2: sale `Xenova/speecht5_tts` con su vocoder separado `Xenova/speecht5_hifigan` y un speaker embedding de demo genérico; entra `onnx-community/Supertonic-TTS-ONNX` (revisión anclada a SHA en `ia/model-registry.ts`). Supertonic encadena tres sesiones ONNX propias —`text_encoder` → `latent_denoiser` (denoising iterativo, 5 pasos por defecto en este proyecto) → `voice_decoder`, que decodifica la forma de onda directamente— y no depende de un vocoder externo, a diferencia de SpeechT5+HiFiGAN. Sus pesos en fp32 pesan en conjunto ~250.7 MB frente a los ~613 MB del trío que sustituye (encoder + decoder_model_merged + decoder_postnet_and_vocoder, medidos por Content-Length HTTP en el mismo dtype), un ahorro neto de ~362 MB sobre el presupuesto de descarga del navegador. Además ofrece 10 voces curadas (F1–F5, M1–M5; el proyecto fija F1), cada una un vector de estilo precomputado, en lugar de depender de un embedding de speaker de demo sin curaduría. El soporte llegó nativo a la librería que ya usa el proyecto: el PR de integración se mergeó en transformers.js el 2025-11-19 y `@huggingface/transformers` 3.8.1 (publicada el 2025-12-02, la versión que consume la app) lo incluye vía `pipeline('text-to-speech', ...)`, sin parches propios.

Lo que no cambia con el motor: una referencia sintética sigue teniendo una identidad vocal distinta a la del usuario (F0 y formantes dependen del sexo y del tracto vocal de cada hablante), por lo que las features se siguen normalizando por locutor antes del DTW — contornos de pitch relativos y z-score por enunciado en lugar de valores absolutos — para que la distancia mida pronunciación y no identidad de voz.

**Riesgo asumido y declarado:** Supertone (la empresa autora) archivó el proyecto open source de Supertonic el 23 de julio de 2026; su Voice Builder deja de estar accesible después del 31 de agosto de 2026. Los pesos del modelo siguen alojados en el espejo `onnx-community` de Hugging Face —hosting de Hugging Face, no de Supertone—, así que la descarga no depende de esa empresa, pero no habrá más correcciones ni la variante cuantizada (q8/fp16) que el autor había anunciado; solo existe fp32. Licencia OpenRAIL-M (las restricciones de uso de su Attachment A no afectan a este proyecto); el código de ejemplo del autor es MIT.

**Estado de implementación:** Supertonic está cableado en el worker igual que su predecesor: (1) sintetiza la **referencia** de la frase del usuario para el score de pronunciación; (2) **reproduce** el follow-up del tutor. Validación perceptual hecha: el 2026-08-21 el autor comprobó manualmente en `localhost` que la voz suena correctamente en el navegador, que `voices/F1.bin` aparece en el bucket `transformers-cache` de Cache Storage (confirmando que la precarga del fichero de voz funciona) y que un turno completo corre sin red sobre `pnpm build` + `pnpm preview` (`http://localhost:4173`). Apreciación subjetiva del autor, sin prueba MOS ni comparación instrumentada: la voz suena mejor que el motor anterior (SpeechT5). Sigue sin medir la latencia de síntesis sobre WASM en el navegador (las cifras que publica el autor del modelo son de ejecución nativa CPU/GPU, no de WASM en navegador).

### Tasa de trabajo del score fijada a 16 kHz, independiente del sample rate del TTS

El score de pronunciación comparaba a usuario y referencia TTS a la tasa que emitiera el sintetizador activo; con SpeechT5 (16 kHz) eso coincidía por accidente con la calibración existente, pero Supertonic sintetiza a 44 100 Hz. A esa tasa el banco de 40 filtros mel se reparte de 0 a 22 050 Hz mientras el pasa-banda del pipeline corta en 7.5 kHz (issue #73), dejando alrededor de una docena de filtros mel por encima del corte pegados al suelo logarítmico; como la DCT-II mezcla todas las bandas, los 13 coeficientes MFCC se desplazan y las constantes de calibración dejan de aplicar.

La corrección fija la tasa de trabajo del score en `WHISPER_SAMPLE_RATE_IN_HERTZ` (16 000 Hz, constante de `audio/audio-resampler.ts`) dentro de `ui/run-pronunciation-scoring.ts`, en vez de heredarla de `synthesized.sampleRateInHertz`. Usuario y referencia se remuestrean a 16 kHz por la misma rama FIR de fase lineal ya existente (factor racional 160/441, atenuación de alias medida 86.6 dB, issues #92/#65) y la misma cadena compartida usuario/referencia del issue #73 (remuestreo + pasa-banda 80 Hz–7.5 kHz), de modo que la calibración numérica (distancia MFCC a media escala 16.5, distancia de pitch relativo a media escala 11.2, pesos del score combinado MFCC 0.68 / pitch 0.18 / energía 0.07 / formantes 0.07) sigue vigente sin importar qué motor TTS esté detrás.

### Arquitectura en capas con núcleo de dominio puro

El código de `app/` se organiza por carpetas de capa con dependencia hacia adentro: presentación y orquestación de pantalla (`ui/`), dominio/orquestación de modelos (`ia/` + worker), dominio DSP puro (`dsp/`), dominio de estudio puro (`study/`), infraestructura de audio (`audio/`) y persistencia (`storage/`). El dominio no importa React ni DOM. Hoy `dsp/` tiene energía, **YIN**, **MFCC** y **DTW**; faltan VAD en vivo y el cableado del score a la UI. Se eligió sobre MVC (encaje artificial con React y workers) y sobre hexagonal estricta (ceremonia de puertos innecesaria para 7 semanas); el diagrama de bloques del curso (frontend, motor de audio, pipeline de IA, almacenamiento, módulos de señales) mapea sobre estas carpetas.

## Decisiones de producto

### Interfaz en español, sin toggle bilingüe

El usuario objetivo es un hispanohablante aprendiendo inglés, y entender el feedback gramatical y de pronunciación es crítico para que la aplicación cumpla su función de enseñanza; la interfaz, las instrucciones y las correcciones se presentan en español, mientras que el contenido de práctica es en inglés. Un toggle bilingüe se descartó por duplicar los textos a mantener, un costo que no se justifica con tres entregas en siete semanas.

### Conversación híbrida: escenarios guiados + generación con SmolLM2

La práctica se estructura en escenarios curados por el equipo (por ejemplo, restaurante, aeropuerto, entrevista de trabajo), y SmolLM2 genera variaciones y respuestas dentro del marco de cada escenario. Un modelo de 360M de parámetros sin guía tiende a divagar; el enfoque híbrido da una demo confiable sin renunciar al mérito de la generación dinámica.

**Estado de implementación:** escenarios + chat en UI; **la apertura del escenario sigue un guion curado** (instantánea y coherente). Para cada turno del estudiante, SmolLM2 genera la respuesta principal del tutor con memoria de los últimos 4 turnos de la conversación; si no responde de forma plausible dentro de un timeout de 10 s (`ui/tutor-reply-orchestration.ts`), se usa como respaldo la línea del motor de reglas por escenario (`ui/tutor-reply-engine.ts`), marcada con una insignia honesta en el chat en vez de hacerse pasar por generación del modelo.

### Micrófono con toggle y auto-stop por VAD

**Hoy (Avance 2):** un clic inicia la escucha; **auto-stop por VAD de energía** al silencio de fin de frase (~0.9 s de hangover tras haber hablado), o botón Detener manual. Tras el stop, el gate de energía/pico/duración decide si hay habla usable antes de Whisper. Implementación: `dsp/voice-activity-detection.ts` + medidores del Analyser en la sesión de UI.

### Tailwind CSS para estilos

Las utilidades de Tailwind se aplican directamente en el propio JSX, lo que evita archivos CSS paralelos que coordinar entre cinco personas y da consistencia automática de espaciados y colores. Su curva de aprendizaje es corta y la documentación es excelente.

## Convenciones y defaults técnicos

### Ya aplicados en el código

- Inferencia: ASR con WebGPU cuando hay adapter (latencia viable de `small-en`); gramática, TTS y SmolLM2 **siempre en WASM** (evita kernels rotos y contaminación del worker). Nada de inferencia en el hilo principal (Web Worker `ia/inference-worker.ts`).
- Pipeline activo post-utterance: **ASR → gramática → tutor híbrido (SmolLM2 con timeout de 10 s + respaldo de reglas) → score pronunciación → TTS del tutor**.
- Catálogo de candidatos ASR en `ia/model-registry.ts` (override `VITE_ASR_MODEL` o perfil `VITE_ASR_PROFILE=latency` → `tiny-en`; default de entrega `small-en`) y banco de pruebas dev-only en `#asr-benchmark` (WER + latencia por candidato × backend).
- Paleta de diseño centralizada en tokens CSS (`app/src/index.css`, `@theme`: sage/ink/blush) consumida por toda la UI, con tests de freeze-guard.
- Captura a tasa nativa del dispositivo; resample FIR de fase lineal 44.1/48 → 16 kHz y pasa-banda 80 Hz–7.5 kHz antes de Whisper y del score (`audio/prepare-speech-pcm.ts`, issue #73). User y ref TTS usan la misma función.
- Grafo de visualización: `MediaStreamSource → Analyser → Gain(0) → destination`. ASR: `MediaRecorder` sobre el mismo `MediaStream` real. Invariantes en `app/src/audio/CAPTURE-INVARIANTS.md`.
- Estado de pantalla con hooks (`use-home-screen-session.ts`); se migrará a Context o Zustand solo si la complejidad lo exige.
- Package manager: solo pnpm; Node 22 (`.nvmrc` + `engines` + `packageManager`).
- PWA con `vite-plugin-pwa` (Workbox precachea el app shell; pesos de modelos fuera del precache, Cache API de transformers.js).
- Calidad de código: ESLint + Prettier; reglas en `Documentacion general/REGLAS-DE-CODIGO.md`.
- Estructura de `app/src` por capas: `audio/`, `dsp/`, `ia/`, `study/`, `ui/`, `storage/`.
- Navegador objetivo: Chrome/Chromium.
- Carga perezosa de modelos en el primer uso (Whisper al transcribir, T5 al corregir) con progreso y `model-ready` hacia la UI.
- Revisiones de modelos en `ia/model-registry.ts` ancladas a **commit SHA** del Hub (build reproducible).
- Nomenclatura en inglés en código; textos de UI en español en `ui/interface-texts.ts`.
- CI en GitHub Actions: lint, typecheck, tests y build en PR y push a `main`.
- Errores de mic e inferencia tipados y mapeados a mensajes en español.

### Defaults de diseño (aún no implementados o parciales)

- Pipeline en worker: ASR → gramática → SmolLM2 → TTS (orden de uso en la sesión).
- DSP en tiempo real vía AudioWorklet cuando haga falta; YIN, MFCC y DTW ya son dominio puro en `dsp/`; falta VAD en vivo.
- MFCC (implementado): ventana Hann 25 ms, hop 10 ms, 13 coeficientes, 40 filtros mel.
- Audio de doble rama: visualizaciones avanzadas a tasa nativa; 16 kHz mono para Whisper y MFCC del comparador.
- Half-duplex con TTS: la UI deshabilita “iniciar mic” mientras sintetiza/reproduce; se puede endurecer más (abort de tracks).
- IndexedDB versionado (`storage/`): sesiones y turnos con scores/textos; nunca audio crudo.
- Documento técnico Markdown → PDF (pandoc + Mermaid pre-renderizado).
- Demo y prueba de PWA **solo en local** (localhost); sin hosting cloud del producto.

## Decisiones de proceso y entregas

### Documento técnico en Markdown exportado a PDF

Se redacta en Markdown con ecuaciones LaTeX/KaTeX (la documentación del curso pide fórmulas como la DFT y los MFCC) y se exporta a PDF para la entrega. Al ser texto plano, el documento se versiona en Git con diffs legibles y varias personas pueden editarlo en ramas sin los conflictos binarios de Word.

### Diagramas con Mermaid

Los diagramas de bloques y de flujo se describen como texto y se renderizan dentro del propio pipeline Markdown→PDF, versionándose junto al documento. La documentación del curso sugiere "herramientas como Draw.io", y Mermaid cumple ese rol con mejor integración al flujo elegido.

### Demo solo en localhost (sin hosting cloud)

La presentación en vivo corre desde **localhost** (`pnpm dev` o `pnpm preview` en `app/`), que no depende de la red del aula y demuestra el funcionamiento **offline real** tras cachear los modelos en el navegador. No hay backend ni deploy del producto en Vercel, Netlify ni ningún otro servicio en la nube: el enunciado del curso exige inferencia **client-side** y capacidad offline; publicar la app en un host remoto diluiría esa demostración y añadiría dependencia innecesaria. GitHub se usa solo para el código y la CI (lint/test/build), no como runtime de la demo. No hace falta HTTPS: los navegadores tratan `localhost` como contexto seguro, de modo que el service worker se registra y la aplicación es instalable sirviendo por HTTP desde `pnpm preview`. Verificado en Chromium (Edge): instalación desde `http://localhost:4173` y funcionamiento del pipeline completo con el servidor detenido.

### Metodología iterativa por avances

La documentación del curso fija metodología iterativa (Agile-like); el trabajo se organiza en ciclos alineados a los tres hitos (Avance 1, Avance 2, Entrega Final), con integración continua a `main` vía Pull Requests conforme el equipo esté activo. Los enfoques en cascada quedan descartados por la propia documentación. Siguiendo ese mismo lineamiento, la construcción de la aplicación es modular: cada capa de `app/` (`audio/`, `dsp/`, `ia/`, `study/`, `ui/`, `storage/`) se desarrolla y se ajusta como un módulo independiente que se integra a `main` de forma incremental, lo que permite acotar el alcance de cada módulo por separado en cada iteración.

## Estructura actual del repositorio

```
/
├── .github/
│   ├── workflows/ci.yml     # Pipeline de integración continua
│   └── issue-bodies/        # Cuerpos markdown de tickets del equipo
├── Documentacion general/   # Enunciado, reglas, guía de issues, backlog
├── app/                     # Código de la aplicación (React + TypeScript + Vite)
├── CONTRIBUTING.md          # Git, ramas, commits y calidad de issues
├── README.md
└── .gitignore
```

El detalle de la estructura interna de `app/` (capas `ui/`, `ia/`, `dsp/`, `study/`, `audio/` y `storage/`) está documentado en `app/README.md`. Las reglas de buenas prácticas y anti-patrones de código están en `Documentacion general/REGLAS-DE-CODIGO.md`. Cómo abrir tickets: `Documentacion general/GUIA-CREACION-ISSUES.md`. Orden del backlog de rúbrica: `Documentacion general/BACKLOG-RUBRICA-ESTRICTA.md` y meta-issue [#80](https://github.com/JoseJahel/my-personal-english-teacher/issues/80) (cerrado; el lote de rúbrica que ordenaba está consumido).

**Kit de defensa (issue #97), solo localhost:** riesgos y Q&A en
[`Documentacion general/matriz-riesgos.md`](./Documentacion%20general/matriz-riesgos.md)
y
[`Documentacion general/preguntas-defensa.md`](./Documentacion%20general/preguntas-defensa.md)
(plan B: `pnpm preview`, `#shell-preview*`, `pnpm dev:latency`). No hay URL
pública del producto. El deck de Avance 2 está en
[`Documentacion general/entregas/avance-2-presentacion.pptx`](./Documentacion%20general/entregas/avance-2-presentacion.pptx)
(issue #64). La bitácora de evidencias es #71.

## Calendario de entregas

| Entrega | Semana | Contenido |
|---|---|---|
| Avance 1 | Semana 4 | Arquitectura del sistema + prototipo de ASR y corrección gramatical |
| Avance 2 | Semana 7 | Conversación integrada + módulo de pronunciación con señales (DSP) |
| Entrega Final | Semana 10 | Aplicación completa, con pruebas y demo |

## Estado

**Fase:** el lote de issues de rúbrica del Avance 2 (#57–#79, #81, #92–#98) está consumido y el meta-issue [#80](https://github.com/JoseJahel/my-personal-english-teacher/issues/80) que lo ordenaba está cerrado; no hay issues abiertos en el repositorio. Además del lote, se incorporó alcance nuevo no cubierto por ese backlog: el **modo de estudio** ([#122](https://github.com/JoseJahel/my-personal-english-teacher/pull/122), [#125](https://github.com/JoseJahel/my-personal-english-teacher/pull/125)). Hoy, 21/08/2026, es el último día de la ventana formal de Avance 2 (17–22/08/2026); lo anterior describe el estado del código en el repositorio, no una entrega evaluada ni aprobada.

**2026-08-22:** Estudio adopta la identidad Atelier del shell (dirección A: serif itálica reservada al inglés a practicar, resto en sans), conservando la estructura y las funciones del modo de estudio existente. Se suman tres ajustes de UX aprobados: segmentado real Temario/Prácticas en la cabecera del lector, barra de progreso de lecciones visitadas en la navegación de la lección y, en las prácticas, el error se marca con la paleta semántica del shell (sage para la opción correcta, blush para la elegida) mientras que el acierto avanza directamente al siguiente ítem sin estado intermedio visible (comportamiento preexistente del escritorio).

| Capa | Qué hay hoy | Qué falta (Avance 2 / final) |
|------|-------------|------------------------------|
| `ui/` | Escenarios, chat con **tutor híbrido** (SmolLM2 + respaldo honesto), score, TTS, onda + **espectrograma + pitch** + **highlights por palabra** + **sugerencias de comunicación** (vocabulario/naturalidad/fluidez) + **banco de pruebas ASR** (dev) + paleta de diseño en tokens | — |
| `audio/` + sesión | Mic real, Analyser, MediaRecorder, resample + **pasa-banda 80 Hz–7.5 kHz** (misma cadena user/ref, #73), play TTS, **VAD auto-stop**. STFT/YIN **en vivo** sobre pista clonada (#59) y **post-stop** sobre el PCM decodificado | Half-duplex más estricto al TTS |
| `ia/` | Whisper (**default `small-en`**, catálogo de 4), T5, **Supertonic**, **SmolLM2**, worker + client; revisiones **SHA** | Re-medir bench en hardware de demo si hace falta |
| `dsp/` | Energía + YIN + MFCC + DTW + score **MFCC/pitch/energía/formantes** (#58) + espectrograma + **VAD** + **pasa-banda Butterworth** (#73) | — |
| `study/` | Dominio puro: 36 lecciones en Markdown (frontmatter YAML) → parser → banco de práctica; 4 modos de práctica (vocabulario, completar, traducir, transformar), SRS tipo SM-2 y marcapáginas de reanudación; UI en `StudyScreen.tsx`, hash `#estudio` | — |
| `storage/` | **IndexedDB** sesiones/turnos (sin audio) + **IndexedDB de documentos de estudio** (`study-document-store.ts`) + **IndexedDB separada de fixtures del banco de pruebas ASR** (solo dev, con audio crudo) | Migraciones futuras de schema |

**Decisión de modelo ASR:** **`whisper-small.en`** es el default de producción (bench 2026-07-29). Requiere **WebGPU** para latencia de demo viable; sin adapter el runtime cae a WASM (más lento). El banco `#asr-benchmark` (solo dev) sigue disponible para re-medir en otras máquinas.

Detalle operativo de la demo actual:

1. Elegir escenario → intro del tutor en el chat (guion curado) + precarga de SmolLM2 en segundo plano.
2. Clic en escuchar → `openRealMicrophoneStream` + grafo Analyser + MediaRecorder.
3. Onda y % de nivel en vivo (`waveform-canvas.ts`). El panel Señales muestra
   **espectrograma STFT y pitch YIN en vivo** (PCM de una pista clonada, no el
   FFT del Analyser).
4. Al detener → decode mono → **espectrograma + pitch YIN** de la utterance → gate → resample + pasa-banda (#73) → Whisper.
5. Si el texto es habla real → **burbuja del estudiante** → **tutor instantáneo** (motor de reglas contextual; no espera a SmolLM2 ni a T5) → **voz inmediata** (caché Supertonic o `speechSynthesis` local). T5 y el score siguen en segundo plano. El 0–100 de conversación no se muestra (issue #95). El rail muestra el perfil ASR (`precision` / `latency`). Whisper sigue siendo el tramo largo; el profesor ya no suma 10 s + Supertonic.
6. Si no hay habla usable, tag no-habla o texto degenerado → **no** hay score 0–100
   (issue #75: estado `not-evaluated`, copy honesto; no se presenta como mala pronunciación). El 0–100 vive en **Repetir**.
7. `App.tsx` es un shell fino: enruta a `AsrBenchmarkScreen` / preview de shell Atelier (solo dev) o a `HomeScreen`; la orquestación de la app real vive en `ui/use-home-screen-session.ts`. Guías: `Documentacion general/IDENTIDAD-VISUAL.md`, `UI-UX-SHELL.md`.

**Avance 2 + persistencia local:** núcleo de producto cubierto; **IndexedDB** guarda historial de turnos (métricas/texto, sin audio). Aparte, solo en desarrollo, una segunda IndexedDB independiente guarda las fixtures de voz del banco de pruebas ASR (con audio crudo, nunca en Git).

Invariantes de mic: `app/src/audio/CAPTURE-INVARIANTS.md`. Reglas de equipo: `Documentacion general/REGLAS-DE-CODIGO.md`. Guía de capas: `app/README.md`.
