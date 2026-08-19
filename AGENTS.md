# Contrato para agentes

Proceso Git y tickets: [`CONTRIBUTING.md`](./CONTRIBUTING.md).
Código: [`Documentacion general/REGLAS-DE-CODIGO.md`](./Documentacion%20general/REGLAS-DE-CODIGO.md).
Issues: [`Documentacion general/GUIA-CREACION-ISSUES.md`](./Documentacion%20general/GUIA-CREACION-ISSUES.md).
No copies esos docs aquí.

## 1. Primer mensaje (antes de cualquier otra acción)

1. `git fetch origin`
2. Identificar HEAD con `git rev-parse HEAD` y `git rev-parse --abbrev-ref HEAD`. **No** parsear `.git/HEAD`.
3. `origin/main` es la verdad. No uses el `main` local (suele ir decenas de commits atrás).
4. Actualiza la rama de **esta** sesión contra `origin/main`, o crea una rama nueva desde `origin/main`.
5. Nunca hagas `checkout` de `main` si eso pisa el working tree de otra sesión.

## 2. Concurrencia y worktrees

Si otra sesión ya usa la misma rama (working tree sucio ajeno, otro worktree en esa rama, o `*-frontend` ocupada), abre una **rama temporal** en un **worktree nuevo** desde `origin/main`.

- Archivos sucios ajenos = **fuera de ámbito**. No los toques, reformatees ni reviertas.
- Nunca `git add -A`. Añade solo paths de esta tarea.
- No edites en el checkout caliente de otro humano o agente.

Ramas personales largas (humanos; **no borrarlas**):
`jahel-frontend` | `rebeca-frontend` | `luna-frontend` | `saul-frontend` | `cesar-frontend`

Ramas temporales de agente: cortas, con prefijo de tarea (`docs/…`, `fix/…`, `feat/…`). No reutilices `*-frontend` si está ocupada.

## 3. Commit, push y PR

Sin un **sí explícito** del usuario: no hagas commit, push ni abras PR.

Todo PR a `main` lleva un GitHub Issue con keyword de cierre en el cuerpo (`Closes #N` o `Fixes #N`). Si no hay ticket, créalo **antes o al abrir** el PR (labels `person:` / hito / tipo / capa + assignee) y lígalo. El merge cierra el issue. Red de seguridad: `.github/workflows/ensure-pr-issue.yml`.

## 4. Babysit hasta el merge

Abrir el PR **no** termina. Vigila CI y mergeabilidad en tiempo real hasta merge exitoso, o hasta un bloqueo que exija humano. Condiciones: CI verde, test plan 100 %, `MERGEABLE` (detalle en CONTRIBUTING).

## 5. Después del merge (solo tu rama temporal)

1. Borra **tu** rama temporal local y remota.
2. Quita **tu** worktree.
3. `git fetch --prune`.
4. No borres ramas `*-frontend` ni worktrees ajenos.

## 6. Higiene

No dejes worktrees huérfanos, ramas temporales ya mergeadas, ni un `main` local stale como base. La base es siempre `origin/main`.
