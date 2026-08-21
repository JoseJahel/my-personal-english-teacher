# Guía de creación de issues / tickets

**Proyecto:** My Personal English Teacher  
**Curso:** Señales y Sistemas  
**Audiencia:** todo el equipo (y cualquier modelo de IA que implemente o revise un ticket)

Este documento define **cómo** se crean los issues, **por qué** deben ser tan detallados y **para qué** sirve cada sección. No es un foro de debate de alcance: se asume que cada integrante **ya conoce** la naturaleza del producto (PWA offline, IA client-side, DSP de voz, demo en localhost). Quien abre un ticket debe **discernir** qué aporta al enunciado y a la rúbrica, y qué lo contradice.

Relacionado:

- Constraints de producto: [`CONTRIBUTING.md`](../CONTRIBUTING.md)
- Reglas de código y límites no negociables: [`REGLAS-DE-CODIGO.md`](./REGLAS-DE-CODIGO.md)
- Enunciado del curso: [`01 Proyecto My Personal English Teacher.docx`](./01%20Proyecto%20My%20Personal%20English%20Teacher.docx)
- Estado de requisitos: [`matriz-trazabilidad.md`](./matriz-trazabilidad.md)

---

## 1. Propósito de un issue en este proyecto

Un issue no es un recordatorio vago (“mejorar audio”). Es un **contrato de trabajo** que debe permitir a una persona **o a un modelo de IA**:

1. Entender **qué** hay que lograr y **por qué** importa para el curso / la demo.
2. Saber **dónde** está el código y la documentación relevantes.
3. Saber **cómo** investigar la causa (si es bug) o el diseño actual (si es feature).
4. Conocer **límites** (local-only, capas, tamaño de archivo, sin cloud).
5. Verificar el resultado con **criterios de aceptación medibles**.
6. Abrir un PR hacia `main` (rama personal `*-frontend` o rama temporal de agente) con `Closes #N`.

Si el ticket no basta para que alguien nuevo en el proyecto arranque sin preguntar “¿qué es el proyecto?”, el ticket **no está listo**.

---

## 2. Principios (no negociables)

### 2.1 El producto ya está definido

No se reabre en cada issue si “¿backend?”, “¿Vercel?” o “¿multi-idioma?”. Respuestas fijas:

| Tema | Decisión |
|------|----------|
| Runtime | Solo navegador, client-side |
| Demo | `localhost` (`pnpm dev` / `pnpm preview`) |
| Cloud de producto | Prohibido |
| IA | `transformers.js` / ONNX en Web Worker |
| Idioma de práctica | Inglés (`.en`) |
| UI visible | Español (`ui/interface-texts.ts`) |
| Capas | `ui` → orquestación → `dsp`/`ia` ← `audio`/`storage` |

Si un ticket viola esto, **no se crea** o se cierra como `invalid` / se reescribe.

### 2.2 Un issue = un concern

Idealmente **una capa principal** y un objetivo verificable. No mezclar “PDF del documento + score de formantes + PWA icons” en el mismo ticket.

### 2.3 Suficiente para IA, no un ensayo

Descriptivo y sustancial **sí**. Historia del equipo, opiniones y debate **no**. Cada sección debe ser accionable.

### 2.4 Igualdad de carga (asignación)

Los tickets nuevos se asignan **de quien menos ha aportado hacia quien más ha aportado** (commits + issues cerrados + PRs integrados, revisado al abrir el lote). Objetivo: que todo el equipo avance por igual hacia la rúbrica, no concentrar el cierre en una sola persona.

**Cómo medir “quién ha hecho menos” (orden de asignación):**

1. Contar commits en `main` / ramas integradas por persona (o shortlog del repo).
2. Contar issues **cerrados** con label `person:…` de esa persona.
3. En empate, priorizar a quien **no** tiene issues abiertos ahora.
4. Asignar el siguiente ticket del backlog a la persona con **menor carga acumulada**.
5. Documentar en el body del issue: `**Asignado (reparto equitativo):** Nombre — motivo breve (p. ej. “menor número de issues cerrados en el lote Final”)`.

Labels obligatorios de persona: `person:jahel` | `person:rebeca` | `person:luna` | `person:saul` | `person:cesar`.  
Además: **assignee de GitHub** al login del integrante.

