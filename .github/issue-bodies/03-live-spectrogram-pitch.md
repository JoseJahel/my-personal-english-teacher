## 0. Metadatos
- **Hito:** Avance 2 / Entrega Final
- **Capa principal:** ui
- **Capas secundarias:** dsp, audio
- **Requisito matriz / enunciado:** RF-03, RF-04; enunciado: *waveform, espectrograma, pitch tracking **en tiempo real** usando Web Audio API*
- **Tipo:** story
- **Asignado (reparto equitativo):** César (@cesarubau-droid) — carga media; experiencia reciente en UX home/offline
- **Rama de trabajo:** `cesar-frontend`
- **Prioridad rúbrica:** P0 (incumplimiento literal de visualizaciones en tiempo real)

## 1. Contexto del producto (para IA y humanos)
Durante la captura hay un grafo Web Audio: `MediaStreamSource → AnalyserNode` para onda y nivel en vivo. Tras detener, el PCM de la utterance alimenta espectrograma STFT y pitch YIN **offline** (post-utterance). El enunciado pide explícitamente visualizaciones **en tiempo real**.

## 2. Problema u oportunidad
- **Hoy:**  
  - Waveform: **live** (`waveform-canvas.ts` + rAF).  
  - Espectrograma y pitch: **última utterance** (`update-utterance-signal-views.ts`; textos UI: “última utterance”).
- **Enunciado:** espectrograma y pitch tracking en tiempo real.
- **No cumple estricto:** solo 1 de 3 visualizaciones es live.

## 3. Objetivo
Mientras el mic está en escucha, el usuario ve **actualizarse** un espectrograma (o waterfall) y un contorno/indicador de pitch en vivo, además del waveform existente. Tras el stop, se pueden conservar las vistas de utterance completa.

## 4. Por qué importa
- Core de Señales y Sistemas en la demo (el profe ve “tiempo real”).
- Diferencia entre “tenemos los algoritmos” y “cumplimos el enunciado de visualización”.

## 5. Para qué
Feedback inmediato de que la voz se analiza espectralmente y en F0 mientras se habla; demo más convincente.

## 6. Alcance
### Incluye
- Pipeline live desde `AnalyserNode` (time domain y/o frequency domain) durante `isListening`.
- Canvas o reutilizar `spectrogramCanvas` / `pitchTrackCanvas` en modo live.
- Rendimiento aceptable en Chromium (throttle de frames si hace falta, p. ej. 15–30 fps).
- No romper invariantes de captura (`CAPTURE-INVARIANTS.md`): Analyser solo visualización; MediaRecorder sigue siendo la fuente ASR.
- Textos ES actualizados (quitar o matizar “solo última utterance” si hay modo live).
- Tests de funciones puras de preparación de frames si se extrae lógica; tests de canvas con mocks si ya hay patrón.

### No incluye
- AudioWorklet obligatorio (opcional si hace falta).
- Cambiar ASR/modelos.
- Score de pronunciación.
- Perfecta precisión YIN en ventanas muy cortas live (documentar límites).

## 7. Estado actual en el código (mapa para investigar)
- `app/src/ui/waveform-canvas.ts` — patrón rAF + Analyser
- `app/src/ui/use-home-microphone-session.ts` — arranca animación waveform
- `app/src/ui/update-utterance-signal-views.ts` — post-utterance
- `app/src/ui/utterance-signal-canvas.ts`
- `app/src/dsp/spectrogram.ts`
- `app/src/dsp/pitch-detection-yin.ts`
- `app/src/audio/CAPTURE-INVARIANTS.md`
- `app/src/ui/interface-texts.ts` — labels espectrograma/pitch
- `app/src/ui/HomeScreen.tsx` — canvas refs

## 8. Dónde investigar la causa / el diseño actual
1. Leer `CAPTURE-INVARIANTS.md`.
2. Seguir `startAnalyserWaveformAnimation` y dónde se llama.
3. Ver cuándo se llama `updateUtteranceSignalViews` (tras stop).
4. Medir qué expone `AnalyserNode` (`getFloatTimeDomainData` / `getFloatFrequencyData`).
5. Decidir: STFT propia sobre ring buffer de time-domain vs barra de frecuencias del Analyser para “espectrograma live”.
6. Probar en Chrome: escuchar y observar CPU.

## 9. Enfoques de solución aceptables
1. **Recomendado:** ring buffer de samples del Analyser → cada N ms `extractMfcc` no; **spectrogram slice** + **YIN en ventana corta** sobre el buffer; pintar scrolling spectrogram + punto/línea de F0.
2. Usar `getFloatFrequencyData` para un espectrograma “bar graph” scrolling (menos fiel a STFT del dominio, pero “tiempo real” visible) + YIN en time-domain. Documentar la diferencia con el STFT post-utterance.
3. AudioWorklet que publique frames — solo si (1) no rinde.

Prohibido: grabar con stream sintético; mover ASR al Analyser; bloquear el hilo principal con FFT enormes sin throttle.

## 10. Documentación y referencias obligatorias
- Enunciado: visualizaciones en tiempo real.
- MDN: AnalyserNode, Web Audio API.
- `app/src/audio/CAPTURE-INVARIANTS.md`
- `app/src/ui/README.md`, `app/src/dsp/README.md`
- `REGLAS-DE-CODIGO.md`
- `GUIA-CREACION-ISSUES.md`

## 11. Plan de implementación sugerido
1. Extraer helper puro “frame live → columna spectro + f0?” con tests si aplica.
2. Hook/animación paralela al waveform en `use-home-microphone-session`.
3. Modo live en canvas; al stop, opcionalmente sobrescribir con vista full-utterance (ya existente).
4. Textos ES + matriz RF-03/RF-04.
5. lint/test/build + prueba manual.

## 12. Criterios de aceptación
- [ ] Con mic en escucha, espectrograma (o equivalente scrolling de espectro) **se mueve sin pulsar Detener**
- [ ] Con mic en escucha, hay indicación de pitch/F0 en vivo (valor y/o trazo)
- [ ] Waveform live sigue funcionando
- [ ] Tras stop, pipeline ASR/gramática/tutor no regresa
- [ ] Invariantes de captura respetados
- [ ] Textos UI y matriz actualizados
- [ ] lint + test + build OK

## 13. Pruebas
- Manual: Chrome → Escuchar → hablar → ver movimiento en ambos canvas antes de Detener.
- Unitarias: helpers de conversión de frames si se extraen.
- Performance: no freeze de UI en frase de 5–10 s.

## 14. Definición de hecho (DoD)
- PR `cesar-frontend` → `main` mergeado.
- Comentario con nota de verificación manual (o captura).
- Issue cerrado.

**Labels sugeridos:** `avance-2`, `entrega-final`, `type:story`, `layer:ui`, `layer:dsp`, `person:cesar`, `enhancement`
