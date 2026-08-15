## 0. Metadatos
- **Hito:** Entrega Final
- **Capa principal:** dsp
- **Capas secundarias:** repo/docs
- **Requisito matriz / enunciado:** RF-15; calidad técnica 40 %
- **Tipo:** story
- **Asignado (reparto equitativo):** Jahel (@JoseJahel) — lote de laboratorio y defensa A2/Final pedido por Jahel; no redistribuye #57–#79
- **Rama de trabajo:** `jahel-frontend`
- **Prioridad rúbrica:** P1

## 1. Contexto del producto (para IA y humanos)
`extractMfccSequence` es nuestro (Hann 25 ms, hop 10 ms, 13 coef, 40 mel, pre-énfasis 0.97). #67 ancló `mfcc-golden-vectors.json` a **recetas sintéticas propias**. Eso evita regresiones; no demuestra que el **encadenado** espectro → mel → log → DCT use la misma escala que la definición que citamos.

## 2. Problema u oportunidad
- Un fallo típico de laboratorio: aplicar al espectro de potencia la corrección de *amplitud de visualización*. Cada etapa pasa sus tests y el MFCC queda muerto (bandas en el piso de `log`).
- #67 no está diseñado para cazar ese bug de *acoplamiento*.
- No hay dependencia runtime de librosa (correcto). Falta un fixture que fije la **convención** (HTK vs Slaney, destino de c0) y un test de “ninguna banda en el piso ante un tono de amplitud 1”.

## 3. Objetivo
Cuando esté cerrado, un test falla si se vuelve a colar una corrección de escala entre FFT y banco mel, y el reporte declara convención + error vs fixture de definición (generado offline; **sin** Python en CI).

## 4. Por qué importa
- RF-15 y el 40 %: “MFCC propios” se defiende con la cadena, no solo con JSON dorado.
- El test de encadenado detecta un bug de escala que los vectores dorados de #67 no cubren.

## 5. Para qué
Score de pronunciación más creíble; párrafo corto en el documento técnico.

## 6. Alcance
### Incluye
- Test de encadenado: tono 1 kHz @ 16 kHz, amplitud 1 → **cero** bandas mel clavadas en el piso log; c1–c12 no ~0.
- Documento de convención: HTK (nuestras 40 bandas / Nyquist) vs alternativas; qué se hace con c0 (ya se compara en dorados).
- Fixture JSON **adicional** o extensión de `mfcc-golden-signals.ts` generado por la **definición de este repo** (script TS ya existente `write-mfcc-golden-vectors.ts`). Si se usa librosa, solo offline y versionado; CI no instala Python.
- Fila nueva en `reporte-verificacion.md` (además de #67).

### No incluye
- Meyda o librosa en runtime o en CI.
- Cambiar defaults de 13/40/25/10 sin decisión en el reporte.
- Reabrir #67 ni regenerar dorados “por gusto”.
- Recalibrar el score (#29 / #58).

## 7. Estado actual en el código (mapa para investigar)
- `app/src/dsp/mfcc-extraction.ts` — `extractMfccSequence`, `createMelFilterbank`
- `app/src/dsp/radix2-forward-fft.ts` (usado por MFCC y espectrograma)
- `app/src/dsp/spectrogram.ts` — posible origen de una corrección de amplitud si se reutiliza mal
- `app/src/dsp/mfcc-golden-vectors.json` + `mfcc-golden-vectors.test.ts` + `mfcc-golden-signals.ts`
- `app/src/dsp/write-mfcc-golden-vectors.ts`

## 8. Dónde investigar la causa / el diseño actual
1. Leer `extractMfccSequence` paso a paso (pre-énfasis → Hann → FFT potencia → mel → log → DCT).
2. Grep correcciones de ganancia coherente / `1/N²` entre espectro de UI y MFCC.
3. Correr `pnpm exec vitest run src/dsp/mfcc`
4. Añadir el caso “tono unidad / piso log”.

## 9. Enfoques de solución aceptables
1. **Recomendado:** test de invariante de cadena + párrafo de convención; fixture TS.
2. Aceptable: JSON generado una vez con librosa 0.11 **offline**, mismos parámetros, cota documentada.
3. Prohibido: `pip install` en GitHub Actions; versionar vectores sin receta reproducible en este repo.

## 10. Documentación y referencias
- Davis & Mermelstein (1980); HTK mel
- `dsp/README.md`, reporte §5.2, #67, #66
- `REGLAS-DE-CODIGO.md`

## 11. Plan de implementación sugerido (pasos)
- [ ] Invariante piso-log + tono 1 kHz
- [ ] Convención escrita (HTK, c0)
- [ ] Fila en reporte
- [ ] `cd app; pnpm test` (módulo dsp)

## 12. Criterios de aceptación
- [ ] Test que falle si se escala el espectro de potencia como el de visualización
- [ ] Convención HTK/c0 en reporte o `dsp/README.md`
- [ ] #67 sigue verde (no regenerar dorados salvo bug real)
- [ ] lint + test + build
- [ ] PR `jahel-frontend` → `main`

## 13. Pruebas
Unitarias deterministas. Sin mic.

## 14. Definición de hecho (DoD)
En `main`. Comentario con “invariante de encadenado + convención”.