| Integrante | Label | Rama | Login GitHub (referencia) |
|------------|-------|------|---------------------------|
| Jahel | `person:jahel` | `jahel-frontend` | `JoseJahel` |
| Rebeca | `person:rebeca` | `rebeca-frontend` | `alvarezrebeca753-sudo` |
| Luna | `person:luna` | `luna-frontend` | `luna0809-oss` |
| Saúl | `person:saul` | `saul-frontend` | `SaulitoRamirezz` |
| César | `person:cesar` | `cesar-frontend` | `cesarubau-droid` |

### 2.5 Hito y rúbrica visibles

Todo issue lleva al menos un label de entrega:

- `avance-1` | `avance-2` | `entrega-final`

Y, si aplica, el ID de la matriz (`RF-xx`, `RNF-xx`, `RE-xx`) en el cuerpo.

Criterios de evaluación del curso (recordatorio al redactar el “por qué”):

| Criterio | Peso |
|----------|------|
| Calidad técnica (señales, HF, offline real) | 40 % |
| Documento | 30 % |
| Presentación / demo | 20 % |
| Innovación y completitud | 10 % |

---

## 3. Cuándo crear un issue

**Sí crear** cuando:

- Falta un requisito del enunciado o de la matriz (Implementado / Parcial / Pendiente).
- Hay un bug reproducible que afecta demo o CI.
- Hay deuda técnica que bloquea cumplir límites de `REGLAS-DE-CODIGO.md` (p. ej. archivo > 400 líneas que hay que tocar igual).
- Hay un artefacto de entrega (PDF, presentación, capturas) incompleto.

**No crear** cuando:

- El trabajo es “explorar sin objetivo”.
- Implica hosting cloud, API remota de voz/LLM o backend de producto.
- Duplica un issue abierto o ya cerrado con el mismo alcance (buscar antes en GitHub).
- Es una preferencia cosmética sin impacto en rúbrica ni demo (salvo que el hito lo pida).

---

## 4. Título

Formato:

```text
[Hito] Verbo en imperativo + objeto concreto (capa si cabe)
```

Ejemplos válidos:

- `[A2] Añadir panel de sugerencias de comunicación post-turno`
- `[Final] Incluir formantes y energía en el score vs referencia`
- `[Final] Exportar documento técnico Markdown a PDF de entrega`

Reglas:

- Máx. ~70 caracteres si es posible; claro sin leer el body.
- Prefijos de hito: `[A1]`, `[A2]`, `[Final]`.
- Idioma del título: **español** (coherente con issues históricos del repo) o inglés; ser consistente dentro del lote.
- Sin vaguedad: no “mejorar UI”, no “fix stuff”.

---

## 5. Plantilla obligatoria del cuerpo

Copiar y rellenar **todas** las secciones. Si una no aplica, escribir `N/A` y una línea de por qué.

