## 0. Metadatos
- **Hito:** Entrega Final
- **Capa principal:** audio
- **Capas secundarias:** dsp, repo/docs
- **Requisito matriz / enunciado:** RF-21; marco teórico muestreo/Nyquist; calidad técnica 40 %
- **Tipo:** story
- **Asignado (reparto equitativo):** Jahel (@JoseJahel) — lote de laboratorio y defensa A2/Final pedido por Jahel; no redistribuye #57–#79
- **Rama de trabajo:** `jahel-frontend`
- **Prioridad rúbrica:** P0 (defensa de muestreo)

## 1. Contexto del producto (para IA y humanos)
La captura usa la tasa nativa del dispositivo (típicamente 44.1 o 48 kHz). Whisper, MFCC y el score trabajan a 16 kHz. Hoy `audio-resampler.ts` interpola linealmente y declara en comentario que **aún no hay anti-alias**. El curso pregunta por Nyquist, alias y fase del filtro, no por “un resample que suena bien”.

## 2. Problema u oportunidad
- **Hoy:** interpolación lineal; sin rechazo de banda medido; 44.1 kHz no es factor entero hacia 16 kHz.
- **#65** (Luna) pide el FIR mínimo + un test en dB. Este ticket **no lo duplica**: lo usa o lo absorbe y lo **supera**.
- Un FIR pensado solo para 48→16 (×3) no cubre auriculares a 44.1 kHz. Un FIR largo aplicado muestra a muestra no sirve para análisis en vivo.

## 3. Objetivo
Cuando esté cerrado, el path a 16 kHz es un remuestreador **propio de fase lineal**, válido en **44.1 y 48 kHz**, con cifra de stopband y retardo de grupo en el reporte, y más barato que convolucionar el FIR largo en cada muestra (polifase).

## 4. Por qué importa
- 40 % calidad técnica: muestreo es la pregunta más fácil de fallar en defensa.
- El score y Whisper heredan el alias que el lineal deje pasar.
- Publicar lineal vs FIR (misma senoide > Nyquist destino) deja el diseño medido en *este* resample.

## 5. Para qué
Audio de ASR/MFCC más limpio; evaluador ve tabla dB + retardo de *esta* cadena.

## 6. Alcance
### Incluye
- Filtro anti-alias de fase lineal (dominio puro) + decimación.
- Ruta **48 kHz → 16 kHz** (factor 3) y ruta **44.1 kHz → 16 kHz** (racional; no mentir que 44.1 es ×3).
- Implementación polifásica o equivalente documentado (coste por muestra publicado en test o reporte).
- Tests: tono en zona de alias → atenuación en dB; retardo de grupo o de pico; no crashear si `sampleRate` no es 44.1/48.
- Tabla en `reporte-verificacion.md` (lineal actual vs nuevo).
- `audio/README.md` + mención RF-21.

### No incluye
- Forzar `sampleRate` en `getUserMedia` / `AudioContext` (`CAPTURE-INVARIANTS.md`).
- Cambiar la tasa de Whisper.
- Meyda u otra lib de DSP en runtime.
- Sustituir MediaRecorder como path ASR.
- Deploy cloud.
- Rehacer #65 como ticket paralelo: si #65 sigue abierto y este PR cubre sus criterios, cerrar #65 como implementado aquí.

## 7. Estado actual en el código (mapa para investigar)
- `app/src/audio/audio-resampler.ts` — `resampleAudioSamples`, `resampleToWhisperRate`, `WHISPER_SAMPLE_RATE_IN_HERTZ`
- `app/src/audio/audio-resampler.test.ts`
- Callers: `ui/use-home-transcription-pipeline.ts`, `ui/run-pronunciation-scoring.ts`, `ui/use-asr-benchmark.ts`
- `app/src/audio/CAPTURE-INVARIANTS.md`
- Issue hermano: #65 (`.github/issue-bodies/lote-excelencia/09-fir-antialias.md`)

## 8. Dónde investigar la causa / el diseño actual
1. Leer `audio-resampler.ts` (comentario “No anti-aliasing low-pass yet”).
2. Grep `resampleToWhisperRate` / `resampleAudioSamples`.
3. `cd app; pnpm exec vitest run src/audio/audio-resampler.test.ts`
4. Contrastar con enunciado: preprocesamiento + teorema de muestreo.
5. Si #65 ya mergeó un FIR, **extenderlo**; no escribir un segundo filtro.

## 9. Enfoques de solución aceptables
1. **Recomendado:** FIR ventana (Hann/Kaiser) + banco polifásico. 48 kHz: decimación entera ×3. 44.1 kHz: racional (p. ej. 147/160 o etapa intermedia documentada), no “aproximar a 48”.
2. Aceptable: low-pass + resample existente solo como fallback si la tasa no es 44.1/48.
3. Prohibido: fijar orden o corte sin medirlos en *este* resample; forzar 48 kHz en constraints; lib nativa.

## 10. Documentación y referencias obligatorias
- Enunciado § muestreo / Nyquist / preproceso
- `CAPTURE-INVARIANTS.md`, `audio/README.md`, `REGLAS-DE-CODIGO.md` (≤400 líneas, dominio puro)
- #65, #73 (pasa-banda; no mezclar en este PR)
- Oppenheim/Schafer o equivalente: decimación + fase lineal

## 11. Plan de implementación sugerido (pasos)
- [ ] Extraer diseño del filtro a `dsp/` o `audio/` puro + tests de dB
- [ ] Polifase / factor racional
- [ ] Sustituir el path de Whisper/score; dejar lineal solo si se documenta fallback
- [ ] Tabla lineal vs FIR en reporte
- [ ] Coordinar cierre de #65 si aplica
- [ ] `cd app; pnpm lint; pnpm test; pnpm build`

## 12. Criterios de aceptación
- [ ] 48→16 y 44.1→16 cubiertos en tests (no un solo happy path de 48)
- [ ] Atenuación de alias en dB reproducible (constante exportada + aserción)
- [ ] Retardo de grupo o de pico publicado
- [ ] Un turno real en Chromium sigue transcribiendo
- [ ] RF-21 / reporte / `audio/README.md` actualizados
- [ ] lint + test + build
- [ ] PR `jahel-frontend` → `main`

## 13. Pruebas
- Unitarias: seno > 8 kHz antes de bajar a 16 kHz; impulso para retardo; tasas raras → no throw.
- Manual: una frase en restaurante, Chromium localhost.
- Capturar: fila de la tabla dB para el reporte.

## 14. Definición de hecho (DoD)
Código en `main`. Comentario de cierre con dB y las dos tasas. Sin regresión de mic (checklist `CAPTURE-INVARIANTS.md`).
