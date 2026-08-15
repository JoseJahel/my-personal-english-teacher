## 0. Metadatos
- **Hito:** Avance 2 / Entrega Final
- **Capa principal:** dsp
- **Capas secundarias:** audio, ui
- **Requisito matriz / enunciado:** RF-03, RF-04; *waveform, espectrograma, pitch tracking en tiempo real*
- **Tipo:** story
- **Asignado (reparto equitativo):** Jahel (@JoseJahel) — lote de laboratorio y defensa A2/Final pedido por Jahel; no redistribuye #57–#79
- **Rama de trabajo:** `jahel-frontend`
- **Prioridad rúbrica:** P0 (el #59 cubre el *dibujo*; este cubre que el dibujo sea *nuestro* DSP)

## 1. Contexto del producto (para IA y humanos)
El grafo de captura es `MediaStream → Analyser → Gain(0)` para onda/nivel y `MediaRecorder` para ASR. Espectrograma y YIN ya existen como dominio puro (`spectrogram.ts`, `pitch-detection-yin.ts`) pero corren **después** de Detener. #59 pide pintar espectro/pitch *durante* la escucha, previsiblemente leyendo el Analyser.

## 2. Problema u oportunidad
- El FFT del `AnalyserNode` es caja negra del navegador. En defensa: “¿esa STFT es la de ustedes?” — si #59 solo pinta `getFloatFrequencyData`, la respuesta es no.
- Un worklet que procese ASR rompería `CAPTURE-INVARIANTS.md`. El worklet, si existe, **solo empuja tramas PCM**; el análisis llama a `dsp/` puro.

## 3. Objetivo
Cuando esté cerrado, el espectrograma y el contorno F0 en vivo se calculan con **nuestra** FFT radix-2 y **nuestro** YIN sobre PCM real, a una tasa de tramas documentada, sin tocar el path MediaRecorder→Whisper.

## 4. Por qué importa
- Calidad técnica 40 %: tiempo real con *las mismas* funciones que el post-utterance.
- El frame en vivo y el de la utterance usan el mismo `radix2ForwardFft` / `estimatePitchWithYin`.
- #59 puede cerrar el hueco visual; este cierra el hueco de laboratorio.

## 5. Para qué
El estudiante ve F0 y espectro mientras habla; el evaluador puede preguntar la ecuación y señalar el archivo.

## 6. Alcance
### Incluye
- Bomba de tramas PCM en vivo (AudioWorklet **o** ScriptProcessor solo si se justifica; preferir Worklet).
- Análisis en hilo que **importe** `dsp/spectrogram.ts` y `dsp/pitch-detection-yin.ts` (o un wrapper fino). No reimplementar FFT.
- Cablear los canvas ya usados por #59 / `update-utterance-signal-views.ts`.
- Tasa de tramas y coste (ms/frame o % CPU) en test o reporte.
- Tests del adaptador de tramas (acumulador, hop, sin zero-pad mentiroso).

### No incluye
- Usar el worklet como fuente de ASR (invariante 6 de captura).
- Forzar `sampleRate` del `AudioContext`.
- Sustituir MediaRecorder.
- Rediseñar el shell Atelier.
- Completar #59 si César ya pinta desde Analyser: **reemplazar esa fuente de datos**, no borrar su UI.

## 7. Estado actual en el código (mapa para investigar)
- `app/src/audio/microphone-capture.ts`, `open-microphone-stream.ts`
- `app/src/audio/CAPTURE-INVARIANTS.md`
- `app/src/dsp/spectrogram.ts`, `radix2-forward-fft.ts`, `pitch-detection-yin.ts`
- `app/src/ui/waveform-canvas.ts` (Analyser)
- `app/src/ui/update-utterance-signal-views.ts`, `utterance-signal-canvas.ts`
- #59 — `.github/issue-bodies/03-live-spectrogram-pitch.md`

## 8. Dónde investigar la causa / el diseño actual
1. Leer invariantes de captura.
2. Ver qué fuente usa #59 (Analyser vs PCM).
3. Leer `spectrogram.ts` / YIN (defaults 25 ms / 10 ms / 70–400 Hz).
4. Diseñar acumulador de hop (no rellenar con ceros un frame incompleto).
5. Probar mic real: nivel + F0 se mueven al hablar.

## 9. Enfoques de solución aceptables
1. **Recomendado:** Worklet = solo copia de Float32; análisis en el hilo principal o worker liviano llamando `dsp/` (mismo código que post-stop).
2. Aceptable: análisis en el worklet **si** se bundlean las funciones puras y no se llama a transformers.
3. Prohibido: `getFloatFrequencyData` como única STFT “de curso”; ScriptProcessor como path ASR; Meyda.

## 10. Documentación y referencias
- Enunciado: visualizaciones en tiempo real
- `CAPTURE-INVARIANTS.md`, `dsp/README.md`, `REGLAS-DE-CODIGO.md` (≤400 líneas)
- #59, #66 (FFT vs DFT)
- MDN AudioWorklet

## 11. Plan de implementación sugerido (pasos)
- [ ] Acumulador puro + tests (hop, remainder, tiempo de trama)
- [ ] Worklet bomba PCM
- [ ] Pintar con `utterance-signal-canvas` / API live
- [ ] Tras stop, las vistas de utterance completa siguen usando el PCM del MediaRecorder
- [ ] Cifra de coste en reporte
- [ ] `cd app; pnpm lint; pnpm test; pnpm build` + smoke mic

## 12. Criterios de aceptación
- [ ] Live espectro y F0 **no** dependen del FFT del Analyser
- [ ] Mismas funciones `dsp/` que el análisis post-utterance
- [ ] MediaRecorder/ASR intacto; checklist de captura en verde
- [ ] Tasa de tramas o ms/frame documentados
- [ ] lint + test + build
- [ ] PR `jahel-frontend` → `main`

## 13. Pruebas
- Unitarias del acumulador (tono sintético → bin / F0 conocidos).
- Manual: hablar / callar; F0 sube con voz aguda; silencio no inventa 200 Hz estables.
- No ampliar a e2e de mic en CI.

## 14. Definición de hecho (DoD)
En `main`. Comentario con “fuente = dsp/YIN+STFT, no Analyser”. Un turno ASR sigue funcionando.
