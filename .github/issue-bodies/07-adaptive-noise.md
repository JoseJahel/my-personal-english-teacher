## 0. Metadatos
- **Hito:** Entrega Final
- **Capa principal:** audio / dsp
- **Requisito matriz / enunciado:** RF-23 filtrado adaptativo de ruido (innovación / edge cases); marco teórico menciona filtrado adaptativo; rúbrica Innovación 10 %
- **Tipo:** story
- **Asignado (reparto equitativo):** Luna (@luna0809-oss) — segundo ticket del lote (DSP/audio); continuidad #30
- **Rama de trabajo:** `luna-frontend`
- **Prioridad rúbrica:** P2 (extensión; no core mínimo, sí cierra matriz Pendiente e innovación)

## 1. Contexto del producto
Preproceso actual: mono, normalización de pico, trim de silencio, resample 16 kHz, gate de energía, VAD. No hay filtro adaptativo de ruido documentado como módulo.

## 2. Problema
RF-23 está **Pendiente**. El enunciado y el marco teórico mencionan filtrado / robustez a ruido. #30 endureció edge cases pero no implementó un filtro adaptativo explícito.

## 3. Objetivo
Implementar un **preproceso de reducción de ruido simple y defendible** (p. ej. noise gate espectral básico, substracción de ruido de piso estimado en los primeros ms, o filtro pasa-altas + smoothing) en dominio puro, con tests, cableado opcional en el pipeline pre-ASR, y documentación en matriz RF-23.

## 4. Por qué importa
- Innovación 10 % y cierre de RF-23.
- Demo con ruido de fondo ligero más estable.

## 5. Para qué
Mejorar robustez educativa sin romper voz; material de marco teórico “aplicado”.

## 6. Alcance
### Incluye
- Módulo puro en `dsp/` o `audio/` (preferir `dsp/` si es señal; `audio/` si es solo buffer util).
- Tests con señal + ruido sintético.
- Integración opcional/flag en pipeline de utterance.
- Matriz RF-23 → Implementado o Parcial con límites honestos.

### No incluye
- ML de denoising en la nube.
- RNNoise WASM obligatorio (opcional solo si cabe offline y se justifica; preferir implementación propia simple por el curso).

## 7. Estado actual
- `app/src/audio/normalize-peak.ts`, `trim-speech-silence.ts`, `capture-diagnostics.ts`
- `app/src/dsp/signal-energy.ts`, `voice-activity-detection.ts`
- Matriz RF-22/RF-23
- Issue #30

## 8. Investigación
1. Leer pipeline post-captura hasta Whisper.
2. Decidir algoritmo simple alineado a Señales y Sistemas (espectral / energía).
3. Medir que no destruye MFCC del score (comparar score antes/después en fixture sintética).

## 9. Enfoques aceptables
1. **Recomendado:** estimación de ruido de piso en cola inicial de silencio + substracción espectral suave / Wiener simplificado sobre STFT.
2. High-pass + noise gate por banda de energía — más simple, documentar como “adaptativo ligero”.
Prohibido: servicio cloud de denoising.

## 10. Referencias
- Enunciado edge cases ruido.
- `dsp/README.md`, `audio/README.md`
- `REGLAS-DE-CODIGO.md`
- RF-23

## 11. Plan
1. Algoritmo puro + tests.
2. Cablear pre-Whisper.
3. Docs + matriz.
4. PR.

## 12. Criterios de aceptación
- [ ] Módulo de filtrado/reducción de ruido en código
- [ ] Tests deterministas
- [ ] Pipeline puede usarlo sin romper ASR en audio limpio
- [ ] RF-23 actualizado
- [ ] lint/test/build OK

## 13. Pruebas
- Unitarias sintéticas.
- Manual: hablar con ventilador bajo; ver si ASR empeora o mejora.

## 14. DoD
- PR mergeado; issue cerrado.

**Labels sugeridos:** `entrega-final`, `type:story`, `layer:dsp`, `layer:audio`, `person:luna`, `enhancement`
