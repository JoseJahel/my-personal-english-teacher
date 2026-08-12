# Backlog de issues — rúbrica + producto propio

**Guía:** [GUIA-CREACION-ISSUES.md](./GUIA-CREACION-ISSUES.md)  
**Repo:** https://github.com/JoseJahel/my-personal-english-teacher  

**Issue meta (backlog vivo en GitHub, con checkboxes y orden ideal):**  
➡️ **[#80 — Backlog del equipo: orden ideal de resolución de issues](https://github.com/JoseJahel/my-personal-english-teacher/issues/80)**

Este archivo es la copia versionable en Git. El orden canónico de ejecución del lote actual está en **#80**; al reordenar, actualizar **ambos**.

---

## Orden ideal de resolución (resumen)

Igual que en #80. Detalle y dependencias: ver el body de ese issue.

### Oleada 1 — Avance 2
`#59` → `#60` → `#70` → `#68` → `#69` → `#78` → `#75` → `#57` → `#64`

### Oleada 2 — Laboratorio de señales
`#65` → `#73` → `#66` → `#67` → `#58` → `#76` → `#74` → `#71` (plantilla en paralelo; cifras al final)

### Oleada 3 — Remate Final
`#61` → `#77` → `#79` → `#62` → `#63` → `#72`

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

| # | Issue | Notas de identidad propia |
|---|--------|---------------------------|
| 57 | Sync matriz/README | Honestidad del repo |
| 58 | Energía + formantes en score | Cierra RF-09 con *nuestro* `pronunciation-score` |
| 59 | Espectro + pitch en captura | Enunciado “tiempo real”; Analyser que ya usamos |
| 60 | Sugerencias de comunicación | Core enunciado; aparte del tutor SmolLM2 |
| 61 | Perfil latencia ASR | Nace del bank y `small-en` WebGPU |
| 62 | PDF documento técnico | Artefacto de entrega del curso |
| 63 | Filtrado ruido | RF-23 / innovación |
| 64 | Presentación A2 | Deck + capturas de *esta* app |

---

## Lote B — Señales y producto (#65–#74) — varios **reescritos** para sonar a nosotros

| # | Issue (título actual) | Identidad |
|---|----------------------|-----------|
| 65 | Medir/endurecer anti-alias del **resample a 16 kHz** | Extensión de decisión Avance 1 de captura nativa |
| 66 | FFT/STFT vs DFT con error acotado | Base de nuestro espectrograma |
| 67 | **Vectores dorados** MFCC anti-regresión | Ancla de *nuestro* extractor (no “checklist genérica”) |
| 68 | **Drill: repetir la última línea del tutor** | Híbrido conversación+score; no banco suelto de frases |
| 69 | Diff visual de gramática | Feedback con colores del enunciado |
| 70 | **Ensayo de UI** sin mic ni descarga | Localhost / flag propio; no segundo producto |
| 71 | Bitácora + evidencias | Decisión→métrica→test de *este* repo |
| 72 | Hábitos desde historial IndexedDB | Sobre `PracticeTurnRecord` existente |
| 73 | Pasa-banda + misma cadena user/ref TTS | Evita sesgo de ruta en *nuestro* score |
| 74 | Métricas de borde VAD (ms) | Auto-stop que ya cableamos |

---

## Lote C — Diferenciadores propios (#75–#79)

Nacen de código/UX que **ya** es nuestro (gate ASR, formantes, TTS, UI ES, snapshots):

| # | Issue | Por qué es “nuestro” |
|---|--------|----------------------|
| 75 | No castigar pronunciación si ASR no trajo habla útil | Pedagogía + `transcription-text` / gate |
| 76 | Mapa **F1–F2** de la utterance | Formantes que ya estimamos |
| 77 | Normalizar números/siglas **antes del TTS** | Escenarios restaurante/aeropuerto + SpeechT5 |
| 78 | Explicación **en español** de la corrección T5 | Decisión de producto “UI en español” |
| 79 | Tarjeta de señales del turno en el chat | `practice-turn-signal-snapshot` ya existe |

---

## Orden de implementación (máximo valor de producto)

### Oleada A2 (ventana de avance)

1. **#59** live espectro/pitch  
2. **#60** sugerencias  
3. **#70** ensayo UI  
4. **#68** drill “repite al tutor”  
5. **#69** + **#78** gramática visible + explicación ES  
6. **#75** honestidad del score  
7. **#57** + **#64** docs/presentación  

### Oleada laboratorio (nota de señales)

8. **#65** anti-alias medido  
9. **#73** pasa-banda misma cadena  
10. **#66** / **#67** FFT + MFCC dorados  
11. **#58** formantes/energía en score  
12. **#76** mapa F1–F2  
13. **#74** VAD ms  
14. **#71** bitácora con los números que vayan saliendo  

### Oleada remate

15. **#61** latencia  
16. **#77** TTS números  
17. **#79** tarjeta de turno  
18. **#62** PDF  
19. **#63** / **#72** ruido y hábitos  

---

## Qué *no* hace falta clonar

No abrir tickets solo por tener paridad cosmética con otros trabajos del curso (deploy público, estructura de carpetas ajena, mismos nombres de flags, mismos textos de issues). Si no mejora **nuestra** demo, **nuestro** score o **nuestro** documento, no entra al backlog.
