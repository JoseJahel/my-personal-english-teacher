## 0. Metadatos
- **Hito:** Entrega Final
- **Capa principal:** dsp / audio
- **Requisito:** RF-21 preprocesamiento; RF-22 robustez; marco teórico filtrado
- **Tipo:** story
- **Asignado (reparto equitativo):** Luna (@luna0809-oss)
- **Rama:** `luna-frontend`
- **Prioridad:** P1 (cadena de voz de libro)

## 1–2. Contexto / problema
Tras anti-alias/resample, la voz humana se beneficia de un **pasa-banda** (p. ej. ~80 Hz – ~7.5–8 kHz) + normalización RMS/pico coherente antes de ASR/features. Hoy hay normalización/trim/gate; falta un filtro de banda **explícito, testeado y medido** (respuesta en corte ~-3 dB).

## 3. Objetivo
Implementar biquad/Butterworth (o cascada) pasa-banda en dominio puro, cablearlo en preproceso de utterance, tests de respuesta en frecuencia con senoides, documentar f_c y atenuación.

## 4–5. Por qué / para qué
Contenido clásico de Señales; reduce rumble/DC y agudos inútiles; métrica en reporte.

## 6. Alcance
### Incluye
- `dsp/` filtro IIR o FIR pasa-banda + tests.
- Integración en cadena pre-Whisper / pre-score (misma cadena user y ref TTS — **crítico** para no sesgar score).
- Nota en reporte + matriz.
### No incluye
- Filtrado adaptativo completo (issue #63).
- Romper idempotencia: documentar si el filtro es de una sola pasada.

## 7. Mapa
- `audio/normalize-peak.ts`, `trim-speech-silence.ts`
- `dsp/signal-energy.ts`
- `ui/run-pronunciation-scoring.ts` (misma cadena en ref)

## 9. Enfoques
1. **Recomendado:** biquad cascada HP+LP documentada.
2. FIR pasa-banda — más costo CPU.

## 12. Criterios
- [ ] Filtro puro + tests de tono en/out of band
- [ ] Misma cadena en user y referencia de score
- [ ] Métrica de corte en reporte
- [ ] lint/test/build

## 14. DoD
PR mergeado.

**Labels:** `entrega-final`, `type:story`, `layer:dsp`, `layer:audio`, `person:luna`, `enhancement`
