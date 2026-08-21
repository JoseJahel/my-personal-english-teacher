# Guía de contribución

Este documento define las reglas de trabajo colaborativo para el repositorio
**my-personal-english-teacher**, proyecto del curso Señales y Sistemas.

**Código:** las prácticas, anti-patrones y límites de implementación viven en
[`Documentacion general/REGLAS-DE-CODIGO.md`](./Documentacion%20general/REGLAS-DE-CODIGO.md).
Léelas antes de implementar o revisar un PR. Este archivo solo cubre Git, ramas y commits.

## Equipo y ramas

Cada integrante tiene una rama personal larga, sin tildes en el nombre:

| Integrante | Rama             |
|------------|------------------|
| Jahel      | `jahel-frontend` |
| Rebeca     | `rebeca-frontend`|
| Luna       | `luna-frontend`  |
| Saúl       | `saul-frontend`  |
| César      | `cesar-frontend` |

Cada persona trabaja únicamente en sus propias ramas. No se realizan cambios
en las ramas de otro integrante sin coordinarlo primero.

Cada integrante integra a `main` su trabajo de interfaz (`ui/`) y del motor
no visual (`audio/`, `dsp/`, `ia/`, `storage/`), desde esa rama personal o
desde una rama temporal de agente si la personal está ocupada (ver abajo).
El sufijo «-frontend» es histórico y no limita el alcance.

## Ramas temporales de agente

Los humanos siguen usando **una** rama personal `*-frontend` (tabla de arriba).
Los agentes **no** ocupan esa rama si ya está en uso (otro worktree, working
tree sucio, o sesión activa). En ese caso abren una **rama temporal** en un
**worktree nuevo** creado desde `origin/main`. Contrato corto: [`AGENTS.md`](./AGENTS.md).

Al arrancar cualquier sesión:

1. `git fetch origin`
2. `git rev-parse --abbrev-ref HEAD` y `git rev-parse HEAD` (no parsear `.git/HEAD`)
3. Tomar `origin/main` como base, no el `main` local (puede ir decenas de commits atrás)
4. Actualizar la rama de esta sesión o crear una nueva desde `origin/main`
5. No hacer checkout de `main` si eso pisa el working tree de otro

Si el working tree tiene cambios ajenos: **fuera de ámbito**. No reformatear,
no revertir, no `git add -A`. Abrir worktree limpio.

Tras merge de un PR desde rama temporal de agente: borrar **esa** rama
(local + remota), quitar el worktree propio y `git fetch --prune`. Nunca
borrar `jahel-frontend`, `rebeca-frontend`, `luna-frontend`, `saul-frontend`
ni `cesar-frontend`.

## Constraints del producto (obligatorio al crear issues)

Antes de abrir o aceptar un issue/PR, comprobar que encaja con el producto real
del curso y del README:

1. **App local y offline-first.** La demo se entrega en **localhost**
   (`pnpm dev` / `pnpm preview` en `app/`). Toda la IA corre **client-side**
   en el navegador (transformers.js / ONNX). No hay backend de aplicación.
2. **Sin servicios en la nube para el producto.** No se planifican ni se
   implementan deploys en Vercel, Netlify, Firebase, ni ningún host remoto
   de la PWA. Tampoco APIs remotas de voz o LLM. GitHub (repo + Actions CI)
   es solo colaboración y calidad de código, no el runtime de la demo.
3. **Issues alineados con capas y enunciado.** Cada ticket debe mapear a
   `ui/` / `audio/` / `dsp/` / `ia/` / `storage/` / `study/` o a docs/CI del
   repo, y a un hito (Avance 1 / 2 / Entrega Final) del curso. Si un ticket
   implica “subir la app a internet”, es inválido: reescribir o cerrar.
4. **Persona visible.** Assignee de GitHub **y** label `person:…`
   (`person:jahel`, `person:rebeca`, `person:luna`, `person:saul`,
   `person:cesar`).
5. **Calidad del ticket.** Todo issue nuevo debe seguir la plantilla y el
   nivel de detalle de
   [`Documentacion general/GUIA-CREACION-ISSUES.md`](./Documentacion%20general/GUIA-CREACION-ISSUES.md):
   contexto de producto, rutas reales, investigación, soluciones aceptables,
   docs a consultar, criterios de aceptación medibles y asignación por
   **reparto equitativo** (de quien menos ha aportado a quien más). Un issue
   debe estar lo bastante completo para que un modelo de IA del equipo pueda
   implementarlo sin reinventar el alcance del proyecto.
