# Preguntas de defensa (DSP / IA / producto)

**Issue:** [#97](https://github.com/JoseJahel/my-personal-english-teacher/issues/97).  
**Uso:** 12–21 respuestas listas para el tribunal. Cada una cita **cifra o path de este repo**. No inventar milisegundos.  
**No es** el deck de 10–15 min ([#64](https://github.com/JoseJahel/my-personal-english-teacher/issues/64)) ni la bitácora de evidencias ([#71](https://github.com/JoseJahel/my-personal-english-teacher/issues/71)).  
**Riesgos y dueños:** [matriz-riesgos.md](./matriz-riesgos.md).  
**Cifras maestras:** [reporte-verificacion.md](./reporte-verificacion.md).

---

## Q1. ¿Por qué remuestrean a 16 kHz? ¿Y Nyquist?

La voz útil está por debajo de ~8 kHz. El teorema exige \(f_s \ge 2 f_{\max}\); 16 kHz cumple Nyquist para esa banda y es la tasa que Whisper y nuestros MFCC esperan. Capturamos a la tasa **nativa** del dispositivo (típicamente 44.1 o 48 kHz) y bajamos con un FIR de fase lineal (`dsp/polyphase-resample.ts`): 48 kHz es decimación ×3; 44.1 kHz es racional 160/441. Un tono de 12 kHz (zona de alias) se atenúa **≥ 50 dB** (medido ~85 dB); el lineal del Avance 1 deja ~0 dB a 48 kHz.

**Fuente:** `documento-tecnico.md` §5.1; `reporte-verificacion.md` §5.5; `audio/audio-resampler.ts`.

## Q2. ¿Por qué no fuerzan `sampleRate: 16000` en `getUserMedia`?

En varios drivers de Windows eso devuelve silencio o un grafo “sordo”. La captura ASR va por **MediaRecorder sobre el `MediaStream` crudo**; el grafo Web Audio solo pinta onda/nivel. Forzar canales o tasa rompe invariantes.

**Fuente:** `app/src/audio/CAPTURE-INVARIANTS.md`; lecciones 2026-07-22/23 en `REGLAS-DE-CODIGO.md`.

## Q3. ¿Esa FFT es de ustedes o la del navegador?

La de producto es **radix-2 Cooley–Tukey propia** (`dsp/radix2-forward-fft.ts`), compartida por espectrograma y MFCC. Se verifica contra la DFT \(O(N^2)\) (`dsp/dft-reference.ts`, solo tests): error máximo absoluto **&lt; 1e-10** en Float64 (impulso, coseno de bin, Parseval). El `AnalyserNode` **no** es nuestra STFT de curso.

**Fuente:** `reporte-verificacion.md` §5.1 (issue #66); `dsp/radix2-forward-fft.ts`.

## Q4. ¿Cómo calculan el espectrograma?

STFT con ventana Hann **25 ms**, hop **10 ms**, magnitud en escala log. Un tono de 1 kHz a 16 kHz cae a menos de 1.5 bins del bin analítico. Post-utterance se pinta en `ui/utterance-signal-canvas.ts`. En vivo (issue #93) la misma STFT corre sobre PCM del worklet; el `AnalyserNode` no es la FFT de curso.

**Fuente:** `dsp/spectrogram.ts`; `reporte-verificacion.md` §5.1.

## Q5. ¿Por qué YIN y no autocorrelación simple?

YIN usa la función de diferencia normalizada acumulada y un umbral absoluto: reduce errores de octava, el fallo típico al rastrear F0 de voz. Banda de habla **70–400 Hz**. Dominio puro en `dsp/pitch-detection-yin.ts`.

**Fuente:** `documento-tecnico.md` §5.4; `dsp/pitch-detection-yin.ts` (De Cheveigné & Kawahara, 2002).

## Q6. ¿Los MFCC son de una librería?

No. Implementación propia (pre-énfasis 0.97, Hann 25 ms, hop 10 ms, **13** coeficientes, **40** filtros mel, DCT-II). **No hay Meyda ni librosa en runtime ni en CI.** Vectores dorados en `dsp/mfcc-golden-vectors.json`, cota **1e-5** (issue #67).

**Fuente:** `dsp/mfcc-extraction.ts`; `reporte-verificacion.md` §5.2.

## Q7. ¿Por qué DTW y no distancia euclidiana trama a trama?

Nadie habla al mismo tempo que la referencia TTS. Sin alineación, la distancia castiga el ritmo. DTW alinea las secuencias de MFCC (coste local L2); el coste acumulado se mapea a 0–100.

**Fuente:** `dsp/dynamic-time-warping.ts`; `documento-tecnico.md` §5.5 (Sakoe & Chiba).

## Q8. ¿Cómo obtuvieron WER 0.000?

WER = \((S+D+I)/N\) a nivel de palabra tras normalizar (`ia/word-error-rate.ts`). El banco `#asr-benchmark` (2026-07-29) midió **WER 0.000** de `whisper-small.en` sobre **nuestras** fixtures de referencia (audio nunca en Git). No afirmamos WER 0 en cualquier acento o ruido.

**Fuente:** `reporte-verificacion.md` §3–4; `ia/word-error-rate.ts`.

## Q9. El enunciado pide &lt; 2 s. Ustedes tienen 3.4 s. ¿Qué pasa?

El default de **entrega** es `small-en` (~3.4 s/frase WebGPU, ~11 s WASM). **No cumple** 2 s en ASR; lo elegimos por WER. Issue #96 define el presupuesto de 2 s como el **feedback ASR+T5 visible en el chat**, no SmolLM2 ni TTS. `tiny-en` existe (`pnpm dev:latency`) y su latencia está **no medida**.

**Fuente:** `reporte-verificacion.md` §5; `ia/model-registry.ts`; issue #61/#96.

## Q10. ¿Por qué no publican en GitHub Pages o Vercel?

El producto es **offline-first en el navegador del estudiante**. Un host remoto diluye esa demo y contradice el enunciado. GitHub es solo repo + CI. Lección 2026-08-03 (issue #35).

**Fuente:** `CONTRIBUTING.md` (constraints); `REGLAS-DE-CODIGO.md` §1.1.

## Q11. ¿Por qué solo inglés (`.en`)?

A peso comparable, las variantes entrenadas solo en inglés rinden mejor para el único idioma de práctica. Multi-idioma está **descartado** (RE-05).

**Fuente:** `README.md` (decisiones); `matriz-trazabilidad.md` RE-05.

## Q12. ¿Por qué T5 Xenova y no otro corrector?

`Xenova/t5-base-grammar-correction` tiene port ONNX documentado para transformers.js. La alternativa evaluada no tenía port verificado: riesgo de Avance 1.

**Fuente:** `README.md` (vennify/T5); `ia/model-registry.ts`; `ia/grammar-correction.ts`.

## Q13. ¿Qué pasa si el estudiante interrumpe al tutor?

Half-duplex: el mic se bloquea **solo** mientras Supertonic habla (issue #96). Si corta a mitad, registramos `cutoffMs` → `spoken_progress` y clasificamos el turno **solo** con el fragmento oído (casos A/B/C/D, issue #46).

**Fuente:** `ui/spoken-progress.ts`; `audio/play-pcm-mono.ts`; `REGLAS-DE-CODIGO.md` (2026-08-09).

## Q14. ¿Funciona de verdad sin internet?

Sí: comprobado el 2026-08-21, manualmente, por el autor — turno completo de
práctica corrido con el servidor **detenido**, sobre `pnpm build` +
`pnpm preview` (`http://localhost:4173`).

Tras **una** descarga (Cache API de transformers.js, &gt; 1 GB). ASR, gramática y Supertonic se precargan **juntos al abrir**; SmolLM2 se precarga al elegir escenario (`ia/warm-model-preload.ts`; el propio comentario de `ui/offline-readiness.ts` lo resume así: “ASR, grammar and Supertonic preload on mount; SmolLM2 on scenario selection”). El aviso del rail sale de `storage/model-load-history.ts`, no de espiar el caché (los eventos de progreso no distinguen red vs caché en transformers.js 3.8.1).

Hay un archivo que ese aviso **no** cuenta: la voz de referencia F1 (`voices/F1.bin`, 51 712 bytes), que no pasa por el cargador de pesos de la librería (`getModelFile`/`hub.js`). Antes se traía sin caché recién en el primer turno hablado; ahora `preloadTutorVoiceEmbeddings` la descarga durante ese mismo warm preload y la persiste en el bucket `transformers-cache` de Cache Storage (`ia/text-to-speech-synthesis.ts`) — pero sigue fuera de `OFFLINE_READINESS_MODEL_KEYS` (`ui/offline-readiness.ts`), así que el rail puede marcar los cuatro modelos como listos sin que ese archivo termine de bajar; el indicador sigue sin contarlo aunque el funcionamiento sin red ya se comprobó manualmente (arriba) — el 2026-08-21 `voices/F1.bin` apareció en el bucket `transformers-cache` de Cache Storage tras la precarga. Si esa precarga falla, no rompe el turno: `synthesizeSpeechFromText` cae al fetch propio de la librería (`ia/warm-model-preload.ts`) y el fallo queda en consola.

Verificar siempre con `pnpm preview`, no con `pnpm dev`.

**Fuente:** `app/README.md` (checklist offline y límites); `ia/warm-model-preload.ts`; `ia/text-to-speech-synthesis.ts`; `ui/offline-readiness.ts`.

## Q15. ¿El tutor es “IA” o un guion?

Híbrido. La apertura es guion curado. Cada turno: SmolLM2 con memoria de **4** turnos y timeout **10 s**; si no llega o es implausible, línea del motor de reglas (`ui/tutor-reply-engine.ts`) con **insignia honesta** — nunca se hace pasar por el modelo.

**Fuente:** `ui/tutor-reply-orchestration.ts`; `ia/conversation-suggestions.ts`.

## Q16. ¿El 0–100 está calibrado?

Mapeo \(\mathrm{score}=100\exp(-\ln 2\cdot d/d_{1/2})\). Producción: \(d_{1/2}\) MFCC **16.5**, pitch **11.2** (issue #29). El combinado (issue #58) añade energía y formantes con pesos provisionales 0.68 / 0.18 / 0.07 / 0.07. Issue **#95** (re-medido tras #58): mismo contenido a 120 vs 210 Hz baja el score **11.3** puntos; cambiar vocales al mismo F0 baja **9.9** (ratio **1.14**). Por eso el 0–100 de conversación se **apaga** y vive en **Repetir**. No inventamos Δ.

**Fuente:** `dsp/speaker-bias-invariants.ts`; `calibracion-score-pronunciacion.md` §6.

## Q17. ¿El gate de energía y el VAD son lo mismo?

No. El **gate** (`dsp/signal-energy.ts`) corre *después* de Detener: no manda silencio a Whisper. El **VAD** (`dsp/voice-activity-detection.ts`) es auto-stop con hangover ~**0.9 s** de silencio tras habla. Issue #75: si no hay habla útil o Whisper inventa `[Music]`, **no** hay score 0–100.

**Fuente:** `dsp/signal-energy.ts`; `dsp/voice-activity-detection.ts`; `ui/pronunciation-score-eligibility.ts`.

## Q18. Si el aula no tiene GPU o no baja los modelos, ¿qué hacen?

Plan B **local** (siguiente sección). Nunca un URL público.

**Fuente:** esta página, `app/README.md`, `#shell-preview*`.

## Q19. ¿Por qué cambiaron el motor de voz (SpeechT5 → Supertonic)?

Por descarga y por soporte. SpeechT5 (`Xenova/speecht5_tts` + vocoder aparte `Xenova/speecht5_hifigan` + un speaker embedding demo genérico) pesaba en fp32, medido por `Content-Length`: encoder 342 803 468 B + decoder_model_merged 244 486 683 B + decoder_postnet_and_vocoder 55 432 026 B ≈ **613 MB**. Supertonic (`onnx-community/Supertonic-TTS-ONNX` @ `cff123c84b0655d9d647641f1b532c3cbb8f7faa`), mismo dtype y mismo método de medida: text_encoder ~27.5 MB + latent_denoiser ~126.4 MB + voice_decoder ~96.8 MB ≈ **250.7 MB**. Ahorro neto **~362 MB** sobre el presupuesto de descarga (&gt; 1 GB, issue #96). Es autocontenido — tres sesiones ONNX encadenadas (*text encoder* → *latent denoiser* → *voice decoder*) que decodifican la forma de onda directamente, sin vocoder aparte — y la versión de `@huggingface/transformers` que ya usa el proyecto (**3.8.1**, publicada 2025-12-02) lo soporta de forma nativa vía `pipeline('text-to-speech', ...)`, porque el PR de soporte en la librería se mergeó el 2025-11-19.

Riesgo que declaramos, no escondemos: el 23 de julio de 2026 Supertone archivó el proyecto open source de Supertonic — su Voice Builder deja de estar accesible después del 31 de agosto de 2026. Los pesos siguen alojados en el espejo `onnx-community` de Hugging Face (hosting de Hugging Face, no de Supertone), así que la descarga del modelo no depende de esa empresa; pero no habrá más correcciones ni la cuantización prometida, y solo existe fp32 (no hay q8/fp16 publicados). Tampoco hay todavía validación perceptual de la voz F1 en el navegador de este proyecto ni latencia de síntesis medida sobre WASM — las cifras publicadas por el autor son de ejecución nativa CPU/GPU, no de navegador.

**Fuente:** `matriz-riesgos.md` R14; `documento-tecnico.md` §5.7; `ia/model-registry.ts`; `ia/text-to-speech-synthesis.ts`.

## Q20. La comparación se hace a 16 kHz, pero Supertonic sintetiza a 44.1 kHz. ¿Por qué fijan la tasa así?

`ui/run-pronunciation-scoring.ts` fija la tasa de trabajo a `WHISPER_SAMPLE_RATE_IN_HERTZ` (16 kHz, `audio/audio-resampler.ts`) en vez de heredarla de `synthesized.sampleRateInHertz` (44.1 kHz en Supertonic). Es un problema de Señales y Sistemas, no un capricho: el banco de 40 filtros mel (`dsp/mfcc-extraction.ts`) reparte sus bordes hasta Nyquist por defecto — a 44.1 kHz eso es 22.05 kHz — mientras el pasa-banda de voz compartido usuario/referencia corta en 7 500 Hz (`dsp/biquad-voice-bandpass.ts`, issue #73). Eso deja cerca de una docena de filtros mel por encima del corte, pegados al suelo logarítmico; como la DCT-II mezcla todas las bandas mel en cada coeficiente, los 13 MFCC completos se correrían y las constantes de calibración (distancia MFCC a media escala 16.5, pesos del score combinado 0.68/0.18/0.07/0.07) dejarían de aplicar.

Fijar la tasa a 16 kHz preserva esa alineación: tanto el audio del alumno como la referencia TTS pasan por el mismo remuestreo racional 160/441 con FIR de fase lineal (atenuación de alias medida **86.6 dB**, issues #92/#65) y el mismo pasa-banda 80 Hz–7.5 kHz (`audio/prepare-speech-pcm.ts`), sin importar la tasa nativa del sintetizador.

**Fuente:** `ui/run-pronunciation-scoring.ts`; `documento-tecnico.md` §5.5; `dsp/mfcc-extraction.ts`; `dsp/biquad-voice-bandpass.ts`.

## Q21. ¿Qué es el modo de estudio? ¿De dónde sale el temario y cómo funciona la repetición espaciada?

Es una sexta capa de dominio puro (`study/`, sin React/DOM/`ui`/`ia`/`audio`/`storage`, igual que `dsp/`), accesible en el hash `#estudio` (`shouldShowStudyScreen` en `app-routing.ts`), cuarto ítem del rail izquierdo (`railNavStudy` en `ui/practice-shell-types.ts`). El temario son **36 lecciones** en markdown con frontmatter YAML bajo `estudio/procesado/`, cargadas con `import.meta.glob` (`study/load-processed-lessons.ts`) y parseadas en `study/parse-lesson-markdown.ts`; de ahí se agrupan en bloques y se extraen ítems de práctica (`study/group-study-blocks.ts`, `study/extract-practice-items.ts`, `study/practice-bank.ts`).

Hay **cuatro modos de práctica** (`PRACTICE_MODES` en `study/study-types.ts`): vocabulario, completar, traducir y transformar. La repetición espaciada (`study/practice-srs.ts`) es un SM-2 adaptado: intervalos en horas 0.5 / 4 / 24 / 72 / 168 / 336 / 720 / 1440; factor de facilidad acotado entre 1.3 y 3.0 (inicial 2.3, +0.05 al acertar, −0.2 al fallar); tras un fallo la tarjeta vuelve en 60 s; y la siguiente tarjeta se elige por peso (nueva +16, vencida +8, hasta +6 por fallos previos). La dirección de práctica (`study/practice-direction.ts`) es es→en, en→es o mixta, con tarjetas SRS independientes por dirección. El marcapáginas de reanudación (`study/study-bookmark.ts`) pide confirmación al moverlo y respeta `prefers-reduced-motion`. Todo se persiste en `storage/study-document-store.ts`, la tercera base IndexedDB del proyecto junto a la de progreso de práctica (`storage/session-repository.ts`) y la del banco de pruebas ASR (`storage/benchmark-fixture-store.ts`).

Es alcance nuevo, fuera del lote de rúbrica original (#57–#79, #81, #92–#98): entró por PRs #122 y #125 y está documentado como RF-24 a RF-28 en `matriz-trazabilidad.md`.

**Fuente:** `matriz-trazabilidad.md` (RF-24 a RF-28); `study/practice-srs.ts`; `study/study-bookmark.ts`; `study/practice-direction.ts`; `app-routing.ts`.

---

## Plan B — demo 100 % local

Tres escalones. Bajar de escalón si el de arriba falla. **Ninguno usa Vercel, Pages, Netlify ni un host.**

### Escalón A — demo de producto (objetivo)

```text
cd app
pnpm build
pnpm preview
```

Abrir `http://localhost:4173` (no hace falta HTTPS). Precargar modelos **con red**. Recargar con `F5`, nunca `Ctrl+Shift+R`. Instalar la PWA si da tiempo. Cortar el servidor y comprobar un turno. Checklist largo: `app/README.md` (“Checklist de demo offline”).

Si la máquina no tiene WebGPU: decir ~11 s WASM y cambiar a escalón B.

Si la pantalla dice **“Avance 1”** o **“Iniciar micrófono”** (no “Hablar” / rail Atelier): el Service Worker está sirviendo un shell viejo. Abrir ventana privada, o Application → Unregister SW + Clear storage, y recargar con `F5`. Riesgo R13.

### Escalón B — perfil latencia (ASR más chico)

```text
cd app
pnpm dev:latency
```

o `pnpm build:latency` + `pnpm preview`. El rail debe decir **Perfil latencia · tiny-en**. Default de entrega **sigue siendo** `small-en`. **No afirmar** que tiny-en cumple 2 s (`reporte-verificacion.md` §5: no medido).

### Escalón C — ensayo de UI sin mic ni 1 GB

Con `pnpm dev`:

| Hash | Qué muestra |
|------|-------------|
| `#shell-preview` | Shell idle |
| `#shell-preview-filled` | Turno completo (score, highlights) |
| `#shell-preview-listening` | Mic en escucha |
| `#shell-preview-composing` | Frase del estudiante + “Escribiendo…” + Hablar **habilitado** (issue #96) |

Esto es el HomeScreen con fixtures (#81/#96). El ensayo *inyectando* mocks en el hook real es el issue **#70** (César) + **#98** (contratos). No es un segundo producto.

### Si el mic está sordo

1. Permiso del navegador.  
2. `CAPTURE-INVARIANTS.md`: `AudioContext` en el clic, `resume()`, MediaRecorder sobre el stream crudo.  
3. No forzar `channelCount: 1` ni `sampleRate` en constraints.  
4. Si Whisper suelta `[Music]`: no es “mala pronunciación”; el gate / filtro de no-habla debe cortar (issue #75).

### Lo que no se hace nunca

Publicar la PWA, abrir un túnel, o decir que CI de GitHub “es la app en producción”.
