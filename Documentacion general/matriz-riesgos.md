# Matriz de riesgos — demo A2 / defensa

**Producto:** My Personal English Teacher (PWA localhost, sin host cloud).  
**Issue:** [#97](https://github.com/JoseJahel/my-personal-english-teacher/issues/97).  
**No sustituye:** presentación [#64](https://github.com/JoseJahel/my-personal-english-teacher/issues/64) (César) ni bitácora [#71](https://github.com/JoseJahel/my-personal-english-teacher/issues/71) (Saúl).  
**Uso:** leer en voz alta el día de aula. Mitigaciones = plan B en [preguntas-defensa.md](./preguntas-defensa.md#plan-b-demo-100-local).

Escala: probabilidad / impacto = Alta · Media · Baja.

| ID | Riesgo | P | I | Qué se ve | Mitigación (local) | Dueño |
|----|--------|---|---|-----------|--------------------|-------|
| R1 | Sin adapter WebGPU | Media | Alta | `small-en` cae a WASM (~11 s/frase, no viable para demo) | Decirlo en voz alta (no vender &lt; 2 s). Pasar a `pnpm dev:latency` (`tiny-en`). Cifra tiny-en: **no medida**. Fuente: `reporte-verificacion.md` §4–5, `ia/resolve-inference-device.ts` | Jahel |
| R2 | Primera descarga &gt; 1 GB no termina | Alta (aula / red mala) | Alta | Rail “Pendiente de descarga”; Whisper+T5 no arrancan | Precargar **antes** del slot. Si no hay red: `#shell-preview` / `-filled` / `-composing` (issue #81/#96). No `Ctrl+Shift+R`. Fuente: `app/README.md` (límites offline) | Jahel + César (#64) |
| R3 | `Ctrl+Shift+R` tira el caché de modelos | Media | Alta | Vuelve a bajar ~1 GB a mitad de demo | Recarga solo `F5`. Aviso en `app/README.md`. Plan B: preview ya instalada o hashes de shell | Quien opera la demo |
| R4 | Mic “sordo”: permiso OK, onda plana, ASR `[Music]` | Media | Alta | Hablar no transcribe; Whisper alucina no-habla | Checklist `app/src/audio/CAPTURE-INVARIANTS.md`. MediaRecorder sobre el `MediaStream` crudo; `AudioContext.resume()`. Lecciones 2026-07-22/23 en `REGLAS-DE-CODIGO.md` | Jahel |
| R5 | SmolLM2 tarda o suelta basura | Media | Media | Silencio de hasta 10 s; o línea rara | El chat **ya** muestra ASR+T5 antes (issue #96). Timeout 10 s + motor de reglas con **insignia honesta**. Fuente: `ui/tutor-reply-orchestration.ts`, `TUTOR_REPLY_TIMEOUT_MS` | Jahel |
| R6 | Score 0–100 mide locutor, no pronunciación | Media | Alta | Pregunta de tribunal: “¿no están midiendo el timbre?” | Hoy: z-score + pitch relativo + calibración half-score MFCC **16.5** / pitch **11.2** (`calibracion-score-pronunciacion.md`). **Δ locutor vs error aún no medida** (issue #95). Si preguntan: lo decimos; no inventamos Δ | Jahel (#95) |
| R7 | Resample lineal deja alias (44.1/48 → 16 kHz) | Baja (FIR en path Whisper) | Media | Pregunta Nyquist / anti-alias | Path 16 kHz es FIR fase lineal + polifase (`dsp/polyphase-resample.ts`). 12 kHz → ≥ 50 dB (medido ~85 dB). 44.1 no se trata como ×3 (160/441). Lineal solo si la tasa no es 44.1/48. No forzar `sampleRate` (`CAPTURE-INVARIANTS.md`). Issues #92 / #65 | Jahel (#92) |
| R8 | Cadena user ≠ ref TTS sesga el score | Media | Media | Score “raro” entre conversación y drill | Issue #73 (pasa-banda misma cadena) **abierto**. Hasta entonces: misma receta MFCC 25/10/13/40 en `dsp/mfcc-extraction.ts` | Luna (#73) |
| R9 | Confundir `pnpm dev` con demo offline | Media | Media | “Funciona sin red” en dev (el servidor local responde igual) | Demo de PWA **solo** `pnpm build && pnpm preview` (`app/README.md`, dos modos). Issue #70 (ensayo UI, César) no sustituye preview | César (#70) / Jahel |
| R10 | Proponer Pages / Vercel “por si acaso” | Baja (ya corregido) | Alta | Viola el enunciado y REGLAS §1.1 (lección 2026-08-03, issue #35) | **Prohibido.** Demo = localhost. GitHub = repo + CI, no runtime | Todo el equipo |
| R11 | Barge-in sin `spoken_progress` | Baja (arreglado) | Media | El tutor repite la lista entera | Ya en código: `PlayMonoPcmResult.cutoffMs` + `ui/spoken-progress.ts` (issue #46). Si regresa: no mergear captura/TTS sin el checklist | Jahel |
| R12 | Presentación y kit se pisan o se contradicen | Media | Media | Dos historias distintas en 15 min | Este kit **no** es el deck. Deck = #64. Evidencias por tarea = #71. Cifras solo las del `reporte-verificacion.md` | César (#64) / Saúl (#71) |
| R13 | Service Worker sirve un *app shell* viejo (p. ej. UI “Avance 1”) | Media | Alta | En `pnpm preview` se ve “Iniciar micrófono” / fase A1 en vez del shell Atelier | Ventana privada, o DevTools → Application → Unregister SW + Clear site data, luego `F5`. El `dist/` fresco sí es Atelier; el SW cachea el HTML/JS anterior. Verificado 2026-08-15 en `http://localhost:4173` | Quien opera la demo |

**Lectura para el slot:** si R2 o R1 se materializan, no improvisar un host. Ir al plan B local.
