## 0. Metadatos
- **Hito:** Entrega Final (también desbloquea honestidad del Avance 2)
- **Capa principal:** repo/docs
- **Capas secundarias:** N/A
- **Requisito matriz / enunciado:** § Matriz de trazabilidad + § Verificación del documento técnico; criterios Documento (30 %)
- **Tipo:** docs
- **Asignado (reparto equitativo):** Saúl (@SaulitoRamirezz) — menor carga de commits de código; ya es dueño natural de docs #32–#34
- **Rama de trabajo:** `saul-frontend`
- **Prioridad rúbrica:** P0 (trazabilidad desactualizada = documento no veraz)

## 1. Contexto del producto (para IA y humanos)
My Personal English Teacher es una PWA offline de práctica de inglés con IA client-side y DSP de voz. El enunciado exige una **matriz de trazabilidad** y un **reporte de verificación** alineados con el código real. Evaluar con un documento que diga “pendiente” lo ya mergeado, o “planificado” lo ya cableado, debilita el 30 % de Documento y la defensa oral.

## 2. Problema u oportunidad
- **Hoy:** `Documentacion general/matriz-trazabilidad.md` marca p. ej. RE-02 (tendencia de scores) como Pendiente pese a commits de chart de tendencia; RE-04/L-3 del reporte hablan de calibración pendiente tras merge de #29; `README.md` raíz aún describe bloques DSP/score como “planificados” o “aún no cableados” en secciones viejas.
- **Exige el enunciado:** matriz con estados reales (Implementado/Parcial/Pendiente) y verificación honesta.
- **No cumple estricto:** la documentación de entrega no refleja `main` post #29/#46/#47–#56.

## 3. Objetivo
Cuando este issue esté cerrado, matriz, reporte de verificación y secciones de Estado del README raíz/`app/README.md` describirán el código de `main` sin contradicciones materiales.

## 4. Por qué importa
- Documento = 30 % de la rúbrica.
- Evita que el profesor detecte “documento maquillado” o “documento atrasado” en la demo.
- Base correcta para el PDF de entrega y la presentación.

## 5. Para qué
Evaluadores y el propio equipo usan estos docs como fuente de verdad del cumplimiento del enunciado.

## 6. Alcance
### Incluye
- Actualizar filas de `matriz-trazabilidad.md` (RE-02, RE-04, RF-14 si aplica, RNF-06, conteos resumen).
- Actualizar `reporte-verificacion.md` (L-3 calibración, conteo de tests si cambió, referencias a issues mergeados).
- Corregir secciones contradictorias del `README.md` raíz (Estado / Planificado / Registrado-previsto).
- Ajustes menores en `app/README.md` si divergen del estado real.
- Tabla resumen de cobertura coherente con los nuevos estados.

### No incluye
- Implementar features nuevas de código.
- Exportar PDF (issue hermano de export).
- Reescribir el marco teórico completo.

## 7. Estado actual en el código (mapa para investigar)
- `Documentacion general/matriz-trazabilidad.md`
- `Documentacion general/reporte-verificacion.md`
- `Documentacion general/calibracion-score-pronunciacion.md` (calibración #29 hecha)
- `README.md` (secciones Características / Estado)
- `app/README.md`
- Evidencia de tendencia UI: commits `feat(ui): show pronunciation trend chart…`
- Score calibrado: `app/src/dsp/pronunciation-score-calibration-constants.ts`

## 8. Dónde investigar la causa / el diseño actual
1. Leer `matriz-trazabilidad.md` completa y listar filas Parcial/Pendiente.
2. Para cada una, `grep` / abrir el módulo citado y comprobar si está cableado en UI.
3. Contar `app/src/**/*.test.ts` y alinear el reporte si el número cambió.
4. Diff mental README “Planificado” vs carpetas `dsp/`, `storage/`, `ui/`.
5. Contrastar con enunciado en `Documentacion general/01 Proyecto My Personal English Teacher.docx`.

## 9. Enfoques de solución aceptables
1. **Recomendado:** actualización puntual fila por fila + párrafo de “última verificación” con fecha y commit/PR de referencia.
2. Reescritura total de la matriz — innecesario si la estructura ya es correcta.
Prohibido: marcar Implementado sin evidencia en código; borrar limitaciones reales (p. ej. latencia ASR > 2 s).

## 10. Documentación y referencias obligatorias
- Enunciado § estructura documento (matriz + verificación).
- `Documentacion general/GUIA-CREACION-ISSUES.md`
- `CONTRIBUTING.md`
- Issues cerrados #27, #29, #32–#34, #46–#56 como evidencia histórica.

## 11. Plan de implementación sugerido
1. Inventario de inconsistencias (lista en el PR).
2. Editar matriz (estados + módulos + pruebas).
3. Editar reporte (limitaciones y métricas).
4. Editar README raíz Estado/Planificado.
5. PR `docs(repo): sync matrix and status with main`.

## 12. Criterios de aceptación
- [ ] Ninguna fila de la matriz contradice el código de `main` en requisitos ya mergeados
- [ ] L-3 u otras limitaciones del reporte no niegan #29 si la calibración offline está en código
- [ ] README raíz no lista como “solo planificado” YIN/MFCC/DTW/formantes/score si ya existen
- [ ] Resumen de cobertura (conteos Implementado/Parcial/…) recalculado
- [ ] PR mergeable; sin cambios de lógica de app

## 13. Pruebas
- Revisión manual por otra persona del equipo (diff de docs).
- No requiere `pnpm test` salvo que se toque código (no debería).

## 14. Definición de hecho (DoD)
- PR mergeado a `main`.
- Comentario en el issue con lista “antes → después” de estados clave.
- Issue cerrado.

**Labels sugeridos:** `entrega-final`, `type:docs`, `layer:repo`, `person:saul`, `documentation`
