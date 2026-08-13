# Guía de contribución

Este documento define las reglas de trabajo colaborativo para el repositorio
**my-personal-english-teacher**, proyecto del curso Señales y Sistemas.

**Código:** las prácticas, anti-patrones y límites de implementación viven en
[`Documentacion general/REGLAS-DE-CODIGO.md`](./Documentacion%20general/REGLAS-DE-CODIGO.md).
Léelas antes de implementar o revisar un PR. Este archivo solo cubre Git, ramas y commits.

## Equipo y ramas

Cada integrante trabaja en una única rama propia, sin tildes en el nombre:

| Integrante | Rama             |
|------------|------------------|
| Jahel      | `jahel-frontend` |
| Rebeca     | `rebeca-frontend`|
| Luna       | `luna-frontend`  |
| Saúl       | `saul-frontend`  |
| César      | `cesar-frontend` |

Cada persona trabaja únicamente en sus propias ramas. No se realizan cambios
en las ramas de otro integrante sin coordinarlo primero.

Cada integrante integra a `main`, desde esa única rama personal, todo su
trabajo: tanto el de interfaz (`ui/`) como el del motor no visual de la app
(`audio/`, `dsp/`, `ia/`, `storage/`). El sufijo «-frontend» en los nombres
de las ramas es histórico y no limita el alcance del trabajo que se integra
desde cada una.

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
   `ui/` / `audio/` / `dsp/` / `ia/` / `storage/` o a docs/CI del repo, y a
   un hito (Avance 1 / 2 / Entrega Final) del curso. Si un ticket implica
   “subir la app a internet”, es inválido: reescribir o cerrar.
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
`app/src` (`audio/`, `dsp/`, `ia/`, `ui/`, `storage/`). Cada Pull Request
debe enfocarse idealmente en un solo módulo, para que cada uno pueda
desarrollarse y ajustarse de forma independiente. Esto no implica una
asignación fija de módulos por persona.

## Flujo de integración

- `main` es la rama de integración del proyecto.
- Nunca se hace commit ni push directo a `main`.
- Los cambios se integran mediante un Pull Request abierto desde la rama
  personal correspondiente hacia `main`.
- Se sugiere al menos una revisión de otro integrante antes de hacer merge.
- Antes de abrir un Pull Request, mantener la rama personal actualizada con
  `main`:

```bash
git pull origin main
# resolver conflictos con merge o rebase según corresponda
```

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