6. **Backlog y cuerpos versionados.** El orden de trabajo del lote de rúbrica
   vive en
   [`Documentacion general/BACKLOG-RUBRICA-ESTRICTA.md`](./Documentacion%20general/BACKLOG-RUBRICA-ESTRICTA.md)
   y en el issue meta
   [#80](https://github.com/JoseJahel/my-personal-english-teacher/issues/80).
   Los textos largos de tickets están en
   [`.github/issue-bodies/`](./.github/issue-bodies/) (ver su README).

Detalle técnico y lección 2026-08-03: `Documentacion general/REGLAS-DE-CODIGO.md`
(§1.1 y Lecciones aprendidas).

## Trabajo por módulos

La construcción de la aplicación es modular, siguiendo las capas de
`app/src` (`audio/`, `dsp/`, `ia/`, `ui/`, `storage/`, `study/`). Cada Pull Request
debe enfocarse idealmente en un solo módulo, para que cada uno pueda
desarrollarse y ajustarse de forma independiente. Esto no implica una
asignación fija de módulos por persona.

## Flujo de integración

- `main` es la rama de integración del proyecto.
- Nunca se hace commit ni push directo a `main`.
- Los cambios se integran mediante un Pull Request abierto hacia `main` desde
  la rama personal `*-frontend` o, si un agente no puede usarla, desde su
  rama temporal.
- Todo PR a `main` debe citar un issue con keyword de cierre (`Closes #N` o
  `Fixes #N`) en el cuerpo. Sin ticket, crear el issue antes o al abrir el PR
  y ligarlo. El merge cierra el issue.
- Se sugiere al menos una revisión de otro integrante antes de hacer merge.
- **Cerrar el PR (merge) es una regla estricta:** ver
  [Cerrar un Pull Request](#cerrar-un-pull-request-regla-estricta).
  Abrir el PR no termina el trabajo.
- Antes de abrir un Pull Request, sincronizar **esta** rama con `origin/main`
  (no con el `main` local):

```bash
git fetch origin
git merge origin/main
# o rebase sobre origin/main; resolver conflictos
```

## Cerrar un Pull Request (regla estricta)

Abrir el PR **no** cierra el trabajo. La sesión que vaya a integrar el PR a
`main` **debe quedarse pendiente** hasta que se cumplan las tres condiciones
siguientes. Si falta una, **no hay merge**.

1. **CI en verde en el último commit.** El workflow `ci` (`build-and-test`:
   lint, typecheck, tests, e2e smoke del shell, build) está `SUCCESS`. Si
   está en cola o en curso, esperar. Si falla, no mergear: diagnosticar y
   corregir en la misma rama.
2. **Test plan 100 % cerrado.** Cada casilla del cuerpo del PR (`- [ ]`)
   debe estar marcada (`- [x]`). No se marca una casilla sin evidencia
   (salida de comando, captura, o verificación en localhost). Un punto
   manual (turno con micrófono y modelos, checklist de captura, etc.) no se
   da por hecho porque el código “se ve bien”.
3. **Sin bloqueos de integración.** El PR es `MERGEABLE`, no hay
   `CHANGES_REQUESTED` ni hilos de review abiertos que pidan un cambio.

**Si aún queda un punto abierto, la sesión no se detiene.** El modelo o
quien cierra el PR **debe aplicar el fix o la prueba que falte** (test
automático, fixture de preview, corrida en localhost, corrección de CI)
hasta que esa casilla se pueda marcar con evidencia. Quedarse a la espera
pasiva (“falta un turno / lo hace el usuario”) no cierra el trabajo. Solo
si el punto es objetivamente imposible en esa sesión (no hay micrófono
humano y el escenario lo exige de forma irreemplazable) se deja escrito en
el PR qué falta; en cualquier otro caso se añade la prueba o el arreglo y
se vuelve a verificar.

Solo entonces se hace el merge a `main`. La sesión no se considera
terminada al abrir el PR: termina cuando CI y test plan están cerrados y el
merge se ejecutó. Quien abre el PR **babysit** CI y mergeabilidad en tiempo
real hasta el merge, o hasta un bloqueo que exija humano.

Después del merge, si el PR salió de una **rama temporal de agente**, la
misma sesión borra esa rama (local y remota), elimina su worktree y hace
`git fetch --prune`. No se borran las ramas personales `*-frontend`.

## Convención de commits

Se usa el formato de *conventional commits* con scope, en inglés y en modo
imperativo. El título tiene un máximo de 50 caracteres.

Ejemplos:

```
feat(audio): add pitch detection
fix(ui): correct mic button state
docs(repo): update readme
```

Opcionalmente se puede agregar un cuerpo de 1-2 frases si aporta contexto
adicional relevante al cambio.

## Secretos y archivos privados

- Nunca subir claves, tokens, credenciales ni archivos personales al
  repositorio.
- Cada integrante puede usar una carpeta local `_private/` (ya ignorada por
  Git) para sus archivos personales, y sus propios archivos `.env`
  (también ignorados).
- Si un secreto llega por accidente a un commit, avisar de inmediato al
  equipo para rotarlo y limpiar el historial del repositorio.

## Calendario de entregas

| Entrega        | Semana | Fechas                  |
|-----------------|--------|--------------------------|
| Avance 1        | 4      | 27/07/2026 – 01/08/2026 |
| Avance 2        | 7      | 17/08/2026 – 22/08/2026 |
| Entrega Final   | 10     | 07/09/2026 – 12/09/2026 |

**Nota:** cada entrega incluye documento técnico, presentación de 10-15
minutos y demo funcional.
