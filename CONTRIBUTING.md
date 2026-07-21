# Guía de contribución

Este documento define las reglas de trabajo colaborativo para el repositorio
**my-personal-english-teacher**, proyecto del curso Señales y Sistemas.

## Equipo y ramas

Cada integrante trabaja en dos ramas propias, sin tildes en el nombre:

| Integrante | Rama frontend    | Rama backend    |
|------------|------------------|-----------------|
| Jahel      | `jahel-frontend` | `jahel-backend` |
| Rebeca     | `rebeca-frontend`| `rebeca-backend`|
| Luna       | `luna-frontend`  | `luna-backend`  |
| Saúl       | `saul-frontend`  | `saul-backend`  |
| César      | `cesar-frontend` | `cesar-backend` |

Cada persona trabaja únicamente en sus propias ramas. No se realizan cambios
en las ramas de otro integrante sin coordinarlo primero.

La aplicación es 100% client-side, así que en este proyecto «backend» no
significa servidor: las ramas `*-backend` cubren el motor no visual de la
app (captura y procesamiento de audio, DSP, pipeline de IA y almacenamiento
— carpetas `audio/`, `dsp/`, `ia/`, `storage/`), y las ramas `*-frontend`
cubren la interfaz React (`ui/`).

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