```markdown
## 0. Metadatos
- **Hito:** Avance 2 | Entrega Final
- **Capa principal:** ui | audio | dsp | ia | storage | repo/docs
- **Capas secundarias:** …
- **Requisito matriz / enunciado:** RF-xx / RNF-xx / RE-xx / § del docx
- **Tipo:** story | bug | docs | chore | tech-debt
- **Asignado (reparto equitativo):** Nombre (@login) — criterio de carga
- **Rama de trabajo:** `nombre-frontend`
- **Prioridad rúbrica:** P0 (bloquea cumplimiento estricto) | P1 | P2

## 1. Contexto del producto (para IA y humanos)
2–5 frases. Qué es la app, qué restricción importa aquí (offline, worker, DSP puro, etc.).
No reescribir el README entero: solo lo necesario para este ticket.

## 2. Problema u oportunidad
- Qué hay hoy (comportamiento o archivo real).
- Qué exige el enunciado / la rúbrica / la matriz de forma **literal**.
- Por qué el estado actual **no cumple de forma estricta**.

## 3. Objetivo
Una frase medible: “Cuando este issue esté cerrado, …”.

## 4. Por qué importa
- Impacto en rúbrica (calidad técnica / documento / demo / innovación).
- Impacto en demo oral o en trazabilidad.
- Qué pasa si no se hace (riesgo de evaluación).

## 5. Para qué (resultado de usuario o de entrega)
Quién se beneficia: estudiante en la app, evaluador del curso, o ambos.

## 6. Alcance
### Incluye
- Lista concreta de cambios esperados.

### No incluye (explícito)
- Para evitar scope creep. Ej.: “No cambia el modelo ASR default de producción”.

## 7. Estado actual en el código (mapa para investigar)
Rutas y símbolos reales. Ejemplo:
- `app/src/dsp/pronunciation-score.ts` — `scorePronunciationFromMonoPcm`
- `app/src/ui/update-utterance-signal-views.ts` — solo post-utterance
- Tests existentes: `…test.ts`
- Docs: `Documentacion general/matriz-trazabilidad.md` fila RF-xx

## 8. Dónde investigar la causa / el diseño actual
Pasos ordenados para un agente:
1. Leer X.
2. Buscar (grep) el símbolo Y.
3. Ejecutar Z (`pnpm test`, flujo manual).
4. Contrastar con el enunciado (cita o paráfrasis literal).

## 9. Enfoques de solución aceptables
1–3 opciones **válidas** con pros/contras breves.
Marcar la **recomendada**.
Prohibiciones: p. ej. “no usar Meyda en runtime”, “no subir audio a la nube”.

## 10. Documentación y referencias obligatorias
- Enunciado del curso (sección).
- `README.md` / `app/README.md` / README de capa.
- `REGLAS-DE-CODIGO.md` (límites de archivo, capas).
- Papers o MDN si aplica (YIN, STFT, Web Audio AnalyserNode, etc.).
- Issues relacionados (#n).

## 11. Plan de implementación sugerido (pasos)
Checklist técnico ordenado (dominio puro → tests → cableado UI → docs).

## 12. Criterios de aceptación
- [ ] … medible
- [ ] … test automatizado o verificación manual descrita
- [ ] … docs/matriz actualizados si el estado del requisito cambia
- [ ] `pnpm lint` + `pnpm test` + `pnpm build` en `app/`
- [ ] PR a `main` con conventional commit y `Closes #N` (rama personal o temporal de agente)

## 13. Pruebas
- Unitarias a añadir o extender.
- Manual: pasos en Chrome/Chromium en localhost.
- Qué capturar si es demo (screenshot/nota).

## 14. Definición de hecho (DoD)
- Código en `main` (PR mergeado) **o** artefacto de entrega en la ruta acordada.
- El PR a `main` lleva `Closes #N` (o `Fixes #N`). El merge cierra el issue.
- Comentario de evidencia en el issue (PR, ruta de PDF, etc.) es bienvenido; ya no es el mecanismo de cierre.
- Labels correctos.
- Sin regresiones de mic / pipeline (smoke: un turno de práctica).
```

---

## 6. Labels obligatorios

| Categoría | Labels |
|-----------|--------|
| Hito | `avance-1` / `avance-2` / `entrega-final` |
| Tipo | `type:story` / `type:bug` / `type:docs` / `type:chore` / `type:tech-debt` |
| Capa | `layer:ui` / `layer:audio` / `layer:dsp` / `layer:ia` / `layer:storage` / `layer:repo` |
| Persona | `person:…` (exactamente uno) |

Opcionales: `enhancement`, `documentation`, `good first issue` solo si realmente aplica.

---

## 7. Calidad mínima (checklist antes de publicar)

- [ ] Título con hito y verbo concreto  
- [ ] Plantilla completa (secciones 0–14)  
- [ ] Cita o referencia al enunciado / matriz (por qué es obligatorio o de innovación)  
- [ ] Rutas de código reales (no inventadas)  
- [ ] Criterios de aceptación verificables  
- [ ] Fuera de alcance explícito  
- [ ] Asignación por **reparto equitativo** documentada  
- [ ] Assignee de GitHub + label `person:…`  
- [ ] Compatible con producto local-only  
- [ ] Un solo concern dominante  

**Rechazo típico:** “Mejorar pronunciación” sin decir si es score, UI, calibración o formantes.

---

## 8. Issues listos para modelos de IA

Además de la plantilla, el body debe permitir este comportamiento del agente:

| El agente debe poder… | Gracias a la sección… |
|------------------------|------------------------|
| No violar offline/cloud | 1, 9, constraints |
| Localizar archivos en &lt; 2 min | 7 |
| Reproducir el gap | 2, 8 |
| Elegir un diseño sin inventar arquitectura nueva | 9 |
| Escribir tests en el estilo del repo | 13 + rutas de tests vecinos |
| Saber cuándo parar | 6 (no incluye), 12 |

Recomendaciones extra en el body cuando el ticket sea de IA/agente:

- Comando exacto: `cd app; pnpm test; pnpm lint; pnpm build`
- Navegador objetivo: Chromium
- “No ampliar el alcance a refactors no pedidos”
- “Si el archivo supera 400 líneas, partir antes de añadir más lógica” (`REGLAS-DE-CODIGO.md`)

---

## 9. Flujo después de crear el issue

1. Asignar persona (reparto equitativo) + labels.  
2. La persona trabaja **solo** en su rama `*-frontend`. Un agente usa esa rama si está libre; si está ocupada, abre rama temporal + worktree desde `origin/main` (ver `CONTRIBUTING.md` / `AGENTS.md`).  
3. Implementar → tests → actualizar matriz/README si cambia estado de requisito.  
4. PR a `main` con conventional commit, idealmente un módulo, y **`Closes #N`** (o `Fixes #N`) en el cuerpo.  
5. Si el trabajo no tiene ticket, el agente crea el issue **antes o al abrir** el PR (labels `person:` / hito / tipo / capa + assignee al autor del PR). Plantilla 0–14 si hay tiempo; en auto-ticket, al menos metadatos + enlace al PR.  
6. Otra persona revisa si es posible.  
7. Merge → GitHub cierra el issue por la keyword. No hace falta cerrarlo a mano.

