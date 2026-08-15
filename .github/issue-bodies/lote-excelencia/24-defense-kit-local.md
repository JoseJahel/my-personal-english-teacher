## 0. Metadatos
- **Hito:** Avance 2 / Entrega Final
- **Capa principal:** repo/docs
- **Capas secundarias:** —
- **Requisito matriz / enunciado:** RF-18, RF-19, RF-22; presentación 20 % + documento 30 %
- **Tipo:** docs
- **Asignado (reparto equitativo):** Jahel (@JoseJahel) — lote de laboratorio y defensa A2/Final pedido por Jahel; no redistribuye #57–#79
- **Rama de trabajo:** `jahel-frontend`
- **Prioridad rúbrica:** P0 para la ventana A2 (17–22 ago)

## 1. Contexto del producto (para IA y humanos)
La demo es **localhost** (`pnpm preview`). No hay GitHub Pages ni host del producto (REGLAS §1.1, #35). Ya existen documento técnico, matriz, reporte, #64 (deck César) y #71 (bitácora Saúl). Falta el **kit oral** con *nuestras* cifras y un plan B si WebGPU o la descarga fallan.

## 2. Problema u oportunidad
- Un evaluador puede preguntar Nyquist, YIN, DTW, WER 0.000, 3.4 s, half-score 16.5, barge-in, perfil latencia.
- Esas respuestas están dispersas. No hay matriz de riesgos propia ni un “si el mic/WebGPU falla, hacemos X” escrito.
- Un deploy público **viola** el producto (demo solo localhost).

## 3. Objetivo
Cuando esté cerrado, `Documentacion general/` tiene: matriz de riesgos, preguntas-respuesta de defensa DSP/IA con cifras de *este* repo, y un plan B 100 % local (preview + `#shell-preview` / #70 + `dev:latency`).

## 4. Por qué importa
- 20 % + 30 %: la defensa se gana con números listos, no con improvisar.
- El kit queda anclado a nuestros archivos y a localhost.

## 5. Para qué
El equipo el día A2; Jahel como director técnico del lote.

## 6. Alcance
### Incluye
- `Documentacion general/matriz-riesgos.md` (probabilidad, impacto, mitigación, dueño). Riesgos reales: WebGPU ausente, 1 GB de modelos, score vs locutor (#22 de este lote), mic sordo (lecciones 22/23 jul), SmolLM2 timeout, #65/#73 pendientes.
- `Documentacion general/preguntas-defensa.md`: 12–20 preguntas (DFT, YIN, MFCC, DTW, WER, 2 s, offline, por qué no Pages, por qué `.en`, por qué T5 Xenova, barge-in). Cada respuesta cita archivo o cifra del reporte.
- Plan B: `pnpm build && pnpm preview`, `#shell-preview`, `pnpm dev:latency`, checklist de `app/README.md`. **Sin** URL pública.
- Enlace desde `documento-tecnico.md` § anexos y desde #64 (no reescribir el deck).

### No incluye
- Vercel / Pages / Netlify / demo hospedada.
- Sustituir #64 (pptx) ni #71 (bitácora de evidencias por tarea).
- Inventar métricas que el reporte no tiene.
- Código de producto salvo un enlace en README raíz (opcional, 5 líneas).

## 7. Estado actual en el código (mapa para investigar)
- `Documentacion general/documento-tecnico.md`, `reporte-verificacion.md`, `matriz-trazabilidad.md`
- `Documentacion general/REGLAS-DE-CODIGO.md` §1.1
- `app/README.md` (checklist offline, perfil latencia)
- #35, #37, #61, #64, #70, #71

## 8. Dónde investigar la causa / el diseño actual
1. Extraer cifras del reporte (WER, 3.4 s, FFT 1e-10, half-score, timeout 10 s).
2. Listar fallos reales de lecciones aprendidas.
3. Redactar Q&A con ruta de archivo por respuesta.

## 9. Enfoques de solución aceptables
1. **Recomendado:** dos markdown versionados + enlace en el técnico.
2. Prohibido: host cloud; preguntas que no citen un módulo o una cifra de este repo.

## 10. Documentación y referencias
- Enunciado: documento + presentación + demo
- CONTRIBUTING constraints
- #35, #64, #70, #71

## 11. Plan de implementación sugerido (pasos)
- [ ] Matriz de riesgos
- [ ] Q&A
- [ ] Plan B en README o en el mismo Q&A
- [ ] Enlace en documento técnico
- [ ] PR docs

## 12. Criterios de aceptación
- [ ] Los tres artefactos existen y no proponen cloud
- [ ] Cada respuesta de defensa cita cifra o path de este repo
- [ ] #64/#71 no se duplican (se enlazan)
- [ ] PR `jahel-frontend` → `main`

## 13. Pruebas
Revisión humana: 15 min en voz alta con el Q&A. Sin tests de código.

## 14. Definición de hecho (DoD)
Markdown en `main`. Comentario con rutas. Ensayo cronometrado opcional (dueño #64).
