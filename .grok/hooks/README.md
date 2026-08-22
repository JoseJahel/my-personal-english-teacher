# Hooks del proyecto (Grok)

## `deep-scan-git-sync`

Se dispara en **`UserPromptSubmit`** cuando el mensaje del usuario pide un
escaneo profundo del proyecto y del historial de git.

### Frase disparadora

Cualquiera de estas (case-insensitive):

- `escanea el proyecto` **y** `historial de git` (la frase habitual del equipo)
- `escanea el proyecto` **y** `a fondo`
- `scan the project` + `git history` / `deep scan` + project|git

### Qué hace (en automático, antes de que el agente analice)

1. Comprueba working tree limpio (si hay cambios sin commit → **no toca git** y avisa).
2. `git fetch origin --prune`
3. Actualiza la ref local **`main`** a `origin/main`
4. Alinea la **rama actual** con `main` (merge `-X theirs`; si hace falta, resuelve conflictos a favor de main)
5. Escribe un log en `.grok/hooks/state/last-deep-scan-sync.txt`
6. Inyecta un resumen en el contexto del turno (`additionalContext`) para que el agente escanee el árbol ya actualizado

### Activación

1. Confía el proyecto para hooks: en la TUI de Grok ejecuta **`/hooks-trust`**
   (o arranca con `--trust`).
2. Recarga hooks: **`/hooks`** → tecla `r`, o reinicia la sesión.
3. Escribe el mensaje de escaneo en cualquier rama personal (`jahel-frontend`, etc.).

### Por qué el `command` es un `.cmd` (no `${CLAUDE_PROJECT_DIR}`)

Grok en Windows lanza el hook a través de PowerShell. `${CLAUDE_PROJECT_DIR}`
en esa cadena es interpolación de **variable de sesión** de PowerShell, no
de entorno: queda vacía y `-File` recibe `/.grok/hooks/bin/…` (exit 1).
El launcher `run-deep-scan-git-sync.cmd` (ruta relativa al JSON) usa
`%~dp0` para hallar el `.ps1` aunque el path del repo tenga espacios.
El `command` del JSON **no debe contener `$`**.

### Seguridad

- No corre si hay cambios sin commitear.
- No hace force-push.
- Fail-open: si el script falla, el agente sigue (pero sin sync).
- El estado y el script viven en el repo; no guardan secretos.