Nunca commit directo a `main`. La plantilla 0–14 sigue siendo la de tickets de producto.

---

## 10. Anti-patrones al escribir issues

| Anti-patrón | Por qué falla | Qué hacer |
|-------------|---------------|-----------|
| Título vago | Nadie sabe el done | Objeto + verbo + hito |
| Sin rutas de código | La IA inventa archivos | Listar paths reales |
| Sin “no incluye” | Scope infinito | Acotar |
| Mezclar 4 features | PRs monstruo | Un issue por concern |
| Ignorar rúbrica | Trabajo cosmético | Enlazar RF/RNF/RE o § enunciado |
| Asignar siempre a quien más sabe | Desigualdad de carga | Least → most |
| Pedir deploy cloud | Viola producto | Cerrar / reescribir |
| “Usar cualquier librería DSP” | Rompe MFCC propios del curso | Fijar restricciones en §9 |

---

## 11. Ejemplo mínimo (recortado)

```markdown
## 0. Metadatos
- **Hito:** Entrega Final
- **Capa principal:** dsp
- **Requisito:** RF-09 / enunciado “pitch, energía, formantes vs referencia”
- **Asignado (reparto equitativo):** Luna (@luna0809-oss) — menor carga de issues de score abiertos
- **Rama:** luna-frontend
- **Prioridad:** P0

## 2. Problema
Hoy `scorePronunciationFromMonoPcm` usa MFCC + pitch. Formantes se muestran en UI pero
no entran al score. Energía solo gatea silencio pre-ASR. El enunciado pide comparación
de pitch, energía y formantes vs referencia.

## 7. Estado actual
- `app/src/dsp/pronunciation-score.ts`
- `app/src/dsp/formant-estimation.ts`
- `app/src/dsp/signal-energy.ts`

## 12. Criterios de aceptación
- [ ] Score o desglose incluye componentes de energía y formantes vs ref. TTS
- [ ] Tests deterministas con señales sintéticas
- [ ] Matriz RF-09 actualizada
- [ ] CI verde
```

(El ejemplo real en el repo debe llevar todas las secciones 0–14.)

---

## 12. Mantenimiento de esta guía

- Si un PR o una sesión con IA falla por un issue pobre, añadir una línea en **Lecciones** abajo.
- No duplicar `REGLAS-DE-CODIGO.md`: aquí solo proceso de tickets.
- Actualizar la tabla de logins si cambia un usuario de GitHub.

### Lecciones aprendidas (issues)

| Fecha | Lección |
|-------|---------|
| 2026-08-12 | Los issues deben ser contratos AI-ready: sin rutas, contexto de producto y criterios medibles, el agente improvisa fuera de capas o de local-only. |
| 2026-08-12 | Asignación least→most se documenta en el body para que el reparto equitativo sea auditable. |
| 2026-08-19 | El cierre del issue es automático por `Closes #N` / `Fixes #N` al mergear el PR. El comentario de evidencia sigue siendo bienvenido; ya no cierra el ticket. |

---

*Documento de proceso del equipo. Complementa `CONTRIBUTING.md`; no lo reemplaza.*
