## Cierre de ticket

Closes #N

<!-- Sustituye N. Obligatorio. Si no hay ticket, créalo antes de abrir el PR. -->

## Módulo

<!-- Una capa: ui | audio | dsp | ia | storage | docs/CI -->

- Capa / módulo:

## Por qué

<!-- 1–3 frases. Qué cambia y por qué. -->

## Test plan (regla estricta de merge)

No mergear si queda una casilla abierta. Cada ítem marcado necesita evidencia
(salida de comando, captura, o verificación en localhost).

- [ ] CI `build-and-test` en verde en el último commit (lint, typecheck, tests, e2e smoke, build)
- [ ] `pnpm lint` + `pnpm test` + `pnpm build` en `app/` (si el PR es solo docs: N/A y justificar)
- [ ] Criterios de aceptación del issue `#N` verificados
- [ ] Sin `CHANGES_REQUESTED` ni hilos de review que pidan un cambio
- [ ] El PR es `MERGEABLE` respecto a `origin/main`

## Notas

-
