## 0. Metadatos
- **Hito:** Entrega Final (refuerzo Avance 2 en marco teórico)
- **Capa principal:** dsp / audio
- **Requisito:** RF-21 preprocesamiento; marco teórico muestreo/Nyquist; calidad técnica 40 %
- **Tipo:** story
- **Asignado (reparto equitativo):** Luna (@luna0809-oss) — continuidad DSP; carga histórica media-baja
- **Rama:** `luna-frontend`
- **Prioridad:** P0 diferenciación (señales medibles)

## 1. Contexto
La app remuestrea a 16 kHz para Whisper/MFCC. El curso evalúa **muestreo, anti-aliasing y filtrado** como contenido de Señales y Sistemas. Hoy el resampler existe, pero falta una cadena de **filtro anti-alias explícito + métricas publicables** (dB de rechazo, retardo) en tests y en el reporte.

## 2. Problema
Sin FIR (o equivalente documentado) antes de decimar/bajar tasa, y sin cifras de atenuación de alias, el preproceso se ve “de ingeniería web” y no de laboratorio de señales, aunque el resto del DSP sea sólido.

## 3. Objetivo
Implementar (o formalizar) **filtrado anti-alias + remuestreo/decimación** con tests sintéticos que midan rechazo de componentes > Nyquist destino, y documentar resultados en el reporte de verificación.

## 4. Por qué importa
Calidad técnica 40 % y defensa del marco teórico (Nyquist, aliasing). Diferencia un proyecto “con modelos HF” de uno “con procesamiento de señales de verdad”.

## 5. Para qué
Audio más limpio a 16 kHz y evidencia numérica en documento/PDF.

## 6. Alcance
### Incluye
- Módulo puro (p. ej. FIR ventana Hann / sinc truncado) o mejora de `audio-resampler.ts` con anti-alias explícito.
- Tests: tono por encima de Nyquist destino → atenuación medida en dB (umbral mínimo documentado).
- Medir retardo de grupo o latencia de filtro si aplica.
- Entrada en `reporte-verificacion.md` + mención en matriz RF-21.
### No incluye
- Cambiar sample rate de Whisper.
- Librerías nativas fuera del browser.
- Deploy cloud.

## 7. Mapa de código
- `app/src/audio/audio-resampler.ts`
- `app/src/audio/mix-to-mono.ts`
- Pipeline post-captura en `ui` / utterance pipeline
- `Documentacion general/documento-tecnico.md` § muestreo

## 8. Investigación
1. Leer resampler actual y puntos de llamada.
2. Definir fs_in típica (48 k) → 16 k (factor 3) o ruta genérica.
3. Diseñar FIR (orden, cutoff ~0.45*fs_out).
4. Tests con senoides conocidas + FFT de verificación.
5. Integrar en cadena real sin romper ASR.

## 9. Enfoques
1. **Recomendado:** decimación entera factor 3 (48→16) + FIR anti-alias; fallback resample genérico si fs no es 48k.
2. Resample genérico con low-pass previo siempre.
Prohibido: forzar sampleRate en getUserMedia de forma frágil (ver CAPTURE-INVARIANTS).

## 10. Docs
- Enunciado preprocesamiento.
- `audio/README.md`, `CAPTURE-INVARIANTS.md`
- `REGLAS-DE-CODIGO.md`, `GUIA-CREACION-ISSUES.md`

## 11. Plan
1. FIR puro + tests dB.
2. Cablear en resample path.
3. Tabla de métricas en reporte.
4. PR `feat(audio): add antialias filter before resample`

## 12. Criterios de aceptación
- [ ] Anti-alias explícito en código de preproceso/resample
- [ ] Test con métrica de atenuación de alias (número reproducible)
- [ ] ASR/smoke de un turno no regresa
- [ ] RF-21 / reporte actualizados
- [ ] lint + test + build

## 13. Pruebas
Unitarias sintéticas; manual una frase en Chrome.

## 14. DoD
PR mergeado; comentario con dB medidos.

**Labels:** `entrega-final`, `type:story`, `layer:audio`, `layer:dsp`, `person:luna`, `enhancement`
