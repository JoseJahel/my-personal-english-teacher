## 0. Metadatos
- **Hito:** Entrega Final
- **Capa principal:** ia
- **Capas secundarias:** ui, docs
- **Requisito matriz / enunciado:** RNF-06 — latencia de respuesta **&lt; 2 s donde aplique**; § verificación del documento técnico
- **Tipo:** story
- **Asignado (reparto equitativo):** Jahel (@JoseJahel) — mayor carga histórica; este ticket es de política de modelos/device que ya domina el registry
- **Rama de trabajo:** `jahel-frontend`
- **Prioridad rúbrica:** P1 (no bloquea “hay app”, sí bloquea cumplimiento estricto de métrica del enunciado)

## 1. Contexto del producto (para IA y humanos)
El default de producción es `whisper-small.en` por WER (bench 2026-07-29): ~3.4 s/frase en WebGPU y ~11 s en WASM. Eso **no cumple** el criterio &lt; 2 s del enunciado para ASR. Existen candidatos `tiny-en` / `base-en` y override `VITE_ASR_MODEL`, más el banco `#asr-benchmark`.

## 2. Problema u oportunidad
- Cumplir WER y cumplir &lt; 2 s con el mismo modelo es tenso en browser.
- Hoy la limitación está documentada (L-1) pero **no hay un “perfil demo”** de producto que demuestre latencia &lt; 2 s de forma first-class (UI o preset documentado + medible).

## 3. Objetivo
Ofrecer un **perfil de latencia / demo** reproducible que permita: (a) medir y, en hardware de referencia, acercar ASR a &lt; 2 s con candidato rápido; (b) documentar con honestidad cuándo se prioriza precisión (`small-en`) vs latencia; (c) actualizar matriz RNF-06 de forma defendible.

## 4. Por qué importa
- El enunciado lista latencia &lt; 2 s en verificación.
- En defensa oral: “podemos mostrar ambos modos” es mejor que “no cumplimos y ya”.
- Calidad técnica con trade-off explícito.

## 5. Para qué
Demo de curso y reporte de verificación con métricas creíbles; evaluador ve control del trade-off precisión/latencia.

## 6. Alcance
### Incluye
- Preset documentado y/o control de desarrollo (no cloud): p. ej. `VITE_ASR_MODEL=tiny-en` + sección en `app/README.md` “Perfil latencia vs precisión”.
- Opcional UI dev-only o nota en home solo en DEV: “perfil precisión / perfil latencia”.
- Re-medición en `#asr-benchmark` o procedimiento escrito; actualizar tabla del `reporte-verificacion.md`.
- Política de device ya existente: no romper WebGPU para small-en.
- Matriz RNF-06: Parcial con justificación **o** Implementado si el perfil latencia queda como camino soportado y medido &lt; 2 s.

### No incluye
- Bajar la calidad del default de producción sin decisión documentada del equipo.
- Servidor de inferencia.
- Garantizar &lt; 2 s en PCs sin WebGPU con `small-en` (imposible hoy; no mentir).

## 7. Estado actual en el código (mapa para investigar)
- `app/src/ia/model-registry.ts` — candidatos y `DEFAULT_ASR_CANDIDATE_ID`
- `app/src/ia/resolve-inference-device.ts`
- `app/src/ui/AsrBenchmarkScreen.tsx` / `use-asr-benchmark.ts`
- `Documentacion general/reporte-verificacion.md` §4–5, L-1
- `README.md` decisión whisper-small.en

## 8. Dónde investigar la causa / el diseño actual
1. Leer registry y cómo se elige el modelo.
2. Correr o documentar cómo correr `#asr-benchmark`.
3. Medir tiny/base en la máquina de demo si es posible.
4. Actualizar docs con números reales (no inventar).

## 9. Enfoques de solución aceptables
1. **Recomendado:** default producción = small-en (precisión); **perfil demo latencia** = tiny o base vía env + checklist; reporte con dos columnas.
2. Cambiar default a base-en si el bench del equipo lo justifica — solo con datos y acuerdo en el PR.
3. UI toggle en producción — posible pero más scope; si se hace, textos ES y sin red.

## 10. Documentación y referencias obligatorias
- Enunciado § verificación latencia.
- `model-registry.ts` comentarios de decisión 2026-07-29.
- `reporte-verificacion.md`
- `GUIA-CREACION-ISSUES.md`

## 11. Plan de implementación sugerido
1. Definir nombres de perfil y variables.
2. Cablear override si falta UX dev.
3. Medir y pegar resultados en reporte.
4. Actualizar RNF-06 y README.
5. PR.

## 12. Criterios de aceptación
- [ ] Existe forma documentada de lanzar perfil latencia (comando o env)
- [ ] Reporte incluye números de latencia del perfil rápido (o “pendiente re-medir en hardware de aula” con procedimiento)
- [ ] Default de precisión y sus límites siguen documentados con honestidad
- [ ] RNF-06 actualizado
- [ ] Tests de registry/device siguen verdes
- [ ] lint + test + build OK

## 13. Pruebas
- `pnpm test` en `model-registry` / device.
- Manual: perfil latencia carga tiny/base; una frase; anotar tiempo aproximado.
- No regresión: sin env, sigue small-en.

## 14. Definición de hecho (DoD)
- PR `jahel-frontend` → `main` mergeado.
- Enlace a sección del reporte actualizada.
- Issue cerrado.

**Labels sugeridos:** `entrega-final`, `type:story`, `layer:ia`, `layer:repo`, `person:jahel`
