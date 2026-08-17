# Backlog de issues — rúbrica + producto propio

**Guía:** [GUIA-CREACION-ISSUES.md](./GUIA-CREACION-ISSUES.md)  
**Repo:** https://github.com/JoseJahel/my-personal-english-teacher  

**Issue meta (backlog vivo en GitHub, con checkboxes y orden ideal):**  
➡️ **[#80 — Backlog del equipo: orden ideal de resolución de issues](https://github.com/JoseJahel/my-personal-english-teacher/issues/80)**

Este archivo es la copia versionable en Git. El orden canónico de ejecución del lote actual está en **#80**; al reordenar, actualizar **ambos**.

**Estado 2026-08-13:** el orden ideal **no cambia**. Se marcan hechos los issues ya cerrados en GitHub. **#80 permanece abierto** hasta consumir el lote (definición de hecho del meta-issue).

---

## Orden ideal de resolución (resumen)

Igual que en #80. Detalle y dependencias: ver el body de ese issue.  
`hecho` = issue cerrado en GitHub. El resto sigue abierto.

### Oleada 1 — Avance 2
~~`#59` hecho~~ → ~~`#60` hecho~~ → ~~`#70` hecho~~ → ~~`#68` hecho~~ → ~~`#69` hecho~~ → ~~`#78` hecho~~ → ~~`#75` hecho~~ → ~~`#57` hecho~~ → `#64`  
Añadido después (comentario en #80, no altera el orden DSP/docs): ~~`#81` hecho~~

### Oleada 2 — Laboratorio de señales
`#65` → `#73` → ~~`#66` hecho~~ → ~~`#67` hecho~~ → `#58` → `#76` → `#74` → `#71` (plantilla en paralelo; cifras al final)

### Oleada 3 — Remate Final
~~`#61` hecho~~ → `#77` → `#79` → `#62` → `#63` → `#72`

### Oleada 4 — Laboratorio y defensa (Jahel, #92–#98)
No pisa la oleada A2. `#97` y `#96` pueden entrar en paralelo a A2.
`#97` → `#96` → `#93` (tras o con `#59`) → `#92` (coordina `#65`) → `#95` → `#94` → `#98` (enchufa `#70`)

### Siguiente desbloqueado (sin saltar la oleada)

| Oleada | Siguiente | Luego |
|--------|-----------|--------|
| 1 — Avance 2 | `#64` | — |
| 2 — Laboratorio | `#65` | `#73` → `#58` → `#76` → `#74` → `#71` |
| 3 — Remate | `#77` | `#79` → `#62` → `#63` → `#72` |
| 4 — Laboratorio y defensa | `#97` / `#96` | `#93` → `#92` → `#95` → `#94` → `#98` |

---

## Principio de diseño del backlog

Cada ticket debe leerse como decisión de **este** producto (PWA localhost, capas `app/src`, tutor híbrido, score vs TTS, UI en español).  

- Se prioriza el enunciado del curso y nuestras debilidades reales de código/docs.  
- **No** se abre un ticket “porque otro stack lo tiene”.  
- Títulos y cuerpos hablan de **nuestros** archivos, escenarios y trade-offs (WER vs latencia, badge de fallback, invariantes de captura).  
- Si dos proyectos del curso resuelven lo mismo (p. ej. anti-alias), la redacción ancla en *nuestro* resample a 16 kHz y *nuestros* tests, no en plantillas ajenas.

---

## Cómo implementar sin parecer genérico

| Tipo de mejora | Enfoque nuestro |
|----------------|-----------------|
| Señales medibles | Números en **nuestro** `reporte-verificacion.md` + tests Vitest del módulo tocado |
| Visualizaciones | Partir de canvas/sesión ya existentes; live solo donde el enunciado lo pide |
| Pedagogía | UI en español (`interface-texts.ts`); inglés solo como práctica |
| Demo | Localhost + ensayo de UI; **sin** hosting de producto |
| Score | Conversación + drill “repite al tutor”; honestidad si ASR falla |

---

## Lote A — Cierre de rúbrica (#57–#64)

| # | Issue | Estado | Notas de identidad propia |
|---|--------|--------|---------------------------|
| 57 | Sync matriz/README | Abierto | Honestidad del repo |
| 58 | Energía + formantes en score | Abierto | Cierra RF-09 con *nuestro* `pronunciation-score` |
| 59 | Espectro + pitch en captura | Hecho | Tap live en pista clonada; no el FFT del Analyser |
| 60 | Sugerencias de comunicación | Hecho (PR #84) | Core enunciado; aparte del tutor SmolLM2 |
| 61 | Perfil latencia ASR | Hecho (PR #89) | Nace del bank y `small-en` WebGPU |
| 62 | PDF documento técnico | Abierto | Artefacto de entrega del curso |
| 63 | Filtrado ruido | Abierto | RF-23 / innovación |
| 64 | Presentación A2 | Abierto | Deck + capturas de *esta* app |

---

## Lote B — Señales y producto (#65–#74) — varios **reescritos** para sonar a nosotros

| # | Issue (título actual) | Estado | Identidad |
|---|----------------------|--------|-----------|
| 65 | Medir/endurecer anti-alias del **resample a 16 kHz** | Abierto | Extensión de decisión Avance 1 de captura nativa |
| 66 | FFT/STFT vs DFT con error acotado | Hecho (PR #87) | Base de nuestro espectrograma |
| 67 | **Vectores dorados** MFCC anti-regresión | Hecho (PR #88) | Ancla de *nuestro* extractor (no “checklist genérica”) |
| 68 | **Drill: repetir la última línea del tutor** | Hecho (PR #84, #85) | Híbrido conversación+score; no banco suelto de frases |
| 69 | Diff visual de gramática | Abierto | Feedback con colores del enunciado |
| 70 | **Ensayo de UI** sin mic ni descarga | Hecho | `#practice-mock` + `pnpm build:ensayo` |
| 71 | Bitácora + evidencias | Abierto | Decisión→métrica→test de *este* repo |
| 72 | Hábitos desde historial IndexedDB | Abierto | Sobre `PracticeTurnRecord` existente |
| 73 | Pasa-banda + misma cadena user/ref TTS | Abierto | Evita sesgo de ruta en *nuestro* score |
| 74 | Métricas de borde VAD (ms) | Abierto | Auto-stop que ya cableamos |

---

## Lote C — Diferenciadores propios (#75–#79) + #81 (añadido)

Nacen de código/UX que **ya** es nuestro (gate ASR, formantes, TTS, UI ES, snapshots):

| # | Issue | Estado | Por qué es “nuestro” |
|---|--------|--------|----------------------|
| 75 | No castigar pronunciación si ASR no trajo habla útil | Hecho (PR #86) | Pedagogía + `transcription-text` / gate |
| 76 | Mapa **F1–F2** de la utterance | Abierto | Formantes que ya estimamos |
| 77 | Normalizar números/siglas **antes del TTS** | Abierto | Escenarios restaurante/aeropuerto + SpeechT5 |
| 78 | Explicación **en español** de la corrección T5 | Abierto | Decisión de producto “UI en español” |
| 79 | Tarjeta de señales del turno en el chat | Abierto | `practice-turn-signal-snapshot` ya existe |
| 81 | Shell Atelier (añadido 2026-08-12) | Hecho (PR #82) | UI canónica; no sustituye el orden DSP/docs |

---

## Lote D — Laboratorio y defensa (Jahel, #92–#98)

Cierra huecos de muestreo, análisis en vivo, honestidad del score y demo de aula en **este** producto. Asignación a Jahel a petición; no redistribuye #57–#79.

| # | Issue | Estado | Relación con el lote ya abierto |
|---|--------|--------|---------------------------|
| 92 | Remuestreo FIR **44.1 y 48** + polifase | Abierto | #65 es el FIR mínimo; este cubre 44.1 racional y coste |
| 93 | STFT/YIN live sobre **PCM real** | Abierto | #59 pinta; este usa *nuestra* FFT/YIN, no el Analyser |
| 94 | Auditoría de **encadenado** MFCC | Abierto | #67 son dorados; este caza el bug de escala entre etapas |
| 95 | Sesgo de locutor vs error, política de score | Abierto | #29 calibra umbral; este mide Δ y decide conversación/drill |
| 96 | Chat ASR+T5 **sin** esperar tutor | Abierto | #61 es el perfil; este define el presupuesto 2 s como feedback |
| 97 | Kit de defensa **local** | Abierto | Riesgos + Q&A con *nuestras* cifras; sin host cloud |
| 98 | Contratos + mocks inyectables | Abierto | #70 deja de ser maniquí: mismo `HomeScreen` |

---

## Orden de implementación (máximo valor de producto)

### Oleada A2 (ventana de avance)

1. ~~**#59** live espectro/pitch~~ (hecho)  
2. ~~**#60** sugerencias~~ (hecho)  
3. ~~**#70** ensayo UI~~ (hecho)  
4. ~~**#68** drill “repite al tutor”~~ (hecho)  
5. ~~**#69** + **#78**~~ (hecho)  
6. ~~**#75** honestidad del score~~ (hecho)  
7. ~~**#57**~~ (hecho) + **#64** presentación  

### Oleada laboratorio (nota de señales)

8. **#65** anti-alias medido  
9. **#73** pasa-banda misma cadena  
10. ~~**#66** / **#67** FFT + MFCC dorados~~ (hecho)  
11. **#58** formantes/energía en score  
12. **#76** mapa F1–F2  
13. **#74** VAD ms  
14. **#71** bitácora con los números que vayan saliendo  

### Oleada remate

15. ~~**#61** latencia~~ (hecho)  
16. **#77** TTS números  
17. **#79** tarjeta de turno  
18. **#62** PDF  
19. **#63** / **#72** ruido y hábitos  

### Oleada laboratorio y defensa (en paralelo a A2 solo #97/#96)

20. **#97** kit defensa  
21. **#96** feedback progresivo  
22. **#93** PCM live (con #59)  
23. **#92** FIR multi-tasa  
24. **#95** sesgo locutor  
25. **#94** encadenado MFCC  
26. **#98** mocks (con #70)  

---

## Qué *no* hace falta clonar

No abrir tickets solo por tener paridad cosmética con otros trabajos del curso (deploy público, estructura de carpetas ajena, mismos nombres de flags, mismos textos de issues). Si no mejora **nuestra** demo, **nuestro** score o **nuestro** documento, no entra al backlog.
