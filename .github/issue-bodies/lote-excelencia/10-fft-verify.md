## 0. Metadatos
- **Hito:** Entrega Final
- **Capa principal:** dsp
- **Requisito:** RF-03 espectrograma / marco teórico DFT-STFT; calidad técnica
- **Tipo:** story
- **Asignado (reparto equitativo):** Jahel (@JoseJahel) — capacidad DSP; 1 solo issue abierto previo del lote rúbrica
- **Rama:** `jahel-frontend`
- **Prioridad:** P0 diferenciación (evidencia FFT)

## 1. Contexto
El espectrograma y MFCC dependen de FFT/STFT. El curso pide ecuaciones DFT y corrección del análisis espectral. Ya hay `spectrogram.ts`; falta **verificación cuantitativa** frente a la definición o a una referencia, con error reportado.

## 2. Problema
Implementación propia sin tabla “error relativo vs DFT directa / Parseval / tono conocido” debilita el 40 % técnico frente a proyectos que publican 1e-12 de error.

## 3. Objetivo
Suite de tests que demuestre corrección de FFT/STFT (error acotado) y una fila en el reporte de verificación con el número.

## 4–5. Por qué / para qué
Credibilidad académica del módulo de señales; base para confiar en espectrograma live (#59) y MFCC.

## 6. Alcance
### Incluye
- Tests: senoide de frecuencia conocida → pico en bin correcto; opcional error vs DFT O(N²) en N pequeño; Parseval o energía.
- Si la FFT está embebida en STFT/MFCC, extraer helper testeable o testear vía API pública.
- Documentar métrica en `reporte-verificacion.md`.
### No incluye
- Reescribir todo MFCC.
- Dependencia nativa.

## 7. Mapa
- `app/src/dsp/spectrogram.ts`
- `app/src/dsp/mfcc-extraction.ts`
- tests existentes `spectrogram.test.ts`

## 8. Investigación
1. Localizar dónde se calcula FFT.
2. Definir N y casos analíticos.
3. Criterio de error (p. ej. max abs < 1e-10 en float64-equivalent).

## 9. Enfoques
1. **Recomendado:** tests de caja negra sobre STFT + un módulo `dft-reference` solo en tests.
2. Extraer `fftRadix2` público en `dsp/`.

## 10–14.
Docs: marco teórico DFT, REGLAS, guía issues.  
Criterios: tests verdes; métrica en reporte; sin regresión espectrograma.  
DoD: PR mergeado.

**Labels:** `entrega-final`, `type:story`, `layer:dsp`, `person:jahel`, `enhancement`
